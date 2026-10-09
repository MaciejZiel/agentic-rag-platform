from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=256)
    account_type: str = Field(default="personal", pattern="^(personal|organization)$")


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class LoginResponse(BaseModel):
    """Either tokens, or a challenge to complete with /auth/2fa/verify."""

    access_token: str | None = None
    refresh_token: str | None = None
    token_type: str = "bearer"
    two_factor_required: bool = False
    challenge_token: str | None = None


_CODE = Field(min_length=6, max_length=32, description="TOTP code or recovery code")


class TwoFactorVerifyRequest(BaseModel):
    challenge_token: str = Field(min_length=1)
    code: str = _CODE


class TwoFactorCodeRequest(BaseModel):
    code: str = _CODE


class TwoFactorDisableRequest(BaseModel):
    password: str = Field(min_length=1, max_length=128)
    code: str = _CODE


class TwoFactorSetupResponse(BaseModel):
    secret: str
    otpauth_uri: str
    qr_svg: str  # data: URI


class RecoveryCodesResponse(BaseModel):
    recovery_codes: list[str]


class TwoFactorStatusResponse(BaseModel):
    enabled: bool
    recovery_codes_remaining: int


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    account_type: str
    is_email_verified: bool
    is_2fa_enabled: bool
    tenant_id: str
    created_at: str


class MessageResponse(BaseModel):
    message: str
