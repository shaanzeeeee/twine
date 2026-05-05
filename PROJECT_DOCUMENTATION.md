# LukaBot Project Documentation

## 1. Project Overview

LukaBot is a Retrieval-Augmented Generation (RAG) chatbot system designed to provide intelligent answers using a knowledge base built from Google Drive documents and admin-learned knowledge. It includes:

- A **FastAPI backend** for chat, authentication, admin actions, and integrations.
- A **React frontend** admin dashboard for reviewing sessions and monitoring analytics.
- A **ChromaDB vector store** backed by OpenAI embeddings.
- **Google Drive synchronization** to ingest DOCX/PDF content.
- **JWT-based authentication** for admin access.
- Optional **Zulip integration** for sending and receiving chat messages.

---

## 2. Key Features

- RAG chat assistant with founder persona and safety checks.
- Guest mode chat support without requiring auth.
- Admin review of chat sessions and upvote/downvote handling.
- Automatic Drive-based knowledge ingestion.
- Two-vector collections: knowledge base files and prioritized gold knowledge.
- Persistent history stored in PostgreSQL.
- Deployable via systemd and Nginx on Linux servers.

---

## 3. Architecture

### High-level flow

```
User -> Frontend/API -> ChatService -> RAG lookup -> OpenAI -> Response
                               |
                               +--> PostgreSQL (sessions, messages, learned knowledge)
```

### Major components

- `backend/api/`: API routes for chat, authentication, admin actions, Zulip.
- `backend/services/`: Business logic including Drive sync, ChromaDB, chat processing, and Zulip integration.
- `backend/models/sql_models.py`: SQLAlchemy ORM models for users, sessions, messages, knowledge metadata, and learned knowledge.
- `backend/core/`: Configuration, database setup, security, and prompt templates.
- `frontend/src/`: React application source code, including UI components, pages, auth state, and service calls.
- `scripts/`: Helper scripts for deployment and Drive setup.

---

## 4. Project Structure

```text
root/
├── backend/
│   ├── api/
│   │   ├── admin.py
│   │   ├── auth.py
│   │   ├── chat.py
│   │   ├── deps.py
│   │   └── zulip.py
│   ├── chroma_data/             # Local ChromaDB storage
│   ├── core/
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── prompts.py
│   │   └── security.py
│   ├── models/
│   │   └── sql_models.py
│   ├── services/
│   │   ├── chat_service.py
│   │   ├── chroma_service.py
│   │   ├── drive_sync.py
│   │   └── zulip_service.py
│   ├── alembic/                 # DB migration config
│   ├── main.py                  # FastAPI app entrypoint
│   ├── requirements.txt
│   ├── run_tests.py
│   ├── setup_admin.py
│   └── credentials.json         # Google API credentials placeholder
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── context/
│   │   ├── pages/
│   │   ├── services/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── package.json
│   ├── vite.config.js
│   └── test_results.txt
├── scripts/
│   ├── deploy_droplet.sh
│   ├── lukabot.nginx
│   ├── lukabot.service
│   ├── setup_drive.py
│   └── setup_github_ssh.sh
├── PROJECT_CONTEXT.md
├── README.md
├── server.md
└── token.json
```

---

## 5. Backend Details

### Backend purpose

The backend handles the chat workflow, request authentication, RAG retrieval, OpenAI calls, message persistence, and external integrations.

### Main backend services

- `backend/services/chat_service.py`
  - Core chat handling logic.
  - Safety checking via GPT-4o-mini.
  - Builds and executes RAG retrieval using Chroma.
  - Calls OpenAI GPT-4o for answer generation.
  - Stores user and assistant messages in PostgreSQL.

- `backend/services/chroma_service.py`
  - Manages ChromaDB collections.
  - Uses OpenAI embeddings (`text-embedding-3-small`).
  - Maintains two collections:
    - `lukabot_kb`: Google Drive document content.
    - `lukabot_gold`: Admin-learned priority knowledge.

- `backend/services/drive_sync.py`
  - Synchronizes Google Drive files into the ChromaKB.
  - Supports indexing PDF and DOCX content.

- `backend/services/zulip_service.py`
  - Zulip messaging support for inbound/outbound bot communication.

### API routes

- `backend/api/chat.py`
  - Main chat endpoint.
  - Guest mode support.
  - `!learn` command support for admins to add high-priority facts.

- `backend/api/auth.py`
  - Login and token issuance.

- `backend/api/admin.py`
  - Admin review actions and analytics endpoints.

- `backend/api/zulip.py`
  - Zulip webhook and send endpoints.

### Core configuration

- `backend/core/config.py`
  - App settings loaded from environment variables.

- `backend/core/database.py`
  - SQLAlchemy engine and session setup.

- `backend/core/prompts.py`
  - System prompt templates for the chatbot persona.

- `backend/core/security.py`
  - JWT token creation and verification.

### Database models

Stored entities include:

- `User`
- `ChatSession`
- `Message`
- `KnowledgeMetadata`
- `LearnedKnowledge`

---

## 6. Frontend Details

### Frontend role

The React frontend provides the admin interface for:

- Reviewing and moderating chat sessions.
- Inspecting message history.
- Viewing analytics.
- Logging in securely.

### Frontend libraries

- `react` / `react-dom`
- `react-router-dom`
- `axios`
- `date-fns`
- `recharts`
- `lucide-react`
- `tailwindcss`
- `vite`

### Important frontend files

- `frontend/src/components/ChatUI.jsx`
- `frontend/src/pages/AdminDashboard.jsx`
- `frontend/src/pages/Login.jsx`
- `frontend/src/services/api.js`
- `frontend/src/context/AuthContext.jsx`

---

## 7. Environment Variables

The backend requires these variables in `.env`:

- `DATABASE_URL`
- `CHROMA_DB_DIR`
- `OPENAI_API_KEY`
- `SECRET_KEY`
- `DRIVE_FOLDER_ID`
- `CREDENTIALS_FILE`
- `TOKEN_FILE`
- `BACKEND_BASE_URL`

Optional Zulip variables:

- `ZULIP_SITE_URL`
- `ZULIP_BOT_EMAIL`
- `ZULIP_API_KEY`

---

## 8. Setup Instructions

### Backend setup

1. Create and activate a Python virtual environment:
   ```bash
   cd backend
   python -m venv .venv
   .\.venv\Scripts\activate
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Create `.env` and populate required values.
4. Initialize or migrate the database via Alembic if needed.
5. Run the backend:
   ```bash
   uvicorn backend.main:app --host 127.0.0.1 --port 8000
   ```

### Frontend setup

1. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the local development server:
   ```bash
   npm run dev
   ```

### Google Drive sync setup

1. Place `credentials.json` from Google Cloud Console in the project root.
2. Run the Drive setup script:
   ```bash
   python scripts/setup_drive.py
   ```
3. Verify `token.json` is generated.

### Admin setup

1. Create an admin user using the backend script:
   ```bash
   python backend/setup_admin.py
   ```
2. Admin login credentials:
   - Email: `luka@test.com`
   - Password: test123

---

## 9. Deployment Notes

### DigitalOcean droplet deployment

- Project root on server: `/opt/lukarag`
- Backend virtualenv: `/opt/lukarag/.venv`
- Frontend build output: `/opt/lukarag/dist`
- Backend `.env`: `/opt/lukarag/.env`
- Backend service unit file: `/etc/systemd/system/lukabot.service`
- Nginx site config should proxy `/api/` to `http://127.0.0.1:8000/`.
- DigitalOcean console login:
  - User: `root`
  - Password: `LukaLuk@1s`

### systemd service example

```ini
[Unit]
Description=LukaBot FastAPI backend
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/lukarag
EnvironmentFile=/opt/lukarag/.env
ExecStart=/opt/lukarag/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user-target
```

### Nginx example

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;

    root /opt/lukarag/dist;
    index index.html;

    location /api/ {
        proxy_pass http://127.0.0.1:8000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 10. API & Integration Summary

### Chat flow

1. User sends a message to `/api/chat`.
2. The backend optionally handles `!learn` commands.
3. The chat session is resolved or created.
4. The message is saved to PostgreSQL.
5. The backend runs safety checks.
6. RAG lookup retrieves context from Chroma.
7. OpenAI generates the response.
8. The assistant response is saved and returned.

### Zulip integration

- `POST /api/zulip/send`: send messages via Zulip bot.
- `POST /api/zulip/incoming`: receive Zulip webhook payloads and reply.

---

## 11. Testing

- Backend tests live under `backend/tests/`.
- Run tests with:
  ```bash
  python backend/run_tests.py
  ```
- Frontend tests use Vitest:
  ```bash
  cd frontend
  npm run test
  ```

---

## 12. Troubleshooting

- If the backend fails, verify `.env` and database connectivity.
- If the frontend loads but API calls fail, confirm the backend is reachable and Nginx proxy settings are correct.
- For Nginx issues, run:
  ```bash
  sudo nginx -t
  sudo systemctl reload nginx
  ```
- For backend service issues, inspect:
  ```bash
  sudo journalctl -u lukabot.service -f
  ```

---

## 13. Dependencies

### Backend

- fastapi
- uvicorn[standard]
- sqlalchemy
- psycopg2-binary
- chromadb
- openai
- apscheduler
- google-api-python-client
- google-auth-httplib2
- google-auth-oauthlib
- pymupdf
- python-docx
- python-jose[cryptography]
- passlib[bcrypt]
- python-multipart
- pydantic
- alembic
- requests
- pytest

### Frontend

- react
- react-dom
- react-router-dom
- axios
- date-fns
- lucide-react
- recharts
- tailwindcss
- vite
- vitest

---

## 14. Notes

- The project's built-in RAG functionality prioritizes admin-learned `gold` knowledge over Drive-based KB content.
- The app is designed for a founder persona chatbot, with the ability to learn and improve through admin review.
- This documentation is intended to be copy-paste-ready for a document or internal knowledge base.
