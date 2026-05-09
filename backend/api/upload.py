"""File upload API for ingesting documents into the knowledge base."""
import os
import uuid
from pathlib import Path
from datetime import datetime

from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from backend.api.deps import get_current_admin_user
from backend.services.chroma_service import chroma_service

router = APIRouter(prefix="/admin", tags=["upload"])

UPLOAD_DIR = Path(__file__).resolve().parents[1] / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}


def extract_text(file_path: Path) -> str:
    """Extract text content from a supported file."""
    suffix = file_path.suffix.lower()

    if suffix == ".txt":
        return file_path.read_text(encoding="utf-8", errors="ignore")

    if suffix == ".pdf":
        import fitz  # pymupdf
        doc = fitz.open(str(file_path))
        text_parts = [page.get_text() for page in doc]
        doc.close()
        return "\n".join(text_parts)

    if suffix == ".docx":
        from docx import Document
        doc = Document(str(file_path))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())

    raise ValueError(f"Unsupported file type: {suffix}")


@router.post("/upload")
async def upload_file(
    file: UploadFile = File(...),
    _user=Depends(get_current_admin_user),
):
    """Upload a document and index its content into ChromaDB."""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Unsupported file type. Allowed: {', '.join(ALLOWED_EXTENSIONS)}")

    file_id = str(uuid.uuid4())[:8]
    safe_name = f"{file_id}_{file.filename}"
    dest = UPLOAD_DIR / safe_name

    content = await file.read()
    dest.write_bytes(content)

    try:
        text = extract_text(dest)
        if not text.strip():
            raise HTTPException(400, "File contains no extractable text.")

        # Chunk the text into ~1000 char segments for better retrieval
        chunks = _chunk_text(text, chunk_size=1000, overlap=100)

        ids = [f"upload-{file_id}-{i}" for i in range(len(chunks))]
        metadatas = [{"source": file.filename, "upload_id": file_id, "chunk": i} for i in range(len(chunks))]

        chroma_service.add_to_kb(ids=ids, documents=chunks, metadatas=metadatas)

        return {
            "status": "success",
            "file_id": file_id,
            "filename": file.filename,
            "chunks_indexed": len(chunks),
            "uploaded_at": datetime.utcnow().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        dest.unlink(missing_ok=True)
        raise HTTPException(500, f"Failed to process file: {str(e)}")


@router.get("/uploads")
async def list_uploads(_user=Depends(get_current_admin_user)):
    """List all uploaded files."""
    files = []
    for f in sorted(UPLOAD_DIR.iterdir(), key=lambda x: x.stat().st_mtime, reverse=True):
        if f.is_file():
            parts = f.name.split("_", 1)
            file_id = parts[0] if len(parts) > 1 else f.stem
            original_name = parts[1] if len(parts) > 1 else f.name
            files.append({
                "file_id": file_id,
                "filename": original_name,
                "size_bytes": f.stat().st_size,
                "uploaded_at": datetime.fromtimestamp(f.stat().st_mtime).isoformat(),
            })
    return {"files": files}


@router.delete("/uploads/{file_id}")
async def delete_upload(file_id: str, _user=Depends(get_current_admin_user)):
    """Delete an uploaded file and its ChromaDB entries."""
    # Find the file
    matched = [f for f in UPLOAD_DIR.iterdir() if f.name.startswith(f"{file_id}_")]
    if not matched:
        raise HTTPException(404, "Upload not found")

    for f in matched:
        f.unlink(missing_ok=True)

    # Remove from ChromaDB — delete all chunks with this upload_id
    try:
        kb = chroma_service.kb_collection
        kb.delete(where={"upload_id": file_id})
    except Exception:
        pass  # Best-effort cleanup

    return {"status": "deleted", "file_id": file_id}


def _chunk_text(text: str, chunk_size: int = 1000, overlap: int = 100) -> list[str]:
    """Split text into overlapping chunks."""
    chunks = []
    start = 0
    while start < len(text):
        end = start + chunk_size
        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)
        start = end - overlap
    return chunks if chunks else [text[:chunk_size]]
