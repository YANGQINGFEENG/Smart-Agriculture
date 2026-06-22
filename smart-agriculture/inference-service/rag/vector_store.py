import os
import json
import logging
import numpy as np
from typing import List, Dict, Optional

logger = logging.getLogger(__name__)


class VectorStore:
    """FAISS向量存储类"""

    def __init__(self, dimension: int = 512):
        self.dimension = dimension
        self.index = None
        self.metadata: List[Dict] = []
        self.index_path: Optional[str] = None

    def _ensure_index(self):
        if self.index is not None:
            return
        try:
            import faiss
            self.index = faiss.IndexFlatIP(self.dimension)
            logger.info(f"FAISS索引初始化成功, 维度: {self.dimension}")
        except ImportError:
            logger.warning("FAISS未安装, 使用numpy实现简单相似度搜索")
            self.index = None

    def add_vectors(self, vectors: List[List[float]], metadata: List[Dict]):
        self._ensure_index()
        if not vectors:
            return
        vectors_np = np.array(vectors, dtype=np.float32)
        if self.index is not None:
            import faiss
            faiss.normalize_L2(vectors_np)
            self.index.add(vectors_np)
        self.metadata.extend(metadata)

    def search(self, query_vector: List[float], top_k: int = 5) -> List[Dict]:
        self._ensure_index()
        if not self.metadata:
            return []
        query_np = np.array([query_vector], dtype=np.float32)
        if self.index is not None and self.index.ntotal > 0:
            import faiss
            faiss.normalize_L2(query_np)
            k = min(top_k, self.index.ntotal)
            distances, indices = self.index.search(query_np, k)
            results = []
            for dist, idx in zip(distances[0], indices[0]):
                if idx < len(self.metadata):
                    item = self.metadata[idx].copy()
                    item["similarity"] = float(dist)
                    results.append(item)
            return results
        return self._fallback_search(query_np[0], top_k)

    def _fallback_search(self, query_vector: np.ndarray, top_k: int) -> List[Dict]:
        if not hasattr(self, '_vectors') or self._vectors is None:
            return []
        query_norm = np.linalg.norm(query_vector)
        if query_norm > 0:
            query_vector = query_vector / query_norm
        similarities = np.dot(self._vectors, query_vector)
        top_indices = np.argsort(similarities)[::-1][:top_k]
        results = []
        for idx in top_indices:
            item = self.metadata[idx].copy()
            item["similarity"] = float(similarities[idx])
            results.append(item)
        return results

    def save(self, path: str):
        self.index_path = path
        os.makedirs(os.path.dirname(path), exist_ok=True)
        if self.index is not None:
            import faiss
            faiss.write_index(self.index, path)
        meta_path = path + ".meta.json"
        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(self.metadata, f, ensure_ascii=False, indent=2)
        logger.info(f"索引已保存: {path}")

    def load(self, path: str):
        self.index_path = path
        meta_path = path + ".meta.json"
        if os.path.exists(meta_path):
            with open(meta_path, 'r', encoding='utf-8') as f:
                self.metadata = json.load(f)
        if os.path.exists(path):
            try:
                import faiss
                self.index = faiss.read_index(path)
                self.dimension = self.index.d
                logger.info(f"索引已加载: {path}, 文档数: {self.index.ntotal}")
            except Exception as e:
                logger.error(f"索引加载失败: {e}")

    def get_size(self) -> int:
        if self.index is not None:
            return self.index.ntotal
        return len(self.metadata)

    def clear(self):
        self._ensure_index()
        if self.index is not None:
            import faiss
            self.index = faiss.IndexFlatIP(self.dimension)
        self.metadata.clear()
        logger.info("索引已清空")
