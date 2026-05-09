import chromadb
from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction
from backend.core.config import settings

class ChromaService:
    def __init__(self):
        self.client = chromadb.PersistentClient(path=settings.CHROMA_DB_DIR)
        self.embedding_function = OpenAIEmbeddingFunction(
            api_key=settings.OPENAI_API_KEY,
            model_name="text-embedding-3-small"
        )
        
        # Collection for standard Knowledge Base (from Google Drive + uploads)
        self.kb_collection = self.client.get_or_create_collection(
            name="twine_kb",
            embedding_function=self.embedding_function
        )
        
        # Collection for "Gold Standard" upvoted transcripts
        self.gold_collection = self.client.get_or_create_collection(
            name="twine_gold",
            embedding_function=self.embedding_function
        )

    def add_documents(self, collection_name: str, documents: list[str], metadatas: list[dict], ids: list[str]):
        collection = self.kb_collection if collection_name == "kb" else self.gold_collection
        collection.upsert(
            documents=documents,
            metadatas=metadatas,
            ids=ids
        )
        
    def query_documents(self, query: str, n_results: int = 3):
        # We query both and prioritize gold collection results
        gold_results = self.gold_collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        kb_results = self.kb_collection.query(
            query_texts=[query],
            n_results=n_results
        )
        
        return {
            "gold": gold_results,
            "kb": kb_results
        }

    def add_to_kb(self, ids: list[str], documents: list[str], metadatas: list[dict] = None):
        """Add documents directly to the knowledge base collection."""
        self.kb_collection.upsert(
            documents=documents,
            metadatas=metadatas or [{} for _ in documents],
            ids=ids
        )

chroma_service = ChromaService()
