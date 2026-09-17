"""
KisanFlow RAG API — minimal FastAPI server.

Returns raw retrieved chunks from the Chroma vector DB. The React app's
ragQuery tool calls this, feeds the chunks back to Gemini as tool output,
and Gemini writes the final answer. This server does NOT call any LLM.

Run:
    uv run uvicorn rag_api:app --reload --port 8000
    (or) python -m uvicorn rag_api:app --reload --port 8000

Requires: fastapi, uvicorn, chromadb, sentence-transformers
"""

import os

import chromadb
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentence_transformers import SentenceTransformer

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VECTOR_DB_PATH = os.path.join(BASE_DIR, "vector_db")
COLLECTION_NAME = "book_chunks"  # matches existing pipeline scripts — not renaming those

app = FastAPI(title="KisanFlow RAG API")

# Allow the Vite dev server (and later, the packaged app's webview origin)
# to call this endpoint directly from the browser.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten this before shipping to real users
    allow_methods=["POST"],
    allow_headers=["*"],
)

embed_model = SentenceTransformer("all-MiniLM-L6-v2")
client = chromadb.PersistentClient(path=VECTOR_DB_PATH)
collection = client.get_or_create_collection(name=COLLECTION_NAME)


class RagQuery(BaseModel):
    query: str
    top_k: int = 3


class RagChunk(BaseModel):
    text: str
    source: str | None = None


class RagResponse(BaseModel):
    chunks: list[RagChunk]


@app.post("/rag", response_model=RagResponse)
def rag_query(body: RagQuery) -> RagResponse:
    if not body.query.strip():
        return RagResponse(chunks=[])

    embedding = embed_model.encode([body.query])[0].tolist()
    results = collection.query(query_embeddings=[embedding], n_results=body.top_k)

    documents = results.get("documents", [[]])[0]
    metadatas = results.get("metadatas", [[]])[0] if results.get("metadatas") else []

    chunks: list[RagChunk] = []
    for i, doc in enumerate(documents):
        source = None
        if metadatas and i < len(metadatas) and metadatas[i]:
            source = metadatas[i].get("source")
        chunks.append(RagChunk(text=doc, source=source))

    return RagResponse(chunks=chunks)


@app.get("/health")
def health():
    return {"status": "ok", "collection": COLLECTION_NAME, "count": collection.count()}