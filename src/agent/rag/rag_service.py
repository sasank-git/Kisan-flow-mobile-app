# rag_service.py — run separately: uvicorn rag_service:app --host 0.0.0.0 --port 8000
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer
import chromadb

app = FastAPI()
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])

model = SentenceTransformer('all-MiniLM-L6-v2')
client = chromadb.PersistentClient(path='vector_db/')
collection = client.get_or_create_collection(name='book_chunks')

class RagRequest(BaseModel):
    query: str
    top_k: int = 4

@app.post("/rag")
def rag_query(req: RagRequest):
    embedding = model.encode([req.query]).tolist()
    results = collection.query(query_embeddings=embedding, n_results=req.top_k)

    docs = results.get('documents', [[]])[0]
    metas = results.get('metadatas', [[]])[0]

    if not docs:
        return {"answer_context": "", "sources": []}

    context = "\n\n---\n\n".join(docs)
    sources = [m.get('book', 'unknown') for m in metas]
    return {"answer_context": context, "sources": list(set(sources))}