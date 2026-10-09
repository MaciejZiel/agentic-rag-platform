import io

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
    upload = await client.post(
        "/api/v1/documents/upload",
        files={"file": ("job.txt", io.BytesIO(b"content for a job test"), "text/plain")},
    )
    doc_id = upload.json()["id"]
    with patch("app.workers.tasks.run_job_task") as mock_task:
        mock_task.delay = MagicMock()
        response = await client.post(
            "/api/v1/jobs",
            json={"job_type": "index_document", "payload": {"document_id": doc_id}},
        )
    assert response.status_code == 201
    mock_task.delay.assert_called_once()
    data = response.json()
    assert data["job_type"] == "index_document"
    assert data["status"] == "pending"


@pytest.mark.asyncio
async def test_create_job_for_unknown_document_is_rejected(client: AsyncClient):
    with patch("app.workers.tasks.run_job_task") as mock_task:
        mock_task.delay = MagicMock()
        response = await client.post(
            "/api/v1/jobs",
            json={
                "job_type": "index_document",
                "payload": {"document_id": "00000000-0000-0000-0000-000000000001"},
            },
        )
    assert response.status_code == 404
    mock_task.delay.assert_not_called()
