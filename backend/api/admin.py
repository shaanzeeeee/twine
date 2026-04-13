from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import datetime, timezone
from pydantic import BaseModel
from backend.core.database import get_db
from backend.models.sql_models import ChatSession, Message, User
from backend.api.deps import get_current_admin_user
from backend.services.chroma_service import chroma_service

router = APIRouter(prefix="/admin", tags=["admin"])


class DiscardSessionRequest(BaseModel):
    reason: str = ""


def _build_qa_documents(messages: List[Message], session_id: int):
    """Convert an ordered message stream into user/assistant Q/A docs."""
    documents = []
    metadatas = []
    ids = []
    pending_user = None

    for msg in messages:
        if msg.role == "user":
            pending_user = msg
            continue

        if msg.role == "assistant" and pending_user:
            documents.append(
                f"User Question: {pending_user.content}\n\nGold Standard Answer: {msg.content}"
            )
            metadatas.append(
                {
                    "type": "gold_standard",
                    "session_id": session_id,
                    "user_message_id": pending_user.id,
                    "assistant_message_id": msg.id,
                }
            )
            ids.append(f"gold_session_{session_id}_{msg.id}")
            pending_user = None

    return documents, metadatas, ids

@router.get("/transcripts")
def get_transcripts(
    search: str = Query(default=""),
    min_messages: int = Query(default=0, ge=0),
    include_discarded: bool = Query(default=False),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Fetch chat sessions and messages with optional filtering."""
    session_query = db.query(ChatSession)
    if include_discarded:
        session_query = session_query.filter(ChatSession.discarded_at.isnot(None))
    else:
        session_query = session_query.filter(ChatSession.discarded_at.is_(None))

    sessions = session_query.order_by(desc(ChatSession.created_at)).limit(limit).all()
    needle = search.strip().lower()
    
    result = []
    for session in sessions:
        messages = db.query(Message).filter(Message.session_id == session.id).order_by(Message.timestamp).all()
        if not messages:
            continue

        if len(messages) < min_messages:
            continue

        if needle:
            session_text = " ".join(m.content for m in messages).lower()
            session_guest = (session.guest_name or "").lower()
            if needle not in session_text and needle not in str(session.id) and needle not in session_guest:
                continue

        result.append(
            {
                "session_id": session.id,
                "guest_name": session.guest_name,
                "created_at": session.created_at,
                "discarded_at": session.discarded_at,
                "discard_reason": session.discard_reason,
                "message_count": len(messages),
                "status": session.review_status,
                "messages": [
                    {
                        "id": m.id,
                        "role": m.role,
                        "content": m.content,
                        "timestamp": m.timestamp,
                        "upvoted": m.upvoted,
                    }
                    for m in messages
                ],
            }
        )
    return result


@router.get("/transcripts/archive")
def get_archived_transcripts(
    search: str = Query(default=""),
    min_messages: int = Query(default=0, ge=0),
    limit: int = Query(default=200, ge=1, le=1000),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Fetch archived (soft-deleted) sessions only."""
    return get_transcripts(
        search=search,
        min_messages=min_messages,
        include_discarded=True,
        limit=limit,
        db=db,
        current_user=current_user,
    )


@router.get("/sessions/{session_id}/export")
def export_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Export a full session payload for download."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.timestamp)
        .all()
    )

    return {
        "session_id": session.id,
        "guest_name": session.guest_name,
        "created_at": session.created_at,
        "discarded_at": session.discarded_at,
        "discard_reason": session.discard_reason,
        "status": session.review_status,
        "message_count": len(messages),
        "messages": [
            {
                "id": m.id,
                "role": m.role,
                "content": m.content,
                "timestamp": m.timestamp,
                "upvoted": m.upvoted,
            }
            for m in messages
        ],
    }

@router.post("/upvote/{message_id}")
def upvote_message(message_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    """Mark an assistant message as gold standard and save Q/A pair to ChromaDB"""
    assistant_msg = db.query(Message).filter(Message.id == message_id, Message.role == "assistant").first()
    if not assistant_msg:
        raise HTTPException(status_code=404, detail="Assistant message not found")
        
    if assistant_msg.upvoted:
        return {"status": "Already upvoted"}

    # Find the preceding user message to form the Q/A pair
    user_msg = db.query(Message).filter(
        Message.session_id == assistant_msg.session_id,
        Message.role == "user",
        Message.timestamp < assistant_msg.timestamp
    ).order_by(desc(Message.timestamp)).first()

    if not user_msg:
        raise HTTPException(status_code=400, detail="Cannot find corresponding user question")

    # Mark as upvoted in Postgres
    assistant_msg.upvoted = True
    db.commit()

    # Create the text document for the Gold Standard collection
    combined_text = f"User Question: {user_msg.content}\n\nGold Standard Answer: {assistant_msg.content}"
    
    # Store in ChromaDB
    chroma_service.add_documents(
        collection_name="lukabot_gold",
        documents=[combined_text],
        metadatas=[{"type": "gold_standard", "original_q": user_msg.content}],
        ids=[f"gold_{assistant_msg.id}"]
    )

    return {"status": "success", "message": "Saved to Gold Standard knowledge base"}


@router.post("/sessions/{session_id}/add-to-database")
def add_session_to_database(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Save all user/assistant turns from a session to ChromaDB, then discard the session."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    messages = (
        db.query(Message)
        .filter(Message.session_id == session_id)
        .order_by(Message.timestamp)
        .all()
    )
    if not messages:
        raise HTTPException(status_code=400, detail="Session has no messages")

    documents, metadatas, ids = _build_qa_documents(messages, session_id)
    if not documents:
        raise HTTPException(status_code=400, detail="No valid user/assistant pairs found in session")

    chroma_service.add_documents(
        collection_name="lukabot_gold",
        documents=documents,
        metadatas=metadatas,
        ids=ids,
    )

    for msg in messages:
        if msg.role == "assistant":
            msg.upvoted = True

    session.review_status = "approved"
    session.discarded_at = datetime.now(timezone.utc)
    session.discard_reason = "Added to database"
    db.commit()

    return {
        "status": "success",
        "saved_pairs": len(documents),
        "message": "Session saved to database and discarded",
    }


@router.delete("/sessions/{session_id}")
def discard_session(
    session_id: int,
    payload: DiscardSessionRequest = DiscardSessionRequest(),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Soft-delete a session from active review while preserving its history."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.review_status = "discarded"
    session.discarded_at = datetime.now(timezone.utc)
    session.discard_reason = payload.reason.strip()[:255] if payload.reason else None
    db.commit()
    return {"status": "success", "message": "Session discarded"}


@router.post("/sessions/{session_id}/restore")
def restore_session(
    session_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Restore a soft-deleted session back to active review."""
    session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    session.review_status = "pending_review"
    session.discarded_at = None
    session.discard_reason = None
    db.commit()
    return {"status": "success", "message": "Session restored"}
