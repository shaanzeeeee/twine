import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.sql_models import ChatSession, Message, User

def diagnose():
    db_url = os.getenv("DATABASE_URL")
    engine = create_engine(db_url)
    Session = sessionmaker(bind=engine)
    db = Session()

    try:
        users = db.query(User).all()
        print(f"--- Users ---")
        for u in users:
            print(f"ID: {u.id}, Email: {u.email}")

        sessions = db.query(ChatSession).all()
        print(f"\n--- Sessions ({len(sessions)} total) ---")
        for s in sessions:
            msgs = db.query(Message).filter(Message.session_id == s.id).all()
            print(f"ID: {s.id}, UserID: {s.user_id}, Guest: {s.guest_name}, Msgs: {len(msgs)}, Status: {s.review_status}, Discarded: {s.discarded_at}")
            if msgs:
                print(f"  First Msg: {msgs[0].content[:50]}...")
    finally:
        db.close()

if __name__ == "__main__":
    diagnose()
