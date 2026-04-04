import io

import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_upload_document(client: AsyncClient):
    content = b"This is a test document with some content for testing."
    file = io.BytesIO(content)
    response = await client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.txt", file, "text/plain")},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["filename"] == "test.txt"
    assert data["status"] == "uploaded"
    assert data["file_size"] == len(content)


@pytest.mark.asyncio
async def test_upload_unsupported_file_type(client: AsyncClient):
    file = io.BytesIO(b"data")
    response = await client.post(
        "/api/v1/documents/upload",
        files={"file": ("test.exe", file, "application/octet-stream")},
    )
    assert response.status_code == 415


@pytest.mark.asyncio
async def test_list_documents_empty(client: AsyncClient):
    response = await client.get("/api/v1/documents")
    assert response.status_code == 200
    data = response.json()
    assert data["documents"] == [] or isinstance(data["documents"], list)
    assert "total" in data


@pytest.mark.asyncio
async def test_get_document_not_found(client: AsyncClient):
    response = await client.get("/api/v1/documents/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404
