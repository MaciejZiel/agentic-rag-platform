import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_register_short_password(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "short",
            "full_name": "Test User",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_empty_name(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "validpassword123",
            "full_name": "",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_invalid_email(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "not-an-email",
            "password": "validpassword123",
            "full_name": "Test User",
        },
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_login_invalid_email(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/login",
        json={"email": "bad-email", "password": "somepassword"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_verify_email_wrong_code_length(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/verify-email",
        json={"email": "test@example.com", "code": "12"},
    )
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_register_unknown_account_type(client: AsyncClient):
    response = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "password": "validpassword123",
            "full_name": "Test User",
            "account_type": "enterprise",
        },
    )
    assert response.status_code == 422
