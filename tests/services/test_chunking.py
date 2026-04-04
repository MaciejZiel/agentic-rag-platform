import pytest

from app.utils.chunking import chunk_text, count_tokens


def test_count_tokens():
    text = "Hello, world!"
    count = count_tokens(text)
    assert count > 0
    assert isinstance(count, int)


def test_chunk_text_short():
    text = "Short text."
    chunks = chunk_text(text, max_tokens=512)
    assert len(chunks) == 1
    assert chunks[0]["content"].strip() == text
    assert chunks[0]["chunk_index"] == 0


def test_chunk_text_long():
    # Generate a long text that should produce multiple chunks
    text = "This is a test sentence. " * 500
    chunks = chunk_text(text, max_tokens=100, overlap_tokens=20)
    assert len(chunks) > 1

    # Check all chunks have required keys
    for chunk in chunks:
        assert "content" in chunk
        assert "token_count" in chunk
        assert "chunk_index" in chunk
        assert chunk["token_count"] <= 100

    # Check indices are sequential
    indices = [c["chunk_index"] for c in chunks]
    assert indices == list(range(len(chunks)))


def test_chunk_text_overlap():
    text = "word " * 200
    chunks = chunk_text(text, max_tokens=50, overlap_tokens=10)
    assert len(chunks) > 1
    # With overlap, each chunk (except the first) should share some content
    # with the previous chunk
    for i in range(1, len(chunks)):
        prev_tokens = set(chunks[i - 1]["content"].split()[-15:])
        curr_tokens = set(chunks[i]["content"].split()[:15])
        assert len(prev_tokens & curr_tokens) > 0
