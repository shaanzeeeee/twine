from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.services.chat_service import chat_service
from backend.services.drive_sync import sync_drive_to_chroma
from backend.core.database import get_db
from backend.models.sql_models import ChatSession, Message

router = APIRouter(prefix="/chat", tags=["chat"])

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    message: str
    session_id: Optional[int] = None
    guest_name: Optional[str] = None
    history: List[ChatMessage] = []

class ChatResponse(BaseModel):
    response: str
    session_id: Optional[int] = None

@router.post("/", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, db: Session = Depends(get_db)):
    try:
        # Resolve or create ChatSession
        session_id = request.session_id
        sanitized_guest_name = (request.guest_name or "").strip()
        sanitized_guest_name = sanitized_guest_name[:100] if sanitized_guest_name else None
        if not session_id:
            # Create a guest user to satisfy the DB constraint
            from backend.models.sql_models import User
            guest_user = db.query(User).filter(User.email == "guest@lukabot.com").first()
            if not guest_user:
                guest_user = User(email="guest@lukabot.com", hashed_password="nopassword", role="User")
                db.add(guest_user)
                db.commit()
                db.refresh(guest_user)
                
            chat_session = ChatSession(user_id=guest_user.id, guest_name=sanitized_guest_name)
            db.add(chat_session)
            db.commit()
            db.refresh(chat_session)
            session_id = chat_session.id
        else:
            chat_session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
            if not chat_session:
                raise HTTPException(status_code=404, detail="Session not found")
            if sanitized_guest_name and not chat_session.guest_name:
                chat_session.guest_name = sanitized_guest_name
                db.commit()

        # Save User Message to DB
        user_msg = Message(session_id=session_id, role="user", content=request.message)
        db.add(user_msg)
        db.commit()

        # Convert Pydantic history to dicts for the service
        history = [{"role": msg.role, "content": msg.content} for msg in request.history]
        
        reply = chat_service.get_response(request.message, history)
        
        # Save Assistant Message to DB
        assistant_msg = Message(session_id=session_id, role="assistant", content=reply)
        db.add(assistant_msg)
        db.commit()

        return ChatResponse(response=reply, session_id=session_id)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/sync")
async def trigger_manual_sync():
    try:
        result = sync_drive_to_chroma()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
