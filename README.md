# Twine — Persona Intelligence Engine

A production-grade RAG chatbot that learns and mimics any persona from uploaded documents and knowledge bases. Built with FastAPI, React, ChromaDB, and Groq.

## Features

- **Configurable Persona** — Define any persona via environment variables (name, description, behavioral instructions)
- **RAG Pipeline** — Retrieval-Augmented Generation using ChromaDB vector search + Groq LLM inference
- **Knowledge Base Ingestion** — Upload PDF/DOCX/TXT files or sync from Google Drive
- **Chat Interface** — Real-time conversational UI with session history, export, and regeneration
- **Admin Dashboard** — Review transcripts, view analytics, manage uploads, and curate the knowledge base
- **Demo Mode** — One-click recruiter demo login with read-only dashboard access
- **Safety Filters** — Configurable content safety checks on all user inputs

## Architecture

```
Frontend (React + Vite + Tailwind)  →  Backend (FastAPI)
        ↓                                    ↓
    Vercel                              Render (free tier)
                                             ↓
                                    ┌────────┼────────┐
                                    │        │        │
                                  Neon    ChromaDB   Groq
                               (Postgres) (Vectors)  (LLM)
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, Tailwind CSS |
| Backend | FastAPI, SQLAlchemy, APScheduler |
| LLM | Groq (Llama 3.3 70B) |
| Vector DB | ChromaDB (embedded) |
| Database | PostgreSQL (Neon free tier) |
| Embeddings | OpenAI text-embedding-3-small |
| Auth | JWT (python-jose + passlib) |

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL database (or Neon free tier)
- Groq API key ([console.groq.com](https://console.groq.com))
- OpenAI API key (for embeddings)

### Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env  # Edit with your credentials
python -m uvicorn backend.main:app --reload
```

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

### Create Users
```bash
python backend/setup_admin.py
```
This creates:
- **Admin**: `admin@twine.app` / `password123`
- **Demo**: `demo@twine.app` / `demo123`

## Persona Configuration

Set these environment variables to define your persona:

```env
PERSONA_NAME=Alex Chen
PERSONA_DESCRIPTION=A senior product manager with 10 years of experience in B2B SaaS. Known for sharp strategic thinking and data-driven decision making.
PERSONA_INSTRUCTIONS=Be direct and structured. Ask clarifying questions before giving advice. Use frameworks when explaining complex topics.
```

## Deployment

### Frontend → Vercel
1. Push the `frontend/` directory to a GitHub repo
2. Connect to Vercel, set root directory to `frontend/`
3. Set environment variable: `VITE_API_URL=https://your-backend.onrender.com/api`
4. Deploy

### Backend → Render
1. Push the project to GitHub
2. Create a new Web Service on Render
3. Set root directory to `backend/`, build command: `pip install -r requirements.txt`
4. Start command: `uvicorn backend.main:app --host 0.0.0.0 --port $PORT`
5. Add all `.env` variables in Render's Environment settings
6. Set `FRONTEND_URL` to your Vercel frontend URL

### Database → Neon
1. Create a free PostgreSQL database at [neon.tech](https://neon.tech)
2. Copy the connection string to `DATABASE_URL`

### Keep Backend Warm
Use [cron-job.org](https://cron-job.org) to ping `https://your-backend.onrender.com/api/health` every 14 minutes to prevent Render free-tier cold starts.

## License

MIT
