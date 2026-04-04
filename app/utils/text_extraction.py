from pathlib import Path

from app.core.exceptions import UnsupportedFileTypeError
from app.core.logging import get_logger

logger = get_logger(__name__)

SUPPORTED_TYPES = {
    "application/pdf": ".pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
    "text/plain": ".txt",
    "text/markdown": ".md",
}

SUPPORTED_EXTENSIONS = {v for v in SUPPORTED_TYPES.values()}


def extract_text(file_path: Path, content_type: str) -> str:
    ext = file_path.suffix.lower()
    if ext == ".pdf":
        return _extract_pdf(file_path)
    elif ext == ".docx":
        return _extract_docx(file_path)
    elif ext in (".txt", ".md"):
        return _extract_text_file(file_path)
    else:
        raise UnsupportedFileTypeError(content_type)


def _extract_pdf(file_path: Path) -> str:
    import fitz  # PyMuPDF

    doc = fitz.open(str(file_path))
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n\n".join(pages)


def _extract_docx(file_path: Path) -> str:
    import docx

    doc = docx.Document(str(file_path))
    return "\n\n".join(para.text for para in doc.paragraphs if para.text.strip())


def _extract_text_file(file_path: Path) -> str:
    return file_path.read_text(encoding="utf-8")
