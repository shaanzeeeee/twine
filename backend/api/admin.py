from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from backend.core.database import get_db
from backend.models.sql_models import ChatSession, Message, User
from backend.api.deps import get_current_admin_user
from backend.services.chroma_service import chroma_service

router = APIRouter(prefix="/admin", tags=["admin"])

@router.get("/transcripts")
def get_transcripts(db: Session = Depends(get_db), current_user: User = Depends(get_current_admin_user)):
    """Fetch all chat sessions and their messages"""
    sessions = db.query(ChatSession).order_by(desc(ChatSession.created_at)).all()
    
    result = []
    for session in sessions:
        messages = db.query(Message).filter(Message.session_id == session.id).order_by(Message.timestamp).all()
        # Only include sessions that have messages
        if messages:
            result.append({
                "session_id": session.id,
                "created_at": session.created_at,
                "messages": [{"id": m.id, "role": m.role, "content": m.content, "upvoted": m.upvoted} for m in messages]
            })
    return result

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
