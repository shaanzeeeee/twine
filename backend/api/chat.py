from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.orm import Session
from backend.services.chat_service import chat_service
from backend.services.chroma_service import chroma_service
from backend.core.database import get_db
from backend.models.sql_models import ChatSession, Message, LearnedKnowledge, User
from backend.api.deps import get_optional_current_user

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
async def chat_endpoint(request: ChatRequest, req: Request, db: Session = Depends(get_db), current_user: Optional[User] = Depends(get_optional_current_user)):
    try:
        # Check for !learn command
        if request.message.strip().startswith("!learn"):
            if not current_user or current_user.role != "Admin":
                return ChatResponse(response="Sorry, only administrators can teach me new things.", session_id=request.session_id)
            
            # Extract learned content
            learned_content = request.message.strip()[len("!learn"):].strip()
            
            if not learned_content:
                return ChatResponse(
                    response="Please provide a fact for me to learn. Usage: !learn [fact]",
                    session_id=request.session_id
                )
            
            # Save to SQL
            learned_record = LearnedKnowledge(content=learned_content, created_by=current_user.id)
            db.add(learned_record)
            db.commit()
            
            # Save to Chroma gold collection
            chroma_service.add_documents(
                collection_name="gold",
                documents=[learned_content],
                metadatas=[{"source": "admin_taught", "type": "priority_knowledge"}],
                ids=[f"learned_{learned_record.id}"]
            )
            
            return ChatResponse(
                response="✅ Understood, Luka. I've updated my memory. I will prioritize this answer in the future.",
                session_id=request.session_id
            )

        # Resolve or create ChatSession
        session_id = request.session_id
        sanitized_guest_name = (request.guest_name or "").strip()
        sanitized_guest_name = sanitized_guest_name[:100] if sanitized_guest_name else None
        if not session_id:
            if current_user:
                # Use the authenticated user's ID
                chat_session = ChatSession(user_id=current_user.id, guest_name=sanitized_guest_name)
                db.add(chat_session)
            else:
                # Create a guest user to satisfy the DB constraint
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

