import os
import requests


BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

try:
    res = requests.post(
        f"{BASE_URL}/api/auth/setup-admin",
        json={
            "email": "admin@lukabot.com",
            "password": "password123",
        },
        timeout=30,
    )
    print(res.status_code, res.text)
except Exception as e:
    print(e)
