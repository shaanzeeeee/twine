from backend.models.sql_models import ChatSession, Message


def test_guest_name_persisted_and_session_accumulates(client_and_db, monkeypatch):
    client, TestingSessionLocal = client_and_db

    monkeypatch.setattr(
        "backend.api.chat.chat_service.get_response",
        lambda *_args, **_kwargs: "assistant reply",
    )

    first = client.post(
        "/chat/",
        json={
            "message": "hello",
            "guest_name": "Jordan",
            "history": [],
        },
    )
    assert first.status_code == 200
    session_id = first.json()["session_id"]

    second = client.post(
        "/chat/",
        json={
            "message": "follow up",
            "session_id": session_id,
            "guest_name": "Jordan",
            "history": [{"role": "user", "content": "hello"}],
        },
    )
    assert second.status_code == 200

    db = TestingSessionLocal()
    try:
        session = db.query(ChatSession).filter(ChatSession.id == session_id).first()
        assert session is not None
        assert session.guest_name == "Jordan"

        messages = db.query(Message).filter(Message.session_id == session_id).all()
        assert len(messages) == 4
    finally:
        db.close()
