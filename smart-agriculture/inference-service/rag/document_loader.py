import os
import logging
from typing import List, Dict
from pathlib import Path

logger = logging.getLogger(__name__)


class DocumentLoader:
    """文档加载器 - 支持MD/TXT/PDF格式"""

    SUPPORTED_EXTENSIONS = {'.md', '.txt', '.pdf'}

    def load_file(self, file_path: str) -> Dict:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        ext = path.suffix.lower()
        if ext not in self.SUPPORTED_EXTENSIONS:
            raise ValueError(f"不支持的文件格式: {ext}")
        content = self._read_file(path, ext)
        return {
            "title": path.stem,
            "content": content,
            "source": str(path),
            "type": ext.lstrip('.'),
        }

    def load_directory(self, dir_path: str, recursive: bool = True) -> List[Dict]:
        path = Path(dir_path)
        if not path.is_dir():
            raise NotADirectoryError(f"不是有效目录: {dir_path}")
        documents = []
        pattern = "**/*" if recursive else "*"
        for file_path in path.glob(pattern):
            if file_path.is_file() and file_path.suffix.lower() in self.SUPPORTED_EXTENSIONS:
                try:
                    doc = self.load_file(str(file_path))
                    documents.append(doc)
                except Exception as e:
                    logger.warning(f"加载文件失败 {file_path}: {e}")
        logger.info(f"从目录加载 {len(documents)} 个文档")
        return documents

    def load_text(self, text: str, title: str = "manual_input", source: str = "manual") -> Dict:
        return {
            "title": title,
            "content": text,
            "source": source,
            "type": "text",
        }

    def _read_file(self, path: Path, ext: str) -> str:
        if ext in ('.md', '.txt'):
            return self._read_text_file(path)
        elif ext == '.pdf':
            return self._read_pdf(path)
        return ""

    def _read_text_file(self, path: Path) -> str:
        encodings = ['utf-8', 'gbk', 'gb2312', 'latin-1']
        for encoding in encodings:
            try:
                with open(path, 'r', encoding=encoding) as f:
                    return f.read()
            except UnicodeDecodeError:
                continue
        raise UnicodeDecodeError(f"无法解码文件: {path}")

    def _read_pdf(self, path: Path) -> str:
        try:
            import PyPDF2
            text_parts = []
            with open(path, 'rb') as f:
                reader = PyPDF2.PdfReader(f)
                for page in reader.pages:
                    text_parts.append(page.extract_text() or "")
            return "\n".join(text_parts)
        except ImportError:
            logger.warning("PyPDF2未安装, 无法读取PDF文件")
            return ""
