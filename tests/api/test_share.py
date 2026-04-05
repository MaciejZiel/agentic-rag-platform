import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_share_link_nonexistent_doc(client: AsyncClient):
    response = await client.post(
        "/api/v1/share",
        json={
            "document_id": "00000000-0000-0000-0000-000000000001",
            "expires_in_hours": 24,
        },
    )
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_get_shared_doc_invalid_token(client: AsyncClient):
    response = await client.get("/api/v1/share/nonexistent-token")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_revoke_invalid_token(client: AsyncClient):
    response = await client.delete("/api/v1/share/nonexistent-token")
    assert response.status_code == 404
