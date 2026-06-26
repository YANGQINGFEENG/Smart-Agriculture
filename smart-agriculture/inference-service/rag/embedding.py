import os
import logging
from typing import List

logger = logging.getLogger(__name__)


class EmbeddingModel:
    """嵌入模型管理类 - 使用BGE中文嵌入模型"""

    def __init__(self, model_name: str = "BAAI/bge-small-zh-v1.5"):
        self.model_name = model_name
        self.model = None
        self.dimension = 512

    def _load_model(self):
        if self.model is not None:
            return
        try:
            from sentence_transformers import SentenceTransformer
            cache_dir = os.environ.get("MODEL_CACHE_DIR", "/root/.cache/huggingface")
            os.makedirs(cache_dir, exist_ok=True)
            logger.info(f"加载嵌入模型: {self.model_name}")
            self.model = SentenceTransformer(self.model_name, cache_folder=cache_dir)
            self.dimension = self.model.get_sentence_embedding_dimension()
            logger.info(f"模型加载成功, 向量维度: {self.dimension}")
        except Exception as e:
            logger.error(f"模型加载失败: {e}")
            raise

    def encode(self, texts: List[str]) -> List[List[float]]:
        self._load_model()
        embeddings = self.model.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()

    def encode_single(self, text: str) -> List[float]:
        self._load_model()
        embedding = self.model.encode([text], normalize_embeddings=True)
        return embedding[0].tolist()

    def get_dimension(self) -> int:
        self._load_model()
        return self.dimension
