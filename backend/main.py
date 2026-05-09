import os
import sys
from pathlib import Path
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy import inspect, text

# Support both launch styles:
# 1) repo root: python -m uvicorn backend.main:app
# 2) backend dir: python -m uvicorn main:app
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.core.config import settings
from backend.models.sql_models import Base
from backend.api import chat, auth, admin
from backend.api.upload import router as upload_router
from backend.services.drive_sync import sync_drive_to_chroma
from backend.core.database import engine

# Database setup
Base.metadata.create_all(bind=engine)


def ensure_runtime_schema():
    """Apply minimal additive schema updates for local/dev environments."""
    inspector = inspect(engine)
    if "chat_sessions" not in inspector.get_table_names():
        return

    column_names = {column["name"] for column in inspector.get_columns("chat_sessions")}
    with engine.begin() as connection:
        if "guest_name" not in column_names:
            connection.execute(text("ALTER TABLE chat_sessions ADD COLUMN guest_name VARCHAR(100)"))
        if "review_status" not in column_names:
            connection.execute(text("ALTER TABLE chat_sessions ADD COLUMN review_status VARCHAR(50) DEFAULT 'pending_review'"))
        if "discarded_at" not in column_names:
            connection.execute(text("ALTER TABLE chat_sessions ADD COLUMN discarded_at TIMESTAMP"))
        if "discard_reason" not in column_names:
            connection.execute(text("ALTER TABLE chat_sessions ADD COLUMN discard_reason VARCHAR(255)"))

        # Performance indexes for transcript and analytics queries.
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_chat_sessions_created_status ON chat_sessions(created_at, review_status)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_messages_session_timestamp ON messages(session_id, timestamp)"))
        connection.execute(text("CREATE INDEX IF NOT EXISTS ix_messages_session_role_timestamp ON messages(session_id, role, timestamp)"))


ensure_runtime_schema()

scheduler = BackgroundScheduler()

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Start the background scheduler for Google Drive Sync
    scheduler.add_job(sync_drive_to_chroma, 'interval', minutes=60)
    scheduler.start()
    print("Background scheduler started: Drive sync running every 60 minutes.")
    yield
    # Shutdown
    scheduler.shutdown()
    print("Background scheduler shut down.")

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan, root_path="/api")

# CORS — allow the frontend origin in production
allowed_origins = [
    settings.FRONTEND_URL,
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
]
# Also allow any Vercel preview URLs
if settings.FRONTEND_URL and "vercel.app" in settings.FRONTEND_URL:
    allowed_origins.append("https://*.vercel.app")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(upload_router)

@app.get("/health")
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
