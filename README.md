# LukaBot RAG System

A production-ready Retrieval-Augmented Generation (RAG) chatbot system featuring real-time Google Drive synchronization, a FastAPI backend, and a modern React admin dashboard.

## 🚀 Features

- **RAG Chat Interface**: Intelligent responses powered by OpenAI embeddings and custom knowledge base.
- **Google Drive Sync**: Automatically index documents (PDF, DOCX) from a specific Google Drive folder.
- **Admin Dashboard**: Manage chat transcripts, upvote/downvote responses, and curate the knowledge base.
- **JWT Authentication**: Secure access for admin users.
- **Persistence**: Hybrid storage using PostgreSQL for transcripts/users and ChromaDB for vector data.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.9+, FastAPI, SQLAlchemy, PostgreSQL, ChromaDB, OpenAI API.
- **Frontend**: React 19, Vite, Tailwind CSS (v4), Axios, Lucide Icons.
- **Cloud/Services**: Google Drive API, Google Cloud Console.

---

## 📂 Project Structure

```text
├── backend/                # FastAPI application
│   ├── api/                # API routes (auth, chat, admin)
│   ├── core/               # Configuration and security settings
│   ├── models/             # SQLAlchemy database models
│   ├── services/           # Business logic (Drive sync, ChromaDB, Chat)
│   └── main.py             # App entry point
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # UI components
│   │   ├── context/        # Auth state management
│   │   ├── pages/          # Login and Admin views
│   │   └── services/       # API integration
│   └── vite.config.js
├── scripts/                # Helper scripts (Drive setup, etc.)
└── .gitignore              # Git exclusion rules
```

---

## ⚙️ Setup & Configuration

### 1. Prerequisites
- **Python 3.9+**
- **Node.js 18+**
- **PostgreSQL** instance
- **Google Cloud Project** with Drive API enabled

### 2. Backend Setup
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 3. Environment Variables
Create a `.env` file in the root directory:
```env
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/lukabot

# Vectors
CHROMA_DB_DIR=./chroma_data

# OpenAI
OPENAI_API_KEY=your_openai_api_key_here

# Google Drive
DRIVE_FOLDER_ID=your_google_drive_folder_id
CREDENTIALS_FILE=credentials.json
TOKEN_FILE=token.json

# Security
SECRET_KEY=your_secure_random_key
```

### 4. Google API Setup
- Place your `credentials.json` from Google Cloud Console in the root.
- Run `python scripts/setup_drive.py` to authorize and generate `token.json`.

### 5. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

---

## 🖥️ Usage

### Running Locally
1. Start the backend: `python backend/main.py`
2. Start the frontend: `npm run dev`
3. Setup Admin User: Run `python backend/setup_admin.py` while the server is running to create the default account (`admin@lukabot.com` / `password123`).

---

## 🛡️ Security
- All sensitive credentials are excluded via `.gitignore`.
- JWT tokens expire every 30 minutes.
- Password hashing is handled via `passlib[bcrypt]`.
