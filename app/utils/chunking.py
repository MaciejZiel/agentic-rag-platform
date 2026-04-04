import tiktoken

from app.core.logging import get_logger

logger = get_logger(__name__)

_encoder = tiktoken.get_encoding("cl100k_base")


def count_tokens(text: str) -> int:
    return len(_encoder.encode(text))


def chunk_text(
    text: str,
    max_tokens: int = 512,
    overlap_tokens: int = 50,
) -> list[dict[str, str | int]]:
    """Split text into overlapping chunks by token count.

    Returns list of dicts with 'content', 'token_count', 'chunk_index'.
    """
    tokens = _encoder.encode(text)
    chunks: list[dict[str, str | int]] = []
    start = 0
    idx = 0

    while start < len(tokens):
        end = min(start + max_tokens, len(tokens))
        chunk_tokens = tokens[start:end]
        content = _encoder.decode(chunk_tokens)

        chunks.append({
            "content": content,
            "token_count": len(chunk_tokens),
            "chunk_index": idx,
        })

        if end >= len(tokens):
            break

        start = end - overlap_tokens
        idx += 1

    logger.info("text_chunked", total_tokens=len(tokens), num_chunks=len(chunks))
    return chunks
