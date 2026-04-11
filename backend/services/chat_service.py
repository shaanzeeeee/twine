from openai import OpenAI
from backend.core.config import settings
from backend.core.prompts import LUKA_SYSTEM_PROMPT, SAFETY_CHECK_PROMPT
from backend.services.chroma_service import chroma_service

class ChatService:
    def __init__(self):
        self.client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def is_safe(self, user_message: str) -> bool:
        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": SAFETY_CHECK_PROMPT},
                {"role": "user", "content": user_message}
            ],
            max_tokens=10,
            temperature=0.0
        )
        answer = response.choices[0].message.content.strip().upper()
        return answer == "SAFE"

    def get_response(self, user_message: str, history: list[dict] = None) -> str:
        if not history:
            history = []
            
        # Step 1: Safety Check
        if not self.is_safe(user_message):
            return "I can’t help with confidential compensation or private employee-specific evaluations. I can help with the framework, policy, KPI logic, or a general strategy instead."

        # Step 2: RAG Lookup
        # Combine last few messages to give context for search
        search_query = user_message
        if history:
            search_query = f"{history[-1]['content']} {user_message}"
            
        docs = chroma_service.query_documents(search_query)
        gold_docs = docs["gold"]["documents"][0] if docs["gold"]["documents"] else []
        kb_docs = docs["kb"]["documents"][0] if docs["kb"]["documents"] else []
        
        # Combine context
        context_str = "\n".join(gold_docs + kb_docs)
        
        # Step 3: LLM Generation
        messages = [
            {"role": "system", "content": LUKA_SYSTEM_PROMPT},
            {"role": "system", "content": f"Context Knowledge Base:\n{context_str}"}
        ]
        
        # Add conversation history
        for msg in history:
            messages.append({"role": msg["role"], "content": msg["content"]})
            
        messages.append({"role": "user", "content": user_message})

        response = self.client.chat.completions.create(
            model="gpt-4o",
            messages=messages,
            temperature=0.7
        )
        
        return response.choices[0].message.content

chat_service = ChatService()
