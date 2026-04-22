from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, Text, Index
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy.sql import func

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    role = Column(String(50), default="User", nullable=False) # 'Admin' or 'User'
    hashed_password = Column(String(255), nullable=False)
    
    sessions = relationship("ChatSession", back_populates="user")

class ChatSession(Base):
    __tablename__ = "chat_sessions"
    __table_args__ = (
        Index("ix_chat_sessions_created_status", "created_at", "review_status"),
    )

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    guest_name = Column(String(100), nullable=True, index=True)
    review_status = Column(String(50), nullable=False, default="pending_review", index=True)
    discarded_at = Column(DateTime(timezone=True), nullable=True, index=True)
    discard_reason = Column(String(255), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    user = relationship("User", back_populates="sessions")
    messages = relationship("Message", back_populates="session", cascade="all, delete-orphan")

class Message(Base):
    __tablename__ = "messages"
    __table_args__ = (
        Index("ix_messages_session_timestamp", "session_id", "timestamp"),
        Index("ix_messages_session_role_timestamp", "session_id", "role", "timestamp"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False, index=True)
    role = Column(String(50), nullable=False, index=True) # 'user' or 'assistant'
    content = Column(Text, nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now(), index=True)
    upvoted = Column(Boolean, default=False)

    session = relationship("ChatSession", back_populates="messages")

class KnowledgeMetadata(Base):
    __tablename__ = "knowledge_metadata"

    id = Column(Integer, primary_key=True, index=True)
    source_id = Column(String(255), unique=True, index=True) # Drive File ID
    source_url = Column(String(1024))
    file_type = Column(String(50))
    processed_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())


class AnalyticsAlertRule(Base):
    __tablename__ = "analytics_alert_rules"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(120), nullable=False)
    metric_key = Column(String(120), nullable=False, index=True)
    threshold = Column(Integer, nullable=False)
    comparator = Column(String(10), nullable=False, default=">=")
    enabled = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class LearnedKnowledge(Base):
    __tablename__ = "learned_knowledge"

    id = Column(Integer, primary_key=True, index=True)
    content = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    user = relationship("User")
