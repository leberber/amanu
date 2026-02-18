from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from pydantic import EmailStr


class PasswordResetToken(SQLModel, table=True):
    """Database model for password reset tokens"""
    __tablename__ = "password_reset_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    code: str = Field(max_length=6)
    expires_at: datetime
    used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class ForgotPasswordRequest(SQLModel):
    """Request model for forgot password"""
    email: EmailStr


class ResetPasswordRequest(SQLModel):
    """Request model for reset password"""
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=100)
