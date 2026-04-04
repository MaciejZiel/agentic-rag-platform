from pydantic import BaseModel, EmailStr


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    account_type: str = "personal"  # "personal" | "organization"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class VerifyEmailRequest(BaseModel):
    email: EmailStr
    code: str


class RefreshRequest(BaseModel):
    refresh_token: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


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
