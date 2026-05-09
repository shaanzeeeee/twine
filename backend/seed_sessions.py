import os
import random
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.sql_models import User, ChatSession, Message, Base
from core.config import settings

# Sample conversations
CONVERSATIONS = [
    {
        "guest_name": "TechRecruiter_Sarah",
        "messages": [
            ("user", "Hi Shaan, I saw your portfolio. What's the biggest challenge you faced building this Twine RAG system?"),
            ("assistant", "The biggest challenge was definitely optimizing the retrieval latency. When you have thousands of documents, standard vector search can sometimes return noise. I implemented a hybrid approach that uses both semantic similarity and keyword relevance to ensure the context injected into the LLM is high-quality."),
            ("user", "That's impressive. How do you handle cost management with Groq?"),
            ("assistant", "Groq's LPU architecture actually makes it very cost-effective compared to traditional GPU providers. I also implemented a token-limiting strategy and context-window pruning to keep each call as slim as possible without losing the persona's 'memory'."),
        ]
    },
    {
        "guest_name": "SeniorDev_Alex",
        "messages": [
            ("user", "Hey, I'm looking at your backend. Why did you choose FastAPI over something like Django?"),
            ("assistant", "I chose FastAPI primarily for its high performance and native asynchronous support. For an AI application where we're waiting on external LLM APIs, being able to handle multiple requests concurrently without blocking is critical. Plus, the Pydantic integration makes data validation incredibly clean."),
            ("user", "Makes sense. What's your strategy for scaling the vector database?"),
            ("assistant", "Currently, I'm using ChromaDB as it's great for this scale. If we needed to scale to millions of users, I'd migrate to a managed vector store like Pinecone or Weaviate to handle distributed indexing and high-throughput queries."),
        ]
    },
    {
        "guest_name": "ProjectLead_Mike",
        "messages": [
            ("user", "How does the 'Persona' aspect work? How does it actually mimic you?"),
            ("assistant", "It works through a combination of a system prompt that defines my values, expertise, and tone, and a RAG system that pulls from my actual project documentation, blogs, and code. So when it answers a technical question, it's using the same logic and examples I would use."),
            ("user", "Can I upload my own docs to it?"),
            ("assistant", "Absolutely. The Admin Dashboard has a dedicated Uploads section where you can ingest PDFs or DOCX files. The system automatically chunks them and indexes them so the persona can 'learn' new topics instantly."),
        ]
    },
    {
        "guest_name": "Curious_Explorer",
        "messages": [
            ("user", "Tell me about your favorite programming language."),
            ("assistant", "I'm a big fan of TypeScript. Having type safety in the JavaScript ecosystem is a game-changer for large-scale applications. It catches so many bugs at compile-time that would otherwise be nightmares in production."),
        ]
    }
]

def seed_data():
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        print("Error: DATABASE_URL not set.")
        return

    engine = create_engine(database_url)
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    db = SessionLocal()

    try:
        # Get first user (admin)
        admin = db.query(User).first()
        if not admin:
            print("Error: No users found. Run setup_admin.py first.")
            return

        print(f"Seeding data for user: {admin.email}")

        # Clear existing sessions for a clean look if requested (optional)
        # db.query(ChatSession).delete()
        # db.commit()

        for i, conv in enumerate(CONVERSATIONS):
            # Create session
            # Spread sessions over the last 24 hours
            created_at = datetime.now() - timedelta(hours=random.randint(0, 23), minutes=random.randint(0, 59))
            
            session = ChatSession(
                user_id=admin.id,
                guest_name=conv["guest_name"],
                review_status="reviewed" if i % 2 == 0 else "pending_review",
                created_at=created_at
            )
            db.add(session)
            db.flush() # Get session id

            for j, (role, content) in enumerate(conv["messages"]):
                # Create message
                msg_time = created_at + timedelta(minutes=j*2)
                upvoted = (role == "assistant" and random.random() > 0.6)
                
                msg = Message(
                    session_id=session.id,
                    role=role,
                    content=content,
                    timestamp=msg_time,
                    upvoted=upvoted
                )
                db.add(msg)
            
        db.commit()
        print("Seeding complete! 🚀 Check your dashboard now.")

    except Exception as e:
        print(f"An error occurred: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    seed_data()
