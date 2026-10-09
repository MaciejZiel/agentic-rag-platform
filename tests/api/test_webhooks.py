import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_webhooks_returns_paginated_envelope(client: AsyncClient):
    response = await client.get("/api/v1/webhooks")
    assert response.status_code == 200
    data = response.json()
    assert isinstance(data["webhooks"], list)
    assert isinstance(data["total"], int)


@pytest.mark.asyncio
async def test_create_webhook_rejects_overlong_event_type(client: AsyncClient):
    response = await client.post(
        "/api/v1/webhooks",
        json={"url": "https://example.com/hook", "event_type": "x" * 65},
    )
    assert response.status_code == 422
