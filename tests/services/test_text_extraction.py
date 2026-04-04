import tempfile
from pathlib import Path

import pytest

from app.utils.text_extraction import extract_text


def test_extract_txt():
    with tempfile.NamedTemporaryFile(suffix=".txt", mode="w", delete=False) as f:
        f.write("Hello, this is a test document.")
        f.flush()
        text = extract_text(Path(f.name), "text/plain")
    assert "Hello, this is a test document." in text


def test_extract_markdown():
    with tempfile.NamedTemporaryFile(suffix=".md", mode="w", delete=False) as f:
        f.write("# Title\n\nSome **bold** text.")
        f.flush()
        text = extract_text(Path(f.name), "text/markdown")
    assert "# Title" in text
    assert "bold" in text


def test_extract_unsupported():
    with tempfile.NamedTemporaryFile(suffix=".xyz", mode="w", delete=False) as f:
        f.write("data")
        f.flush()
        with pytest.raises(Exception):
            extract_text(Path(f.name), "application/unknown")
