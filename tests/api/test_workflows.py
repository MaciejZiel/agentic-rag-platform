import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_list_workflows_empty(client: AsyncClient):
    response = await client.get("/api/v1/workflows")
    assert response.status_code == 200
    data = response.json()
    assert "workflows" in data
    assert "total" in data


@pytest.mark.asyncio
async def test_create_workflow(client: AsyncClient):
    response = await client.post(
        "/api/v1/workflows",
        json={
            "name": "Test Workflow",
            "description": "A test pipeline",
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Workflow"
    assert data["status"] == "draft"
    assert "id" in data


@pytest.mark.asyncio
async def test_create_workflow_with_definition(client: AsyncClient):
    response = await client.post(
        "/api/v1/workflows",
        json={
            "name": "Pipeline",
            "definition": {
                "nodes": [
                    {"id": "n1", "type": "input", "label": "Input", "x": 100, "y": 100},
                    {"id": "n2", "type": "qa", "label": "QA", "x": 300, "y": 100},
                ],
                "edges": [
                    {"id": "e1", "source": "n1", "target": "n2"},
                ],
            },
        },
    )
    assert response.status_code == 201
    data = response.json()
    assert len(data["definition"]["nodes"]) == 2
    assert len(data["definition"]["edges"]) == 1
