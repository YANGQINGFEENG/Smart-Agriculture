import os
import logging
from typing import List, Optional
from pydantic import BaseModel
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import uvicorn

from rag.embedding import EmbeddingModel
from rag.vector_store import VectorStore
from rag.document_loader import DocumentLoader
from rag.text_splitter import TextSplitter
from rag.retriever import Retriever

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="RAG检索服务")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

EMBEDDING_MODEL = os.environ.get("EMBEDDING_MODEL", "BAAI/bge-small-zh-v1.5")
FAISS_INDEX_PATH = os.environ.get("FAISS_INDEX_PATH", "/app/data/index.faiss")

embedding_model = EmbeddingModel(model_name=EMBEDDING_MODEL)
vector_store = VectorStore(dimension=512)
document_loader = DocumentLoader()
text_splitter = TextSplitter(chunk_size=500, chunk_overlap=50)
retriever = Retriever(embedding_model=embedding_model, vector_store=vector_store)


class RagQueryRequest(BaseModel):
    query: str
    top_k: int = 5
    template_id: Optional[int] = None


class AddDocumentsRequest(BaseModel):
    documents: List[dict]


class BuildIndexRequest(BaseModel):
    force_rebuild: bool = False


class EmbedRequest(BaseModel):
    texts: List[str]


@app.on_event("startup")
async def startup_event():
    if os.path.exists(FAISS_INDEX_PATH):
        try:
            retriever.load_index(FAISS_INDEX_PATH)
            logger.info(f"已加载索引, 文档数: {retriever.get_index_size()}")
        except Exception as e:
            logger.warning(f"索引加载失败: {e}")


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_name": EMBEDDING_MODEL,
        "index_size": retriever.get_index_size(),
        "index_path": FAISS_INDEX_PATH,
    }


@app.post("/rag/query")
async def rag_query(request: RagQueryRequest):
    try:
        results = retriever.retrieve(request.query, top_k=request.top_k)
        return {
            "success": True,
            "data": {
                "query": request.query,
                "retrieved_knowledge": results,
                "total_results": len(results),
            }
        }
    except Exception as e:
        logger.error(f"RAG检索失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/build-index")
async def build_index(request: BuildIndexRequest):
    try:
        if request.force_rebuild:
            retriever.clear_index()
        return {
            "success": True,
            "data": {
                "index_size": retriever.get_index_size(),
                "message": "索引构建完成",
            }
        }
    except Exception as e:
        logger.error(f"索引构建失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/add-documents")
async def add_documents(request: AddDocumentsRequest):
    try:
        chunks = text_splitter.split_documents(request.documents)
        retriever.build_index(chunks)
        retriever.save_index(FAISS_INDEX_PATH)
        return {
            "success": True,
            "data": {
                "added_chunks": len(chunks),
                "total_index_size": retriever.get_index_size(),
            }
        }
    except Exception as e:
        logger.error(f"文档添加失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/embed")
async def embed_text(request: EmbedRequest):
    try:
        vectors = embedding_model.encode(request.texts)
        return {
            "success": True,
            "data": {
                "vectors": vectors,
                "dimension": len(vectors[0]) if vectors else 0,
            }
        }
    except Exception as e:
        logger.error(f"向量化失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/rag/clear-index")
async def clear_index():
    try:
        retriever.clear_index()
        return {"success": True, "message": "索引已清空"}
    except Exception as e:
        logger.error(f"清空索引失败: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    os.makedirs(os.path.dirname(FAISS_INDEX_PATH), exist_ok=True)
    uvicorn.run(app, host="0.0.0.0", port=5001)
