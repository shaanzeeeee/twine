# Twine Project Context

## Overview
- **Project**: Twine - Persona Intelligence Engine
- **Stack**: FastAPI, PostgreSQL, ChromaDB (Vector Store), OpenAI GPT-4o
- **Purpose**: Hybrid RAG-based AI assistant designed for high-fidelity persona synthesis and real-time knowledge curation.

## Architecture
```
User → API → ChatService → Hybrid RAG (Chroma) → OpenAI → Response
                ↓
            PostgreSQL (Sessions, Messages, Priority Knowledge)
```

## Key Components

### API Tier (backend/api/)
- **chat.py**: `/chat` - Primary conversational endpoint.
  - Guest mode persistence support.
  - `!learn` protocol for real-time admin knowledge injection.
- **auth.py**: Enterprise-grade JWT authentication and role-based access.
- **admin.py**: Dashboard telemetry and session moderation endpoints.

### Intelligence Tier (backend/services/)
- **chat_service.py**: Orchestrates the persona logic.
  - Multi-stage safety filtering via GPT-4o-mini.
  - Hybrid RAG retrieval from prioritized collections.
- **chroma_service.py**: High-performance vector operations.
  - Dual-collection architecture: `twine_kb` (Drive) and `twine_gold` (Priority).
  - High-dimensional embeddings via `text-embedding-3-small`.
- **drive_sync.py**: Automated synchronization of Google Drive repositories into the vector space.

### Persistent Memory (backend/models/sql_models.py)
- **User**: Secure identity management with role-based permissions.
- **ChatSession**: Advanced session tracking with moderation status and metadata.
- **Message**: Granular message history with feedback loops (upvotes/downvotes).
- **LearnedKnowledge**: High-priority facts injected via the admin layer.

### Engine Core (backend/core/)
- **config.py**: Pydantic-driven environment management.
- **prompts.py**: PERSONA_SYSTEM_PROMPT (Advanced founder synthesis).
- **security.py**: Hardened JWT and password hashing protocols.

## Environment Architecture
- **DATABASE_URL**: Neon PostgreSQL (Serverless)
- **CHROMA_DB_DIR**: Local vector persistence.
- **OPENAI_API_KEY**: Engine intelligence key.
- **SECRET_KEY**: Security signing key.
- **DRIVE_CONFIG**: Folder ID, Credentials, and Token management.

## Strategic Intelligence Flows

### Hybrid Retrieval Priority
1. **Gold Layer**: Admin-taught priority facts (Immediate retrieval).
2. **Knowledge Layer**: Drive-ingested document chunks (Contextual retrieval).

### Admin Oversight
- **Real-time Injection**: Teach facts instantly via `!learn [content]`.
- **Session Audit**: Review, approve, or discard conversational outputs.
- **Operational Analytics**: Monitor engine velocity and accuracy via the premium dashboard.

---
© 2026 Twine Intelligence Engine | Internal System Documentation