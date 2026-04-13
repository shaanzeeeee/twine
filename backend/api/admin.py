from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import List
from datetime import datetime, timezone
from pydantic import BaseModel
from collections import defaultdict
import re
import csv
import io
from backend.core.database import get_db
from backend.models.sql_models import ChatSession, Message, User
from backend.api.deps import get_current_admin_user
from backend.services.chroma_service import chroma_service

router = APIRouter(prefix="/admin", tags=["admin"])


class DiscardSessionRequest(BaseModel):
    reason: str = ""


STOPWORDS = {
    "the", "a", "an", "and", "or", "to", "of", "in", "on", "for", "is", "are", "was", "were",
    "be", "with", "this", "that", "it", "as", "at", "from", "by", "about", "can", "could", "should",
    "would", "how", "what", "why", "when", "where", "who", "i", "you", "we", "they", "he", "she",
    "my", "your", "our", "their", "me", "us", "them", "do", "does", "did", "please",
}


def _extract_terms(text: str) -> List[str]:
    tokens = re.findall(r"[a-zA-Z]{3,}", (text or "").lower())
    return [token for token in tokens if token not in STOPWORDS]


def _collect_window_data(db: Session, days: int):
    from datetime import timedelta

    now = datetime.now(timezone.utc)
    start_time = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days - 1)
    sessions = (
        db.query(ChatSession)
        .filter(ChatSession.created_at >= start_time)
        .order_by(ChatSession.created_at)
        .all()
    )
    session_ids = [session.id for session in sessions]
    messages = (
        db.query(Message)
        .filter(Message.session_id.in_(session_ids))
        .order_by(Message.timestamp)
        .all()
        if session_ids
        else []
    )
    return now, start_time, sessions, messages


@router.get("/analytics/overview")
def get_analytics_overview(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Return aggregated admin analytics for sessions and messages."""
    from datetime import timedelta
    now, start_time, sessions, messages = _collect_window_data(db, days)

    total_sessions = len(sessions)
    active_sessions = len([s for s in sessions if s.discarded_at is None])
    archived_sessions = total_sessions - active_sessions

    total_messages = len(messages)
    assistant_messages = len([m for m in messages if m.role == "assistant"])
    user_messages = len([m for m in messages if m.role == "user"])

    avg_messages_per_session = round(total_messages / total_sessions, 2) if total_sessions else 0

    status_counts = defaultdict(int)
    for session in sessions:
        status_counts[session.review_status or "pending_review"] += 1

    daily_sessions = defaultdict(int)
    daily_messages = defaultdict(int)
    for session in sessions:
        day_key = session.created_at.date().isoformat()
        daily_sessions[day_key] += 1

    for msg in messages:
        day_key = msg.timestamp.date().isoformat() if msg.timestamp else now.date().isoformat()
        daily_messages[day_key] += 1

    depth_buckets = {
        "1-2": 0,
        "3-5": 0,
        "6-10": 0,
        "11+": 0,
    }

    session_message_counts = defaultdict(int)
    for msg in messages:
        session_message_counts[msg.session_id] += 1

    for count in session_message_counts.values():
        if count <= 2:
            depth_buckets["1-2"] += 1
        elif count <= 5:
            depth_buckets["3-5"] += 1
        elif count <= 10:
            depth_buckets["6-10"] += 1
        else:
            depth_buckets["11+"] += 1

    guest_counts = defaultdict(int)
    for session in sessions:
        if session.guest_name:
            guest_counts[session.guest_name] += 1

    top_guests = sorted(
        [{"guest_name": name, "sessions": count} for name, count in guest_counts.items()],
        key=lambda item: item["sessions"],
        reverse=True,
    )[:10]

    trend_days = []
    cursor = start_time.date()
    while cursor <= now.date():
        day_key = cursor.isoformat()
        trend_days.append(
            {
                "date": day_key,
                "sessions": daily_sessions.get(day_key, 0),
                "messages": daily_messages.get(day_key, 0),
            }
        )
        cursor = cursor + timedelta(days=1)

    return {
        "window_days": days,
        "kpis": {
            "total_sessions": total_sessions,
            "active_sessions": active_sessions,
            "archived_sessions": archived_sessions,
            "total_messages": total_messages,
            "user_messages": user_messages,
            "assistant_messages": assistant_messages,
            "avg_messages_per_session": avg_messages_per_session,
        },
        "status_distribution": dict(status_counts),
        "depth_distribution": depth_buckets,
        "top_guests": top_guests,
        "daily_trends": trend_days,
    }


@router.get("/analytics/deep-dive")
def get_analytics_deep_dive(
    days: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Return deeper analysis: topic clusters, quality heuristics, and operations metrics."""
    now, _start_time, sessions, messages = _collect_window_data(db, days)

    # Topic and intent extraction from user messages
    user_messages = [msg for msg in messages if msg.role == "user"]
    term_counts = defaultdict(int)
    for msg in user_messages:
        for term in _extract_terms(msg.content):
            term_counts[term] += 1

    top_topics = sorted(
        [{"topic": term, "count": count} for term, count in term_counts.items()],
        key=lambda item: item["count"],
        reverse=True,
    )[:15]

    # Simple quality heuristics for assistant responses
    assistant_messages = [msg for msg in messages if msg.role == "assistant"]
    assistant_count = len(assistant_messages)
    short_answer_count = len([msg for msg in assistant_messages if len((msg.content or "").strip()) < 80])
    fallback_count = len(
        [
            msg
            for msg in assistant_messages
            if "error" in (msg.content or "").lower()
            or "can’t help" in (msg.content or "").lower()
            or "cannot" in (msg.content or "").lower()
        ]
    )

    # Queue aging for active review sessions
    pending_sessions = [s for s in sessions if (s.review_status or "pending_review") == "pending_review" and s.discarded_at is None]
    pending_ages = [max((now - (s.created_at or now)).days, 0) for s in pending_sessions]

    queue_aging = {
        "pending_count": len(pending_sessions),
        "oldest_pending_days": max(pending_ages) if pending_ages else 0,
        "avg_pending_days": round(sum(pending_ages) / len(pending_ages), 2) if pending_ages else 0,
    }

    # Operational throughput from statuses
    approved_count = len([s for s in sessions if (s.review_status or "") == "approved"])
    discarded_count = len([s for s in sessions if (s.review_status or "") == "discarded"])
    restored_estimate = len([s for s in sessions if (s.review_status or "") == "pending_review" and s.discard_reason is None and s.discarded_at is None])

    operations = {
        "approved_sessions": approved_count,
        "discarded_sessions": discarded_count,
        "restored_or_reopened_sessions": restored_estimate,
        "approval_rate": round((approved_count / len(sessions)) * 100, 2) if sessions else 0,
        "discard_rate": round((discarded_count / len(sessions)) * 100, 2) if sessions else 0,
    }

    quality = {
        "assistant_messages": assistant_count,
        "short_response_rate": round((short_answer_count / assistant_count) * 100, 2) if assistant_count else 0,
        "fallback_response_rate": round((fallback_count / assistant_count) * 100, 2) if assistant_count else 0,
    }

    # RAG quality approximation using response heuristics
    contextual_signals = len(
        [
            msg
            for msg in assistant_messages
            if any(
                keyword in (msg.content or "").lower()
                for keyword in ["based on", "from the", "knowledge base", "context", "according to"]
            )
        ]
    )
    low_context_signals = len(
        [
            msg
            for msg in assistant_messages
            if any(
                keyword in (msg.content or "").lower()
                for keyword in ["not enough context", "i don't have", "i do not have", "cannot find", "no information"]
            )
        ]
    )

    rag_quality = {
        "retrieval_hit_rate": round((contextual_signals / assistant_count) * 100, 2) if assistant_count else 0,
        "low_context_rate": round((low_context_signals / assistant_count) * 100, 2) if assistant_count else 0,
        "estimated_grounded_responses": contextual_signals,
    }

    # Anomaly detection against daily baseline
    daily_sessions = defaultdict(int)
    daily_fallbacks = defaultdict(int)
    for session in sessions:
        day_key = session.created_at.date().isoformat()
        daily_sessions[day_key] += 1
    session_by_id = {session.id: session for session in sessions}
    for msg in assistant_messages:
        day_key = (msg.timestamp or now).date().isoformat()
        if "error" in (msg.content or "").lower() or "can’t help" in (msg.content or "").lower():
            daily_fallbacks[day_key] += 1

    session_values = list(daily_sessions.values())
    fallback_values = list(daily_fallbacks.values())
    avg_sessions = (sum(session_values) / len(session_values)) if session_values else 0
    avg_fallbacks = (sum(fallback_values) / len(fallback_values)) if fallback_values else 0

    anomalies = []
    for day_key, value in daily_sessions.items():
        if avg_sessions and value > avg_sessions * 1.75:
            anomalies.append({"date": day_key, "type": "traffic_spike", "value": value, "baseline": round(avg_sessions, 2)})
    for day_key, value in daily_fallbacks.items():
        if avg_fallbacks and value > avg_fallbacks * 2:
            anomalies.append({"date": day_key, "type": "fallback_spike", "value": value, "baseline": round(avg_fallbacks, 2)})

    # Session outcome by top topics (approximation)
    topic_outcomes = defaultdict(lambda: {"approved": 0, "pending_review": 0, "discarded": 0})
    for msg in user_messages:
        terms = _extract_terms(msg.content)
        if not terms:
            continue
        dominant = terms[0]
        status = (session_by_id.get(msg.session_id).review_status if session_by_id.get(msg.session_id) else "pending_review") or "pending_review"
        if status not in {"approved", "pending_review", "discarded"}:
            status = "pending_review"
        topic_outcomes[dominant][status] += 1

    topic_outcome_rows = [
        {"topic": topic, **counts}
        for topic, counts in topic_outcomes.items()
    ]
    topic_outcome_rows = sorted(topic_outcome_rows, key=lambda row: (row["approved"] + row["pending_review"] + row["discarded"]), reverse=True)[:12]

    return {
        "window_days": days,
        "top_topics": top_topics,
        "quality": quality,
        "rag_quality": rag_quality,
        "anomalies": anomalies,
        "queue_aging": queue_aging,
        "operations": operations,
        "topic_outcomes": topic_outcome_rows,
    }


@router.get("/analytics/report")
def export_analytics_report(
    days: int = Query(default=30, ge=1, le=365),
    format: str = Query(default="json"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user),
):
    """Export analytics report as JSON or CSV."""
    overview = get_analytics_overview(days=days, db=db, current_user=current_user)
    deep_dive = get_analytics_deep_dive(days=days, db=db, current_user=current_user)

    if format.lower() == "json":
        return {"overview": overview, "deep_dive": deep_dive}

    if format.lower() != "csv":
        raise HTTPException(status_code=400, detail="format must be 'json' or 'csv'")

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["section", "metric", "value"])

    for key, value in overview.get("kpis", {}).items():
        writer.writerow(["kpi", key, value])

    for key, value in deep_dive.get("quality", {}).items():
        writer.writerow(["quality", key, value])
    for key, value in deep_dive.get("rag_quality", {}).items():
        writer.writerow(["rag_quality", key, value])
    for key, value in deep_dive.get("operations", {}).items():
        writer.writerow(["operations", key, value])
    for key, value in deep_dive.get("queue_aging", {}).items():
        writer.writerow(["queue_aging", key, value])

    return {"filename": f"analytics-{days}d.csv", "csv": output.getvalue()}


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
