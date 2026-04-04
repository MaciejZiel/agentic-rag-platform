import re
from enum import StrEnum

import tiktoken

from app.core.logging import get_logger

logger = get_logger(__name__)

_encoder = tiktoken.get_encoding("cl100k_base")


class ChunkStrategy(StrEnum):
    FIXED_SIZE = "fixed_size"
    SENTENCE = "sentence"
    PARAGRAPH = "paragraph"


def count_tokens(text: str) -> int:
    return len(_encoder.encode(text))


def chunk_text(
    text: str,
    max_tokens: int = 512,
    overlap_tokens: int = 50,
    strategy: ChunkStrategy = ChunkStrategy.FIXED_SIZE,
) -> list[dict[str, str | int]]:
    """Split text into chunks using the specified strategy."""
    if strategy == ChunkStrategy.SENTENCE:
        return _chunk_by_sentence(text, max_tokens, overlap_tokens)
    elif strategy == ChunkStrategy.PARAGRAPH:
        return _chunk_by_paragraph(text, max_tokens)
    else:
        return _chunk_fixed_size(text, max_tokens, overlap_tokens)


def _chunk_fixed_size(
    text: str, max_tokens: int, overlap_tokens: int,
) -> list[dict[str, str | int]]:
    """Split text into overlapping chunks by token count."""
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

    logger.info("text_chunked", strategy="fixed_size", total_tokens=len(tokens), num_chunks=len(chunks))
    return chunks


def _chunk_by_sentence(
    text: str, max_tokens: int, overlap_tokens: int,
) -> list[dict[str, str | int]]:
    """Split text into chunks at sentence boundaries."""
    sentences = re.split(r'(?<=[.!?])\s+', text)
    chunks: list[dict[str, str | int]] = []
    current_sentences: list[str] = []
    current_tokens = 0
    idx = 0

    for sentence in sentences:
        sentence_tokens = count_tokens(sentence)

        if current_tokens + sentence_tokens > max_tokens and current_sentences:
            content = " ".join(current_sentences)
            chunks.append({
                "content": content,
                "token_count": count_tokens(content),
                "chunk_index": idx,
            })
            idx += 1

            # Keep last sentence(s) for overlap
            overlap_sents: list[str] = []
            overlap_count = 0
            for s in reversed(current_sentences):
                t = count_tokens(s)
                if overlap_count + t > overlap_tokens:
                    break
                overlap_sents.insert(0, s)
                overlap_count += t
            current_sentences = overlap_sents
            current_tokens = overlap_count

        current_sentences.append(sentence)
        current_tokens += sentence_tokens

    if current_sentences:
        content = " ".join(current_sentences)
        chunks.append({
            "content": content,
            "token_count": count_tokens(content),
            "chunk_index": idx,
        })

    logger.info("text_chunked", strategy="sentence", num_chunks=len(chunks))
    return chunks


def _chunk_by_paragraph(
    text: str, max_tokens: int,
) -> list[dict[str, str | int]]:
    """Split text into chunks at paragraph boundaries (double newline)."""
    paragraphs = re.split(r'\n\s*\n', text)
    chunks: list[dict[str, str | int]] = []
    current_parts: list[str] = []
    current_tokens = 0
    idx = 0

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        para_tokens = count_tokens(para)

        # If single paragraph exceeds max, force it as its own chunk
        if para_tokens > max_tokens:
            if current_parts:
                content = "\n\n".join(current_parts)
                chunks.append({
                    "content": content,
                    "token_count": count_tokens(content),
                    "chunk_index": idx,
                })
                idx += 1
                current_parts = []
                current_tokens = 0

            chunks.append({
                "content": para,
                "token_count": para_tokens,
                "chunk_index": idx,
            })
            idx += 1
            continue

        if current_tokens + para_tokens > max_tokens and current_parts:
            content = "\n\n".join(current_parts)
            chunks.append({
                "content": content,
                "token_count": count_tokens(content),
                "chunk_index": idx,
            })
            idx += 1
            current_parts = []
            current_tokens = 0

        current_parts.append(para)
        current_tokens += para_tokens

    if current_parts:
        content = "\n\n".join(current_parts)
        chunks.append({
            "content": content,
            "token_count": count_tokens(content),
            "chunk_index": idx,
        })

    logger.info("text_chunked", strategy="paragraph", num_chunks=len(chunks))
    return chunks
