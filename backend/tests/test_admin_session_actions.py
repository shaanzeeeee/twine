from backend.models.sql_models import ChatSession, Message, User


def _seed_session(TestingSessionLocal, guest_name="Jordan"):
    db = TestingSessionLocal()
    try:
        user = User(email=f"guest-{guest_name.lower()}@test.local", role="User", hashed_password="x")
        db.add(user)
        db.commit()
        db.refresh(user)

        session = ChatSession(user_id=user.id, guest_name=guest_name)
        db.add(session)
        db.commit()
        db.refresh(session)

        db.add(Message(session_id=session.id, role="user", content="question"))
        db.add(Message(session_id=session.id, role="assistant", content="answer"))
        db.commit()

        return session.id
    finally:
        db.close()


def test_discard_moves_to_archive_and_restore_returns_to_active(client_and_db):
    client, TestingSessionLocal = client_and_db
    session_id = _seed_session(TestingSessionLocal)

    discard = client.request("DELETE", f"/admin/sessions/{session_id}", json={"reason": "noise"})
    assert discard.status_code == 200

    active = client.get("/admin/transcripts")
    assert active.status_code == 200
    assert all(item["session_id"] != session_id for item in active.json())

    archived = client.get("/admin/transcripts/archive")
    assert archived.status_code == 200
    assert any(item["session_id"] == session_id for item in archived.json())

    restore = client.post(f"/admin/sessions/{session_id}/restore")
    assert restore.status_code == 200

    active_after_restore = client.get("/admin/transcripts")
    assert any(item["session_id"] == session_id for item in active_after_restore.json())


def test_add_to_database_marks_session_approved_and_archived(client_and_db, monkeypatch):
    client, TestingSessionLocal = client_and_db
    session_id = _seed_session(TestingSessionLocal, guest_name="Avery")

    captured = {"called": False}

    def _fake_add_documents(**_kwargs):
        captured["called"] = True

    monkeypatch.setattr("backend.api.admin.chroma_service.add_documents", _fake_add_documents)

    add = client.post(f"/admin/sessions/{session_id}/add-to-database")
    assert add.status_code == 200
    assert captured["called"] is True

    archived = client.get("/admin/transcripts/archive")
    assert archived.status_code == 200

    matching = [item for item in archived.json() if item["session_id"] == session_id]
    assert len(matching) == 1
    assert matching[0]["status"] == "approved"


def test_manual_drive_sync_uses_admin_route(client_and_db, monkeypatch):
    client, _ = client_and_db

    captured = {"called": False}

    def _fake_sync():
        captured["called"] = True
        return {"status": "success", "message": "ok", "docs_indexed": 3}

    monkeypatch.setattr("backend.api.admin.sync_drive_to_chroma", _fake_sync)

    response = client.post("/admin/drive/sync")

    assert response.status_code == 200
    assert captured["called"] is True
    assert response.json()["docs_indexed"] == 3


def test_legacy_chat_sync_route_is_removed(client_and_db):
    client, _ = client_and_db

    response = client.post('/chat/sync')

    assert response.status_code == 404
