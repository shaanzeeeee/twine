# Twine Persona Intelligence Engine - Documentation

## 1. Project Overview

Twine is a sophisticated Retrieval-Augmented Generation (RAG) chatbot system designed to provide intelligent, persona-driven answers using a hybrid knowledge base built from Google Drive documents and real-time admin teaching. It includes:

- **Advanced FastAPI Backend**: Handles high-performance RAG, secure authentication, and complex data integrations.
- **Cyber-Industrial Admin Dashboard**: A premium React interface for session review, monitoring, and real-time knowledge curation.
- **Hybrid Vector Architecture**: Utilizes ChromaDB with OpenAI embeddings for both general knowledge and prioritized "Gold" facts.
- **Deep Drive Integration**: Automatically ingests and indexes DOCX/PDF content from specified Google Drive repositories.
- **Secure JWT Auth**: Enterprise-grade authentication for administrative access and dashboard control.

---

## 2. Key Features

- **High-Fidelity Persona Engine**: RAG assistant with adaptive founder tone and strict safety guardrails.
- **Seamless Guest Interaction**: Frictionless chat support for public users with full session persistence.
- **Advanced Knowledge Curation**: Real-time `!learn` commands for admins to inject prioritized facts instantly.
- **Dual-Collection Retrieval**: Intelligent routing between general knowledge and high-priority admin-taught facts.
- **Premium Analytics**: Industrial-grade data visualization for tracking engine performance and session quality.

---

## 3. Architecture

### Intelligence Flow

```
User -> Frontend/API -> ChatService -> Hybrid RAG Lookup -> OpenAI -> Persona Response
                                |
                                +--> PostgreSQL (Sessions, Messages, Knowledge Graphs)
```

### Core Modules

- `backend/api/`: Modular API routes for chat, auth, and dashboard management.
- `backend/services/`: Engine logic including Drive ingestion, Vector Ops, and Persona synthesis.
- `backend/models/sql_models.py`: Optimized SQLAlchemy schemas for persistent memory.
- `backend/core/`: Security protocols, RAG prompts, and engine configuration.
- `frontend/src/`: Premium React application featuring advanced glassmorphism and industrial UI components.

---

## 4. Technical Stack

### Backend
- **Framework**: FastAPI (Async-first)
- **Database**: PostgreSQL (Structured Memory)
- **Vector Store**: ChromaDB (Semantic Memory)
- **AI Models**: OpenAI GPT-4o & text-embedding-3-small
- **Auth**: JWT with HS256

### Frontend
- **Framework**: React 18 with Vite
- **Styling**: Tailwind CSS (Custom Industrial Design System)
- **Visualization**: Recharts (Modernized for Twine)
- **Icons**: Lucide React

---

## 5. Deployment Architecture

Twine is designed for high-availability cloud deployment:

- **Frontend**: Globally distributed via **Vercel Edge**.
- **Backend**: Hosted on **Render** (Production-grade instances).
- **Database**: **Neon PostgreSQL** (Serverless scaling).
- **Environment**: Managed via centralized `.env` configuration.

---

## 6. Setup & Development

### Local Engine Setup

1. **Python Environment**:
   ```bash
   cd backend
   python -m venv .venv
   .\.venv\Scripts\activate
   pip install -r requirements.txt
   ```
2. **Frontend Development**:
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
3. **Knowledge Base Sync**:
   ```bash
   python scripts/setup_drive.py
   ```

---

## 7. Admin Credentials
The default administrator account is configured for system management:
- **Email**: `admin@twine.app`
- **Role**: `Admin`

---

## 8. Development Philosophy
Twine is built with an "Industrial-Sleek" design philosophy, prioritizing depth, high-contrast readability, and data-rich interfaces. Every interaction is designed to feel like a high-end intelligence tool.

---
© 2026 Twine Intelligence Engine
