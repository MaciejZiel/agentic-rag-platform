"""TOTP two-factor authentication: enrolment, sign-in, recovery, lockout."""

import time
import uuid
from datetime import datetime, timezone
from collections.abc import AsyncGenerator

import pyotp
import pytest
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.rate_limit import limiter
from app.core.security import hash_password
from app.main import create_app
from app.models.tenant import Tenant
from app.models.user import User
from app.services.two_factor_service import MAX_FAILED_ATTEMPTS, match_totp

PASSWORD = "correct horse battery"


@pytest.fixture(autouse=True)
def _reset_rate_limits():
    limiter.reset()
    yield
    limiter.reset()


@pytest.fixture
async def api(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app = create_app()

    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac


@pytest.fixture
async def user(db_session: AsyncSession) -> User:
    tenant = Tenant(id=uuid.uuid4(), name="2FA tenant")
    u = User(
        id=uuid.uuid4(),
        email=f"{uuid.uuid4().hex}@example.com",
        password_hash=hash_password(PASSWORD),
        full_name="Two Factor",
        tenant_id=tenant.id,
        is_email_verified=True,
    )
    db_session.add_all([tenant, u])
    await db_session.commit()
    return u


async def _login(api: AsyncClient, user: User) -> dict:
    resp = await api.post("/api/v1/auth/login", json={"email": user.email, "password": PASSWORD})
    assert resp.status_code == 200, resp.text
    return resp.json()


async def _bearer(api: AsyncClient, user: User) -> dict[str, str]:
    return {"Authorization": f"Bearer {(await _login(api, user))['access_token']}"}


async def _enable(api: AsyncClient, user: User) -> tuple[pyotp.TOTP, list[str], dict[str, str]]:
    headers = await _bearer(api, user)
    setup = await api.post("/api/v1/auth/2fa/setup", headers=headers)
    assert setup.status_code == 200, setup.text
    body = setup.json()
    assert body["otpauth_uri"].startswith("otpauth://totp/")
    assert body["qr_svg"].startswith("data:image/svg+xml")
    totp = pyotp.TOTP(body["secret"])

    enabled = await api.post("/api/v1/auth/2fa/enable", headers=headers, json={"code": totp.now()})
    assert enabled.status_code == 200, enabled.text
    codes = enabled.json()["recovery_codes"]
    return totp, codes, headers


def _next_code(totp: pyotp.TOTP) -> str:
    """A valid code from the following step (inside the accepted window)."""
    return totp.at(time.time() + 30)


@pytest.mark.asyncio
async def test_enrolment_requires_a_valid_code(api: AsyncClient, user: User):
    headers = await _bearer(api, user)
    await api.post("/api/v1/auth/2fa/setup", headers=headers)
    resp = await api.post("/api/v1/auth/2fa/enable", headers=headers, json={"code": "000000"})
    assert resp.status_code == 401
    me = await api.get("/api/v1/auth/me", headers=headers)
    assert me.json()["is_2fa_enabled"] is False


@pytest.mark.asyncio
async def test_enable_returns_recovery_codes_and_status(api: AsyncClient, user: User):
    _, codes, headers = await _enable(api, user)
    assert len(codes) == 10 and len(set(codes)) == 10
    status = (await api.get("/api/v1/auth/2fa", headers=headers)).json()
    assert status == {"enabled": True, "recovery_codes_remaining": 10}
    # Setting up again while enabled is refused (would silently swap the secret).
    assert (await api.post("/api/v1/auth/2fa/setup", headers=headers)).status_code == 409


@pytest.mark.asyncio
async def test_recovery_codes_are_stored_hashed(
    api: AsyncClient, user: User, db_session: AsyncSession,
):
    from sqlalchemy import select

    from app.models.user import RecoveryCode

    _, codes, _ = await _enable(api, user)
    stored = (await db_session.execute(
        select(RecoveryCode.code_hash).where(RecoveryCode.user_id == user.id)
    )).scalars().all()
    assert len(stored) == 10
    assert not set(stored) & set(codes)
    assert all(len(h) == 64 for h in stored)


@pytest.mark.asyncio
async def test_login_with_2fa_issues_no_tokens_until_verified(api: AsyncClient, user: User):
    totp, _, _ = await _enable(api, user)

    login = await _login(api, user)
    assert login["two_factor_required"] is True
    assert login["access_token"] is None and login["refresh_token"] is None

    # The challenge is not an access token.
    challenge = login["challenge_token"]
    me = await api.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {challenge}"})
    assert me.status_code == 401
    docs = await api.get("/api/v1/documents", headers={"Authorization": f"Bearer {challenge}"})
    assert docs.status_code == 401

    bad = await api.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": "123456"},
    )
    assert bad.status_code == 401

    ok = await api.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": _next_code(totp)},
    )
    assert ok.status_code == 200
    tokens = ok.json()
    me = await api.get(
        "/api/v1/auth/me", headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert me.status_code == 200


@pytest.mark.asyncio
async def test_totp_code_cannot_be_replayed(api: AsyncClient, user: User):
    totp, _, _ = await _enable(api, user)
    code = _next_code(totp)

    first = (await _login(api, user))["challenge_token"]
    assert (await api.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": first, "code": code},
    )).status_code == 200

    second = (await _login(api, user))["challenge_token"]
    assert (await api.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": second, "code": code},
    )).status_code == 401


@pytest.mark.asyncio
async def test_recovery_code_works_exactly_once(api: AsyncClient, user: User):
    _, codes, headers = await _enable(api, user)

    challenge = (await _login(api, user))["challenge_token"]
    used = await api.post(
        "/api/v1/auth/2fa/verify",
        json={"challenge_token": challenge, "code": codes[0].upper()},  # case-insensitive
    )
    assert used.status_code == 200

    challenge = (await _login(api, user))["challenge_token"]
    reused = await api.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": codes[0]},
    )
    assert reused.status_code == 401

    headers = {"Authorization": f"Bearer {used.json()['access_token']}"}
    status = (await api.get("/api/v1/auth/2fa", headers=headers)).json()
    assert status["recovery_codes_remaining"] == 9


@pytest.mark.asyncio
async def test_repeated_failures_lock_the_second_factor(api: AsyncClient, user: User):
    totp, _, _ = await _enable(api, user)
    challenge = (await _login(api, user))["challenge_token"]

    for _ in range(MAX_FAILED_ATTEMPTS):
        resp = await api.post(
            "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": "000000"},
        )
        assert resp.status_code == 401

    # Even a correct code is refused while locked.
    locked = await api.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": _next_code(totp)},
    )
    assert locked.status_code == 429


@pytest.mark.asyncio
async def test_verify_endpoint_is_rate_limited(api: AsyncClient, user: User):
    statuses = []
    for _ in range(12):
        resp = await api.post(
            "/api/v1/auth/2fa/verify", json={"challenge_token": "x", "code": "000000"},
        )
        statuses.append(resp.status_code)
    assert statuses[:10] == [401] * 10
    assert statuses[-1] == 429


@pytest.mark.asyncio
async def test_disable_requires_password_and_code(api: AsyncClient, user: User):
    totp, codes, headers = await _enable(api, user)

    wrong_pw = await api.post(
        "/api/v1/auth/2fa/disable",
        headers=headers,
        json={"password": "nope", "code": _next_code(totp)},
    )
    assert wrong_pw.status_code == 401
    wrong_code = await api.post(
        "/api/v1/auth/2fa/disable", headers=headers, json={"password": PASSWORD, "code": "000000"},
    )
    assert wrong_code.status_code == 401

    ok = await api.post(
        "/api/v1/auth/2fa/disable", headers=headers, json={"password": PASSWORD, "code": codes[1]},
    )
    assert ok.status_code == 200

    login = await _login(api, user)
    assert login["two_factor_required"] is False
    assert login["access_token"]
    status = (await api.get(
        "/api/v1/auth/2fa", headers={"Authorization": f"Bearer {login['access_token']}"},
    )).json()
    assert status == {"enabled": False, "recovery_codes_remaining": 0}


@pytest.mark.asyncio
async def test_regenerating_recovery_codes_invalidates_old_ones(api: AsyncClient, user: User):
    totp, old_codes, headers = await _enable(api, user)
    resp = await api.post(
        "/api/v1/auth/2fa/recovery-codes", headers=headers, json={"code": _next_code(totp)},
    )
    assert resp.status_code == 200
    new_codes = resp.json()["recovery_codes"]
    assert not set(new_codes) & set(old_codes)

    challenge = (await _login(api, user))["challenge_token"]
    old = await api.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": old_codes[0]},
    )
    assert old.status_code == 401
    new = await api.post(
        "/api/v1/auth/2fa/verify", json={"challenge_token": challenge, "code": new_codes[0]},
    )
    assert new.status_code == 200


def test_match_totp_window_and_replay_guard():
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    now_step = totp.timecode(datetime.now(timezone.utc))

    assert match_totp(secret, totp.now(), None) is not None
    assert match_totp(secret, totp.at(time.time() - 30), None) is not None
    assert match_totp(secret, totp.at(time.time() - 120), None) is None
    assert match_totp(secret, totp.now(), last_used_step=now_step + 1) is None
    assert match_totp(secret, "abc123", None) is None
