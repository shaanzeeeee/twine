import os
import pytest

os.environ.setdefault("ZULIP_SITE_URL", "https://example.zulip.com")
os.environ.setdefault("ZULIP_BOT_EMAIL", "bot@example.com")
os.environ.setdefault("ZULIP_API_KEY", "fake-api-key")
os.environ.setdefault("OPENAI_API_KEY", "fake-openai-key")

from backend.api import zulip as zulip_module


def test_zulip_incoming_stream_webhook(client_and_db, monkeypatch):
    client, _ = client_and_db

    monkeypatch.setattr(zulip_module.chat_service, "get_response", lambda text, history=[]: "Reply from LukaBot")

    recorded = {}

    def fake_send_stream_message(stream, subject, content):
        recorded["stream"] = stream
        recorded["subject"] = subject
        recorded["content"] = content
        return {"result": "ok"}

    monkeypatch.setattr(zulip_module.zulip_service, "send_stream_message", fake_send_stream_message)

    response = client.post(
        "/api/zulip/incoming",
        json={"message": {"content": "Hello", "stream": "general", "subject": "test"}},
    )

    assert response.status_code == 200
    assert response.json() == {"status": "sent"}
    assert recorded == {
        "stream": "general",
        "subject": "test",
        "content": "Reply from LukaBot",
    }


def test_zulip_incoming_private_webhook(client_and_db, monkeypatch):
    client, _ = client_and_db

    monkeypatch.setattr(zulip_module.chat_service, "get_response", lambda text, history=[]: "Private reply")

    recorded = {}

    def fake_send_private_message(recipient, content):
        recorded["recipient"] = recipient
        recorded["content"] = content
        return {"result": "ok"}

    monkeypatch.setattr(zulip_module.zulip_service, "send_private_message", fake_send_private_message)

    response = client.post(
        "/api/zulip/incoming",
        json={
            "message": {
                "content": "Hello",
                "type": "private",
                "sender_email": "user@example.com",
            }
        },
    )

    assert response.status_code == 200
    assert response.json() == {"status": "sent"}
    assert recorded == {
        "recipient": "user@example.com",
        "content": "Private reply",
    }
