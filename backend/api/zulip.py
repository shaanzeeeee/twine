from typing import Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Extra
from backend.services.zulip_service import ZulipServiceError, zulip_service
from backend.services.chat_service import chat_service

router = APIRouter(prefix="/zulip", tags=["zulip"])

class ZulipSendRequest(BaseModel):
    type: str
    to: str
    content: str
    subject: Optional[str] = None

class ZulipIncomingMessage(BaseModel):
    message: Optional[dict] = None
    sender_email: Optional[str] = None
    sender_full_name: Optional[str] = None
    stream: Optional[str] = None
    subject: Optional[str] = None
    content: Optional[str] = None

    class Config:
        extra = Extra.allow


def _get_incoming_payload_values(payload: ZulipIncomingMessage):
    message = payload.message if isinstance(payload.message, dict) else {}

    text = None
    if isinstance(message, dict):
        text = message.get("content") or message.get("raw_content")

    text = text or payload.content

    stream = payload.stream or message.get("stream")
    subject = payload.subject or message.get("subject")
    sender_email = payload.sender_email or message.get("sender_email")

    if not sender_email and isinstance(message, dict) and message.get("type") == "private":
        sender_email = message.get("sender_email")

    return text, stream, subject, sender_email


@router.post("/send")
def send_zulip_message(request: ZulipSendRequest):
    try:
        result = zulip_service.send_message(
            message_type=request.type,
            to=request.to,
            content=request.content,
            subject=request.subject,
        )
        return result
    except ZulipServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/incoming")
def zulip_incoming(payload: ZulipIncomingMessage):
    text, stream, subject, sender_email = _get_incoming_payload_values(payload)
    if not text:
        raise HTTPException(status_code=400, detail="No Zulip message content provided")

    try:
        response_text = chat_service.get_response(text, history=[])

        if stream:
            subject = subject or "general"
            zulip_service.send_stream_message(stream=stream, subject=subject, content=response_text)
        elif sender_email:
            zulip_service.send_private_message(recipient=sender_email, content=response_text)
        else:
            raise HTTPException(status_code=400, detail="Unable to determine Zulip recipient")
    except ZulipServiceError as exc:
        raise HTTPException(status_code=502, detail=str(exc))
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    return {"status": "sent"}
