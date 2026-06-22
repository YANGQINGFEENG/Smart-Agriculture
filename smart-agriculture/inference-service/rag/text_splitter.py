import logging
import re
from typing import List, Dict

logger = logging.getLogger(__name__)


class TextSplitter:
    """智能文本切分器"""

    def __init__(self, chunk_size: int = 500, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def split_text(self, text: str) -> List[str]:
        if not text or not text.strip():
            return []
        chunks = self._split_by_headers(text)
        if len(chunks) <= 1:
            chunks = self._split_by_paragraphs(text)
        final_chunks = []
        for chunk in chunks:
            if len(chunk) > self.chunk_size:
                sub_chunks = self._split_by_length(chunk)
                final_chunks.extend(sub_chunks)
            elif chunk.strip():
                final_chunks.append(chunk.strip())
        return final_chunks

    def split_documents(self, documents: List[Dict]) -> List[Dict]:
        chunks = []
        for doc in documents:
            text_chunks = self.split_text(doc.get("content", ""))
            for i, chunk in enumerate(text_chunks):
                chunks.append({
                    "title": doc.get("title", "unknown"),
                    "content": chunk,
                    "source": doc.get("source", ""),
                    "chunk_index": i,
                    "total_chunks": len(text_chunks),
                })
        logger.info(f"切分完成: {len(documents)} 个文档 -> {len(chunks)} 个文本块")
        return chunks

    def _split_by_headers(self, text: str) -> List[str]:
        pattern = r'(^#{1,6}\s+.+$)'
        parts = re.split(pattern, text, flags=re.MULTILINE)
        chunks = []
        current = ""
        for part in parts:
            if re.match(pattern, part, re.MULTILINE):
                if current.strip():
                    chunks.append(current.strip())
                current = part
            else:
                current += part
        if current.strip():
            chunks.append(current.strip())
        return chunks

    def _split_by_paragraphs(self, text: str) -> List[str]:
        paragraphs = re.split(r'\n\s*\n', text)
        chunks = []
        current = ""
        for para in paragraphs:
            para = para.strip()
            if not para:
                continue
            if len(current) + len(para) + 2 <= self.chunk_size:
                current = current + "\n\n" + para if current else para
            else:
                if current.strip():
                    chunks.append(current.strip())
                current = para
        if current.strip():
            chunks.append(current.strip())
        return chunks

    def _split_by_length(self, text: str) -> List[str]:
        chunks = []
        start = 0
        while start < len(text):
            end = start + self.chunk_size
            if end < len(text):
                last_period = text.rfind('。', start, end)
                last_newline = text.rfind('\n', start, end)
                split_pos = max(last_period, last_newline)
                if split_pos > start + self.chunk_size // 2:
                    end = split_pos + 1
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            start = end - self.chunk_overlap
        return chunks
