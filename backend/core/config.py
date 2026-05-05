import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "LukaBot"
    
    # Database (PostgreSQL)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/lukabot")
    
    # ChromaDB
    CHROMA_DB_DIR: str = os.getenv("CHROMA_DB_DIR", "./chroma_data")
    
    # OpenAI
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    CHROMA_OPENAI_API_KEY: str = os.getenv("CHROMA_OPENAI_API_KEY", "")
    
    # Security Context
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-for-development-change-in-prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Drive Sync settings
    DRIVE_FOLDER_ID: str = os.getenv("DRIVE_FOLDER_ID", "")
    CREDENTIALS_FILE: str = os.getenv("CREDENTIALS_FILE", "credentials.json")
    TOKEN_FILE: str = os.getenv("TOKEN_FILE", "token.json")

    # Zulip integration
    ZULIP_SITE_URL: str = os.getenv("ZULIP_SITE_URL", "")
    ZULIP_BOT_EMAIL: str = os.getenv("ZULIP_BOT_EMAIL", "")
    ZULIP_API_KEY: str = os.getenv("ZULIP_API_KEY", "")

    class Config:
        env_file = str(Path(__file__).resolve().parents[1] / ".env")
        env_file_encoding = "utf-8"

settings = Settings()
