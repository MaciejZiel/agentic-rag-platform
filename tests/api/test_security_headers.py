from httpx import AsyncClient


async def test_api_responses_use_strict_csp(client: AsyncClient) -> None:
    response = await client.get("/api/v1/health")
    csp = response.headers["content-security-policy"]
    assert "cdn.jsdelivr.net" not in csp
    assert "frame-ancestors 'none'" in csp


async def test_swagger_ui_can_load_its_assets(client: AsyncClient) -> None:
    response = await client.get("/docs")
    assert response.status_code == 200
    csp = response.headers["content-security-policy"]
    assert "script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net" in csp
    assert "https://cdn.jsdelivr.net" in csp.split("style-src", 1)[1].split(";", 1)[0]
