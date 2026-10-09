import uuid

import jwt
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import generate_api_key
from app.core.rate_limit import limiter
from app.services import two_factor_service as tfa
from app.services.email_service import send_verification_email
from app.core.database import get_db
from app.core.security import (
    create_access_token,
    create_refresh_token,
    create_two_factor_challenge,
    decode_token,
    generate_verification_code,
    hash_password,
    verify_password,
)
from app.models.tenant import ApiKey, Tenant
from app.models.user import User
from app.schemas.auth import (
    LoginRequest,
    LoginResponse,
    MessageResponse,
    RecoveryCodesResponse,
    RefreshRequest,
    RegisterRequest,
    TokenResponse,
    TwoFactorCodeRequest,
    TwoFactorDisableRequest,
    TwoFactorSetupResponse,
    TwoFactorStatusResponse,
    TwoFactorVerifyRequest,
    UserResponse,
    VerifyEmailRequest,
)

router = APIRouter()


# ─── Helper dependency ───────────────────────────────────────────


async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> User:
    """Extract user from Bearer JWT token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid authorization header.")

    token = auth_header[7:]
    try:
        payload = decode_token(token)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired token.")

    if payload.get("type") != "access":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or disabled.")

    return user


# ─── Endpoints ───────────────────────────────────────────────────


@router.post(
    "/register", response_model=MessageResponse, status_code=201, summary="Register account"
)
async def register(
    request: RegisterRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Register a new user with email and password."""
    # Check if email already taken
    result = await db.execute(select(User).where(User.email == request.email.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    if len(request.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters.")

    # Create tenant for this user
    tenant = Tenant(name=request.full_name)
    db.add(tenant)
    await db.flush()

    # Generate API key for the tenant
    raw_key, key_prefix, key_hash = generate_api_key()
    api_key = ApiKey(
        tenant_id=tenant.id,
        key_hash=key_hash,
        key_prefix=key_prefix,
        label="default",
    )
    db.add(api_key)

    # Create user
    verification_code = generate_verification_code()
    user = User(
        email=request.email.lower(),
        password_hash=hash_password(request.password),
        full_name=request.full_name,
        account_type=request.account_type,
        tenant_id=tenant.id,
        email_verification_code=verification_code,
    )
    db.add(user)
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=409, detail="An account with this email already exists.")

    await send_verification_email(request.email, verification_code, request.full_name)

    return MessageResponse(message="Account created. Please verify your email.")


@router.post("/verify-email", response_model=TokenResponse, summary="Verify email")
async def verify_email(
    request: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Verify email with 6-digit code. Returns tokens on success."""
    result = await db.execute(select(User).where(User.email == request.email.lower()))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="Account not found.")

    if user.is_email_verified:
        raise HTTPException(status_code=400, detail="Email already verified.")

    if user.email_verification_code != request.code:
        raise HTTPException(status_code=400, detail="Invalid verification code.")

    user.is_email_verified = True
    user.email_verification_code = None
    await db.commit()

    access_token = create_access_token(user.id, user.tenant_id)
    refresh_token = create_refresh_token(user.id, user.tenant_id)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.post("/login", response_model=LoginResponse, summary="Sign in")
async def login(
    request: LoginRequest,
    db: AsyncSession = Depends(get_db),
) -> LoginResponse:
    """Authenticate with email and password.

    With 2FA enabled no tokens are issued here: the response carries a
    short-lived challenge token to be completed at /auth/2fa/verify.
    """
    result = await db.execute(select(User).where(User.email == request.email.lower()))
    user = result.scalar_one_or_none()

    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled.")

    if not user.is_email_verified:
        # Resend verification code
        verification_code = generate_verification_code()
        user.email_verification_code = verification_code
        await db.commit()

        await send_verification_email(request.email, verification_code, user.full_name)

        raise HTTPException(
            status_code=403,
            detail="Email not verified. A new verification code has been sent.",
        )

    if user.is_2fa_enabled:
        return LoginResponse(
            two_factor_required=True, challenge_token=create_two_factor_challenge(user.id),
        )

    return LoginResponse(
        access_token=create_access_token(user.id, user.tenant_id),
        refresh_token=create_refresh_token(user.id, user.tenant_id),
    )


@router.post("/refresh", response_model=TokenResponse, summary="Refresh access token")
async def refresh(
    request: RefreshRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Get new access token using refresh token."""
    try:
        payload = decode_token(request.refresh_token)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token.")

    if payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    user_id = uuid.UUID(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id, User.is_active.is_(True)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=401, detail="User not found or disabled.")

    access_token = create_access_token(user.id, user.tenant_id)
    refresh_token = create_refresh_token(user.id, user.tenant_id)

    return TokenResponse(access_token=access_token, refresh_token=refresh_token)


@router.get("/me", response_model=UserResponse, summary="Get current user")
async def get_me(
    user: User = Depends(get_current_user),
) -> UserResponse:
    """Get current authenticated user profile."""
    return UserResponse(
        id=str(user.id),
        email=user.email,
        full_name=user.full_name,
        account_type=user.account_type,
        is_email_verified=user.is_email_verified,
        is_2fa_enabled=user.is_2fa_enabled,
        tenant_id=str(user.tenant_id),
        created_at=user.created_at.isoformat(),
    )


@router.post("/resend-code", response_model=MessageResponse, summary="Resend verification code")
async def resend_verification_code(
    request: VerifyEmailRequest,
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Resend email verification code (code field is ignored)."""
    result = await db.execute(select(User).where(User.email == request.email.lower()))
    user = result.scalar_one_or_none()
    if not user:
        # Don't reveal whether account exists
        return MessageResponse(message="If an account exists, a new code has been sent.")

    if user.is_email_verified:
        return MessageResponse(message="Email is already verified.")

    verification_code = generate_verification_code()
    user.email_verification_code = verification_code
    await db.commit()

    await send_verification_email(user.email, verification_code, user.full_name)

    return MessageResponse(message="If an account exists, a new code has been sent.")


# ─── Two-factor authentication (TOTP) ────────────────────────────


@router.post("/2fa/verify", response_model=TokenResponse, summary="Complete sign-in with 2FA")
@limiter.limit("10/minute")
async def verify_two_factor(
    request: Request,
    body: TwoFactorVerifyRequest,
    db: AsyncSession = Depends(get_db),
) -> TokenResponse:
    """Exchange a login challenge plus a TOTP or recovery code for tokens."""
    try:
        payload = decode_token(body.challenge_token)
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Sign-in expired. Please sign in again.")
    if payload.get("type") != "2fa_challenge":
        raise HTTPException(status_code=401, detail="Invalid token type.")

    result = await db.execute(
        select(User).where(User.id == uuid.UUID(payload["sub"]), User.is_active.is_(True))
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_2fa_enabled:
        raise HTTPException(status_code=401, detail="Sign-in expired. Please sign in again.")

    await tfa.check_second_factor(db, user, body.code)

    return TokenResponse(
        access_token=create_access_token(user.id, user.tenant_id),
        refresh_token=create_refresh_token(user.id, user.tenant_id),
    )


@router.get("/2fa", response_model=TwoFactorStatusResponse, summary="Get 2FA status")
async def two_factor_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TwoFactorStatusResponse:
    remaining = await tfa.count_unused_recovery_codes(db, user) if user.is_2fa_enabled else 0
    return TwoFactorStatusResponse(enabled=user.is_2fa_enabled, recovery_codes_remaining=remaining)


@router.post("/2fa/setup", response_model=TwoFactorSetupResponse, summary="Start 2FA enrolment")
@limiter.limit("10/minute")
async def setup_two_factor(
    request: Request,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TwoFactorSetupResponse:
    """Generate a new (not yet active) TOTP secret for the authenticator app."""
    if user.is_2fa_enabled:
        raise HTTPException(status_code=409, detail="Two-factor authentication is already enabled.")
    user.totp_secret = tfa.new_secret()
    user.totp_last_used_step = None
    await db.commit()
    uri = tfa.provisioning_uri(user.totp_secret, user.email)
    return TwoFactorSetupResponse(
        secret=user.totp_secret, otpauth_uri=uri, qr_svg=tfa.qr_svg_data_uri(uri),
    )


@router.post(
    "/2fa/enable", response_model=RecoveryCodesResponse, summary="Confirm and enable 2FA",
)
@limiter.limit("10/minute")
async def enable_two_factor(
    request: Request,
    body: TwoFactorCodeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecoveryCodesResponse:
    """Activate 2FA once the user proves the app produces valid codes.

    Returns the recovery codes; this is the only time they are shown.
    """
    if user.is_2fa_enabled:
        raise HTTPException(status_code=409, detail="Two-factor authentication is already enabled.")
    if not user.totp_secret:
        raise HTTPException(status_code=400, detail="Start the setup first.")
    await tfa.check_second_factor(db, user, body.code, allow_recovery=False)

    user.is_2fa_enabled = True
    codes = await tfa.replace_recovery_codes(db, user)
    await db.commit()
    return RecoveryCodesResponse(recovery_codes=codes)


@router.post("/2fa/disable", response_model=MessageResponse, summary="Disable 2FA")
@limiter.limit("10/minute")
async def disable_two_factor(
    request: Request,
    body: TwoFactorDisableRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> MessageResponse:
    """Requires both the password and a current TOTP or recovery code."""
    if not user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="Two-factor authentication is not enabled.")
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid password.")
    await tfa.check_second_factor(db, user, body.code)

    user.is_2fa_enabled = False
    user.totp_secret = None
    user.totp_last_used_step = None
    await tfa.delete_recovery_codes(db, user)
    await db.commit()
    return MessageResponse(message="Two-factor authentication disabled.")


@router.post(
    "/2fa/recovery-codes",
    response_model=RecoveryCodesResponse,
    summary="Regenerate recovery codes",
)
@limiter.limit("10/minute")
async def regenerate_recovery_codes(
    request: Request,
    body: TwoFactorCodeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RecoveryCodesResponse:
    """Invalidate all previous recovery codes and issue a new set."""
    if not user.is_2fa_enabled:
        raise HTTPException(status_code=400, detail="Two-factor authentication is not enabled.")
    await tfa.check_second_factor(db, user, body.code)
    codes = await tfa.replace_recovery_codes(db, user)
    await db.commit()
    return RecoveryCodesResponse(recovery_codes=codes)
