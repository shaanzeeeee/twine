# LukaBot Project Context

## Overview
- **Project**: LukaBot - AI chatbot for KingsBox founder persona
- **Stack**: FastAPI, PostgreSQL, ChromaDB (vector store), OpenAI GPT-4
- **Purpose**: RAG-based AI assistant that answers HR/compensation questions with personal context

## Architecture
```
User → API → ChatService → RAG (Chroma) → OpenAI → Response
                ↓
            PostgreSQL (sessions, messages, learned_knowledge)
```

## Key Components

### API Endpoints (api/)
- **chat.py**: `/chat` - Main chat endpoint
  - Supports guest mode (no auth)
  - Supports `!learn` command for admins to teach priority knowledge
  - Stores all messages in PostgreSQL
- **auth.py**: Authentication endpoints
- **admin.py**: Admin endpoints (review sessions, analytics)

### Services (services/)
- **chat_service.py**: Core chat logic
  - Safety check using GPT-4o-mini
  - RAG lookup from Chroma (gold + kb collections)
  - GPT-4o for response generation
- **chroma_service.py**: Vector store
  - Two collections: `lukabot_kb` (Drive files) and `lukabot_gold` (upvoted/prioritized)
  - OpenAI embeddings (text-embedding-3-small)
- **drive_sync.py**: Google Drive sync to Chroma

### Database Models (models/sql_models.py)
- **User**: email, role (Admin/User), hashed_password
- **ChatSession**: user_id, guest_name, review_status, discarded_at, discard_reason
- **Message**: session_id, role, content, timestamp, upvoted
- **KnowledgeMetadata**: source_id, source_url (Drive file tracking)
- **LearnedKnowledge**: admin-taught priority facts

### Core (core/)
- **config.py**: Settings via pydantic (from .env)
- **database.py**: SQLAlchemy engine
- **prompts.py**: LUKA_SYSTEM_PROMPT (founder persona)
- **security.py**: JWT token handling

## Key Files
- **main.py**: FastAPI app entry, routers, lifespan (background scheduler)
- **core/prompts.py**: System prompts for LLM

## Environment Variables (.env)
- DATABASE_URL
- CHROMA_DB_DIR
- OPENAI_API_KEY
- SECRET_KEY
- DRIVE_FOLDER_ID, CREDENTIALS_FILE, TOKEN_FILE

## Key Flows

### Chat Flow
1. User sends message → chat endpoint
2. Optional `!learn` command → save to `learned_knowledge` + Chroma gold
3. Resolve/create ChatSession (auth user or guest)
4. Save user message to DB
5. Safety check → reject if needed
6. RAG lookup → Chroma (gold + kb)
7. LLM generation → OpenAI GPT-4o
8. Save assistant message to DB
9. Return response

### RAG Priority
- Gold collection (admin-taught) > KB collection (Drive files)

### Admin Capabilities
- Teach priority knowledge via `!learn [fact]`
- Review sessions, mark as approved/discarded
- View analytics

## Testing
- Tests in `tests/` directory
- Run: `python run_tests.py`