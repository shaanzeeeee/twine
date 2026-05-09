import os
import sys
from pathlib import Path

# Add project root to path so we can import backend modules
PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.services.drive_sync import sync_drive_to_chroma
from backend.core.config import settings

def run_sync():
    print(f"🚀 Starting Twine Intelligence Sync...")
    print(f"📂 Target Folder ID: {settings.DRIVE_FOLDER_ID}")
    
    try:
        sync_drive_to_chroma()
        print("✅ Sync completed successfully.")
    except Exception as e:
        print(f"❌ Sync failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    run_sync()
