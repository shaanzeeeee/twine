import os
import requests


BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000").rstrip("/")

# Create admin user
try:
    res = requests.post(
        f"{BASE_URL}/api/auth/setup-admin",
        json={
            "email": "admin@twine.app",
            "password": "password123",
        },
        timeout=30,
    )
    print(f"Admin setup: {res.status_code} {res.text}")
except Exception as e:
    print(f"Admin setup failed: {e}")

# Create demo user for recruiters
try:
    res = requests.post(
        f"{BASE_URL}/api/auth/setup-admin",
        json={
            "email": "demo@twine.app",
            "password": "demo123",
            "role": "Demo",
        },
        timeout=30,
    )
    print(f"Demo setup: {res.status_code} {res.text}")
except Exception as e:
    print(f"Demo setup failed: {e}")
