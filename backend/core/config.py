import os
from pathlib import Path
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "Twine"
    
    # Database (PostgreSQL)
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql://user:password@localhost:5432/twine")
    
    # ChromaDB
    CHROMA_DB_DIR: str = os.getenv("CHROMA_DB_DIR", "./chroma_data")
    
    # Groq (LLM Provider)
    GROQ_API_KEY: str = os.getenv("GROQ_API_KEY", "")
    LLM_CHAT_MODEL: str = os.getenv("LLM_CHAT_MODEL", "llama-3.3-70b-versatile")
    LLM_SAFETY_MODEL: str = os.getenv("LLM_SAFETY_MODEL", "llama-3.1-8b-instant")
    
    # Legacy OpenAI support (for embeddings in ChromaDB)
    OPENAI_API_KEY: str = os.getenv("OPENAI_API_KEY", "")
    CHROMA_OPENAI_API_KEY: str = os.getenv("CHROMA_OPENAI_API_KEY", "")
    
    # Persona Configuration
    PERSONA_NAME: str = os.getenv("PERSONA_NAME", "Twine Assistant")
    PERSONA_DESCRIPTION: str = os.getenv("PERSONA_DESCRIPTION", "A knowledgeable AI persona that responds based on the uploaded knowledge base.")
    PERSONA_INSTRUCTIONS: str = os.getenv("PERSONA_INSTRUCTIONS", "Be helpful, concise, and accurate. Always ground your answers in the provided context.")
    
    # Security Context
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-for-development-change-in-prod")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    
    # Drive Sync settings
    DRIVE_FOLDER_ID: str = os.getenv("DRIVE_FOLDER_ID", "")
    CREDENTIALS_FILE: str = os.getenv("CREDENTIALS_FILE", "credentials.json")
    TOKEN_FILE: str = os.getenv("TOKEN_FILE", "token.json")

    # CORS — frontend URL for production
    FRONTEND_URL: str = os.getenv("FRONTEND_URL", "http://localhost:5173")

    class Config:
        env_file = str(Path(__file__).resolve().parents[1] / ".env")
        env_file_encoding = "utf-8"

settings = Settings()
