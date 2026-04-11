import requests
try:
    res = requests.post("http://localhost:8000/auth/setup-admin", json={
        "email": "admin@lukabot.com",
        "password": "password123"
    })
    print(res.json())
except Exception as e:
    print(e)
