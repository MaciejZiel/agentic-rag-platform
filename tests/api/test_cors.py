from collections.abc import AsyncGenerator

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import create_app

ORIGIN = "http://localhost:5173"


@pytest.fixture
async def prod_client(monkeypatch: pytest.MonkeyPatch) -> AsyncGenerator[AsyncClient, None]:
    """Client for an app built with the non-development (restricted) CORS policy."""
    monkeypatch.setattr(settings, "app_env", "production")
    monkeypatch.setattr(settings, "cors_origins", ORIGIN)
    transport = ASGITransport(app=create_app())
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


def _preflight_headers(request_headers: str) -> dict[str, str]:
    return {
        "Origin": ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": request_headers,
    }


@pytest.mark.asyncio
async def test_preflight_allows_api_key_header(prod_client: AsyncClient):
    response = await prod_client.options(
        "/api/v1/documents", headers=_preflight_headers("X-API-Key")
    )
    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ORIGIN
    assert "x-api-key" in response.headers["access-control-allow-headers"].lower()


@pytest.mark.asyncio
async def test_preflight_rejects_unlisted_header(prod_client: AsyncClient):
    response = await prod_client.options(
        "/api/v1/documents", headers=_preflight_headers("X-Something-Else")
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_rate_limit_headers_are_exposed(prod_client: AsyncClient):
    response = await prod_client.get("/api/v1/health", headers={"Origin": ORIGIN})
    assert "X-RateLimit-Remaining" in response.headers["access-control-expose-headers"]
