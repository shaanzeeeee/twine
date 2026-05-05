import requests
from backend.core.config import settings


class ZulipServiceError(Exception):
    pass


class ZulipService:
    def __init__(self):
        self.site_url = settings.ZULIP_SITE_URL.strip().rstrip("/")
        self.auth = (settings.ZULIP_BOT_EMAIL, settings.ZULIP_API_KEY)
        self._validate_settings()

    def _validate_settings(self):
        if not self.site_url:
            raise ZulipServiceError("ZULIP_SITE_URL is not configured")
        if not self.auth[0] or not self.auth[1]:
            raise ZulipServiceError("ZULIP_BOT_EMAIL and ZULIP_API_KEY must be configured")

    def send_message(self, message_type: str, to: str, content: str, subject: str = None):
        url = f"{self.site_url}/api/v1/messages"
        if not url.startswith("http"):
            raise ZulipServiceError(f"Invalid Zulip site URL: {self.site_url}")

        data = {
            "type": message_type,
            "to": to,
            "content": content,
        }
        if subject:
            data["subject"] = subject

        try:
            response = requests.post(url, auth=self.auth, data=data, timeout=15)
            response.raise_for_status()
            return response.json()
        except requests.RequestException as exc:
            detail = str(exc)
            if hasattr(exc, 'response') and exc.response is not None:
                try:
                    body = exc.response.text.strip()
                    if body:
                        detail = f"{detail} | response_body={body}"
                except Exception:
                    pass
            raise ZulipServiceError(f"Zulip API request failed: {detail}") from exc

    def send_stream_message(self, stream: str, subject: str, content: str):
        return self.send_message("stream", stream, content, subject=subject)

    def send_private_message(self, recipient: str, content: str):
        return self.send_message("private", recipient, content)


zulip_service = ZulipService()
