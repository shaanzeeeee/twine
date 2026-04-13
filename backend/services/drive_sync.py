import os
import io
import fitz  # PyMuPDF
import docx
import base64
from openai import OpenAI
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload
from backend.core.config import settings
from backend.services.chroma_service import chroma_service

SCOPES = ['https://www.googleapis.com/auth/drive.readonly']
PDF_TEXT_FALLBACK_MIN_CHARS = 100
GOOGLE_DRIVE_FOLDER_MIME = 'application/vnd.google-apps.folder'

def get_drive_service():
    creds = None
    if os.path.exists(settings.TOKEN_FILE):
        creds = Credentials.from_authorized_user_file(settings.TOKEN_FILE, SCOPES)
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            creds.refresh(Request())
        else:
            raise Exception("Google Drive Credentials not valid. Run scripts/setup_drive.py first.")
    return build('drive', 'v3', credentials=creds)

def list_drive_files_recursive(service, root_folder_id):
    files = []
    folders_to_visit = [root_folder_id]

    while folders_to_visit:
        folder_id = folders_to_visit.pop()
        query = f"'{folder_id}' in parents and trashed = false"
        page_token = None

        while True:
            results = service.files().list(
                q=query,
                fields="nextPageToken, files(id, name, mimeType, webViewLink)",
                pageToken=page_token,
            ).execute()

            for item in results.get('files', []):
                if item['mimeType'] == GOOGLE_DRIVE_FOLDER_MIME:
                    folders_to_visit.append(item['id'])
                else:
                    files.append(item)

            page_token = results.get('nextPageToken')
            if not page_token:
                break

    return files

def extract_text_from_pdf(file_bytes):
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    page_texts = []

    for page_num, page in enumerate(doc, start=1):
        extracted_text = page.get_text("text").strip()

        # OCR fallback for scanned/image-heavy PDF pages with little selectable text.
        if len(extracted_text) < PDF_TEXT_FALLBACK_MIN_CHARS:
            try:
                pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
                image_bytes = pix.tobytes("png")
                ocr_text = extract_text_from_image(image_bytes, "image/png", client=openai_client)
                if ocr_text and ocr_text.strip():
                    extracted_text = f"{extracted_text}\n\n[OCR page {page_num}]\n{ocr_text}".strip()
            except Exception as ocr_err:
                print(f"OCR fallback failed on page {page_num}: {ocr_err}")

        if extracted_text:
            page_texts.append(f"[Page {page_num}]\n{extracted_text}")

    return "\n\n".join(page_texts)

def extract_text_from_docx(file_bytes):
    doc = docx.Document(io.BytesIO(file_bytes))
    return "\n".join([para.text for para in doc.paragraphs])

def extract_text_from_image(file_bytes, mime_type, client=None):
    client = client or OpenAI(api_key=settings.OPENAI_API_KEY)
    base64_image = base64.b64encode(file_bytes).decode('utf-8')
    
    response = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "Extract all text from this image and clearly describe any instructions, charts, or references. Output the extracted text and detailed description in markdown format."},
                    {"type": "image_url", "image_url": {"url": f"data:{mime_type};base64,{base64_image}"}}
                ]
            }
        ],
        max_tokens=1000
    )
    return response.choices[0].message.content

def chunk_text(text, chunk_size=2000):
    chunks = []
    lines = text.split('\n')
    current_chunk = ""
    for line in lines:
        if len(current_chunk) + len(line) > chunk_size:
            chunks.append(current_chunk)
            current_chunk = line + "\n"
        else:
            current_chunk += line + "\n"
    if current_chunk:
        chunks.append(current_chunk)
    return chunks

def sync_drive_to_chroma():
    try:
        service = get_drive_service()
        # Query files in the specific folder
        folder_id = settings.DRIVE_FOLDER_ID
        if not folder_id:
            print("No DRIVE_FOLDER_ID set. Skipping sync.")
            return

        items = list_drive_files_recursive(service, folder_id)

        for item in items:
            file_id = item['id']
            file_name = item['name']
            mime_type = item['mimeType']
            
            # Handle Native Google Workspace files differently than binary files
            if mime_type.startswith('application/vnd.google-apps.'):
                if mime_type in ['application/vnd.google-apps.document', 'application/vnd.google-apps.presentation']:
                    request = service.files().export_media(fileId=file_id, mimeType='text/plain')
                    mime_type = 'text/plain' # Spoof the mimetype so the downstream processor treats it as text
                elif mime_type == 'application/vnd.google-apps.spreadsheet':
                    request = service.files().export_media(fileId=file_id, mimeType='text/csv')
                    mime_type = 'text/csv' # Spoof internal handling
                else:
                    print(f"Skipping unsupported Google Apps format: {mime_type}")
                    continue
            else:
                # Standard binary Download
                request = service.files().get_media(fileId=file_id)
            
            fh = io.BytesIO()
            downloader = MediaIoBaseDownload(fh, request)
            done = False
            while done is False:
                status, done = downloader.next_chunk()
            
            file_bytes = fh.getvalue()
            text_content = ""
            
            try:
                if mime_type == 'application/pdf':
                    text_content = extract_text_from_pdf(file_bytes)
                elif mime_type == 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
                    text_content = extract_text_from_docx(file_bytes)
                elif mime_type in ['text/plain', 'text/csv']:
                    text_content = file_bytes.decode('utf-8', errors='ignore')
                elif mime_type.startswith('image/'):
                    text_content = extract_text_from_image(file_bytes, mime_type)
                else:
                    continue # Skip unsupported formats
            except Exception as extract_err:
                print(f"Failed to extract text from {file_name}: {extract_err}")
                continue

            if text_content and text_content.strip():
                # We chunk the document so the Vector Store doesn't truncate large strings
                chunks = chunk_text(text_content.strip())
                documents = chunks
                metadatas = [{"source": item['webViewLink'], "filename": file_name} for _ in chunks]
                ids = [f"{file_id}_{i}" for i in range(len(chunks))]

                chroma_service.add_documents(
                    collection_name="kb",
                    documents=documents,
                    metadatas=metadatas,
                    ids=ids
                )
        print("Drive sync completed successfully.")
        return {"status": "success", "message": "Drive sync completed successfully", "docs_indexed": len(items)}
    except Exception as e:
        print(f"Error during Drive Sync: {e}")
        return {"status": "error", "message": str(e)}
