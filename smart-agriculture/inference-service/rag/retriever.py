import logging
from typing import List, Dict, Optional

from .embedding import EmbeddingModel
from .vector_store import VectorStore

logger = logging.getLogger(__name__)


class Retriever:
    """检索器类 - 整合嵌入模型和向量存储"""

    def __init__(self, embedding_model: EmbeddingModel, vector_store: VectorStore):
        self.embedding_model = embedding_model
        self.vector_store = vector_store

    def retrieve(self, query: str, top_k: int = 5) -> List[Dict]:
        query_vector = self.embedding_model.encode_single(query)
        results = self.vector_store.search(query_vector, top_k=top_k)
        logger.info(f"检索完成: query='{query}', 返回 {len(results)} 条结果")
        return results

    def build_index(self, documents: List[Dict]):
        if not documents:
            logger.warning("没有文档需要索引")
            return
        texts = [doc.get("content", "") for doc in documents]
        logger.info(f"开始向量化 {len(texts)} 个文本块...")
        vectors = self.embedding_model.encode(texts)
        metadata = []
        for doc in documents:
            metadata.append({
                "title": doc.get("title", ""),
                "content": doc.get("content", ""),
                "source": doc.get("source", ""),
                "chunk_index": doc.get("chunk_index", 0),
            })
        self.vector_store.add_vectors(vectors, metadata)
        logger.info(f"索引构建完成, 总文档数: {self.vector_store.get_size()}")

    def save_index(self, path: str):
        self.vector_store.save(path)

    def load_index(self, path: str):
        self.vector_store.load(path)

    def clear_index(self):
        self.vector_store.clear()

    def get_index_size(self) -> int:
        return self.vector_store.get_size()
