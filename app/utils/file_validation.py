"""Validate uploaded files by magic bytes, not just file extension.

Prevents users from uploading disguised files (e.g. a .exe renamed to .pdf).
"""

from pathlib import Path

from app.core.logging import get_logger

logger = get_logger(__name__)

# Magic byte signatures for supported file types
# Format: (bytes_to_read, {magic_bytes: expected_extension})
MAGIC_SIGNATURES: dict[str, list[bytes]] = {
    ".pdf": [b"%PDF"],
    ".docx": [b"PK\x03\x04"],  # ZIP-based format (OOXML)
    ".txt": [],   # No magic bytes — allow anything
    ".md": [],    # No magic bytes — allow anything
}


def validate_file_magic(file_path: Path, claimed_extension: str) -> bool:
    """Check that the file's magic bytes match the claimed extension.

    Returns True if valid or if the extension has no magic signature.
    Returns False if the magic bytes don't match.
    """
    expected_signatures = MAGIC_SIGNATURES.get(claimed_extension.lower())

    # Unknown extension or no signature to check
    if expected_signatures is None or len(expected_signatures) == 0:
        return True

    try:
        with open(file_path, "rb") as f:
            header = f.read(8)
    except OSError:
        logger.warning("file_validation_read_error", path=str(file_path))
        return False

    if not header:
        return False

    for sig in expected_signatures:
        if header[: len(sig)] == sig:
            return True

    logger.warning(
        "file_magic_mismatch",
        path=str(file_path),
        claimed=claimed_extension,
        header_hex=header[:8].hex(),
    )
    return False
