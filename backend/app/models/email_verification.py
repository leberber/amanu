from sqlmodel import SQLModel, Field
from typing import Optional
from datetime import datetime
from pydantic import EmailStr


class EmailVerificationToken(SQLModel, table=True):
    """Database model for email verification tokens"""
    __tablename__ = "email_verification_tokens"

    id: Optional[int] = Field(default=None, primary_key=True)
    email: str = Field(index=True)
    code: str = Field(max_length=6)
    expires_at: datetime
    used: bool = Field(default=False)
    created_at: datetime = Field(default_factory=datetime.utcnow)


class SendVerificationCodeRequest(SQLModel):
    """Request model for sending verification code"""
    email: EmailStr


class VerifyEmailRequest(SQLModel):
    """Request model for verifying email"""
    email: EmailStr
    code: str = Field(min_length=6, max_length=6)
