# LukaBot RAG System: Complete Walkthrough

This guide provides a deep dive into the architecture, setup, and operation of the LukaBot RAG (Retrieval-Augmented Generation) system.

---

## 🏗️ Architectural Overview

The LukaBot system is built as a decoupled full-stack application centered around the RAG pattern.

### The "Brain" (Retrieval-Augmented Generation)
1.  **Ingestion**: Documents reside in a specific **Google Drive** folder.
2.  **Indexing**: The `drive_sync.py` service periodically checks for updates, downloads PDF/DOCX files, and chunks them.
3.  **Vectorization**: Chunks are converted into embeddings using **OpenAI** and stored in a local **ChromaDB** instance.
4.  **Retrieval**: When a user asks a question, the system queries ChromaDB for relevant context.
5.  **Generation**: The context is combined with the user query and sent to an OpenAI model to generate an informed response.

### The Ecosystem
-   **Dashboard (React)**: An interface for administrators to monitor conversations.
-   **Database (PostgreSQL)**: Handles persistent user data and chat transcripts (separate from the vector store).
-   **Auth**: Custom JWT implementation ensuring only authorized users can modify the knowledge base or view private logs.

---

## 🛠️ Step-by-Step Setup Guide

### 1. Google Cloud Configuration
To enable Google Drive synchronization:
1.  Go to the [Google Cloud Console](https://console.cloud.google.com/).
2.  Create a new project.
3.  Enable the **Google Drive API**.
4.  Configure the **OAuth Consent Screen** (Internal use).
5.  Go to **Credentials**, create an **OAuth 2.0 Client ID** (Desktop app).
6.  Download the JSON and rename it to `credentials.json`, then place it in the project root.

### 2. Database Initialization
Ensure PostgreSQL is running and create the database:
```sql
CREATE DATABASE lukabot;
```

### 3. Running the Sync Script
Run the initialization script to authenticate your Google account:
```bash
python scripts/setup_drive.py
```
This will open a browser window for login and generate `token.json`.

---

## 🖱️ Admin Operations

### Monitoring Chats
Navigate to the **Admin Dashboard** (`/admin`) to view real-time chat transcripts. Each message is logged with specific metadata:
-   **Timestamp**
-   **User Query**
-   **Bot Response**
-   **Sentiment/Upvote Status**

### Knowledge Base Curation
The system allows admins to "upvote" or "downvote" responses. In the background, this feedback can be used to re-rank chunks or adjust the prompt templates in `backend/core/prompts.py`.

---

## 📈 Future Enhancements

-   **Multi-folder Sync**: Support for multiple Drive folders with category tags.
-   **Streaming Responses**: WebSockets implementation for faster "typing" effect in UI.
-   **Custom Models**: Integration with HuggingFace or locally hosted Ollama instances.
-   **Advanced Analytics**: Visualizing common query themes and knowledge gaps.

---

## ❓ Troubleshooting

-   **Sync Failures**: Verify your `DRIVE_FOLDER_ID` is correct and publicly accessible (or shared with the client ID email).
-   **ChromaDB Errors**: Ensure the `CHROMA_DB_DIR` has write permissions in your environment.
-   **Auth Issues**: If you lose your admin password, you can re-run `backend/setup_admin.py` with a new email/password combination.
