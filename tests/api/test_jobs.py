import pytest
from httpx import AsyncClient
from unittest.mock import patch, MagicMock


@pytest.mark.asyncio
async def test_get_job_not_found(client: AsyncClient):
    response = await client.get("/api/v1/jobs/00000000-0000-0000-0000-000000000001")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_create_job_invalid_type(client: AsyncClient):
    with patch("app.workers.tasks.run_job_task") as mock_task:
        mock_task.delay = MagicMock()
        response = await client.post(
            "/api/v1/jobs",
            json={"job_type": "invalid_type", "payload": {}},
        )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_create_job_valid(client: AsyncClient):
    with patch("app.workers.tasks.run_job_task") as mock_task:
        mock_task.delay = MagicMock()
        response = await client.post(
            "/api/v1/jobs",
            json={
                "job_type": "index_document",
                "payload": {"document_id": "00000000-0000-0000-0000-000000000001"},
            },
        )
    assert response.status_code == 201
    data = response.json()
    assert data["job_type"] == "index_document"
    assert data["status"] == "pending"
