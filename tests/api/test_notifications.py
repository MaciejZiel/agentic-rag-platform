import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_notifications_empty(client: AsyncClient):
    response = await client.get("/api/v1/notifications")
    assert response.status_code == 200
    data = response.json()
    assert "notifications" in data
    assert "unread_count" in data
    assert data["unread_count"] == 0


@pytest.mark.asyncio
async def test_mark_all_read(client: AsyncClient):
    response = await client.post("/api/v1/notifications/read-all")
    assert response.status_code in (200, 204)
