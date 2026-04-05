import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_assistants_empty(client: AsyncClient):
    response = await client.get("/api/v1/assistants")
    assert response.status_code == 200
    data = response.json()
    assert "assistants" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_create_assistant(client: AsyncClient):
    response = await client.post(
        "/api/v1/assistants",
        json={
            "name": "Test Bot",
            "system_prompt": "You are a helpful assistant.",
            "model": "openai/gpt-4o-mini",
            "temperature": 0.7,
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Bot"
    assert data["temperature"] == 0.7
    assert "id" in data


@pytest.mark.asyncio
async def test_create_assistant_missing_prompt(client: AsyncClient):
    response = await client.post(
        "/api/v1/assistants",
        json={"name": "Bad Bot"},
    )
    assert response.status_code == 422
