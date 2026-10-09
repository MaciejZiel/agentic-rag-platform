import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_collections_empty(client: AsyncClient):
    response = await client.get("/api/v1/collections")
    assert response.status_code == 200
    data = response.json()
    assert "collections" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_create_collection(client: AsyncClient):
    response = await client.post(
        "/api/v1/collections",
        json={"name": "Test Collection", "description": "A test", "color": "#3b82f6"},
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Collection"
    assert data["color"] == "#3b82f6"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_collection_missing_name(client: AsyncClient):
    response = await client.post("/api/v1/collections", json={})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_collection_rejects_invalid_color(client: AsyncClient):
    response = await client.post(
        "/api/v1/collections",
        json={"name": "Bad colour", "color": "blue"},
    )
    assert response.status_code == 422
