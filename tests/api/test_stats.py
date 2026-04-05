import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_get_stats(client: AsyncClient):
    response = await client.get("/api/v1/stats")
    assert response.status_code == 200
    data = response.json()
    assert "total_documents" in data
    assert "total_queries" in data
    assert "total_tokens_used" in data


@pytest.mark.asyncio
async def test_get_timeseries(client: AsyncClient):
    response = await client.get("/api/v1/stats/timeseries?days=7")
    assert response.status_code == 200
    data = response.json()
    assert "daily" in data
    assert "by_model" in data
    assert "by_status" in data
    assert len(data["daily"]) == 7


@pytest.mark.asyncio
async def test_get_rate_limits(client: AsyncClient):
    response = await client.get("/api/v1/stats/rate-limits")
    assert response.status_code == 200
    data = response.json()
    assert "queries_used" in data
    assert "queries_limit" in data
    assert "tokens_used" in data
    assert "window_minutes" in data
