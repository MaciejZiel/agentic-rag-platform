import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_webhook_rejects_overlong_event_type(client: AsyncClient):
    response = await client.post(
        "/api/v1/webhooks",
        json={"url": "https://example.com/hook", "event_type": "x" * 65},
    )
    assert response.status_code == 422
