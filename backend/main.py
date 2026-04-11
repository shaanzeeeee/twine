import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from apscheduler.schedulers.background import BackgroundScheduler

from backend.core.config import settings
from backend.models.sql_models import Base
from backend.api import chat, auth, admin
from backend.services.drive_sync import sync_drive_to_chroma
from backend.core.database import engine

# Database setup
Base.metadata.create_all(bind=engine)

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

app = FastAPI(title=settings.PROJECT_NAME, lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(chat.router)
app.include_router(auth.router)
app.include_router(admin.router)

@app.get("/health")
def health_check():
    return {"status": "ok", "project": settings.PROJECT_NAME}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host="0.0.0.0", port=8000, reload=True)
