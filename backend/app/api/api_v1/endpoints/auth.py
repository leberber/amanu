from datetime import datetime, timedelta, timezone
from typing import Any
import random
import string

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select

from app.database import get_session
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.core.config import settings
from app.models.user import User, UserCreate, UserRead
from app.models.password_reset import PasswordResetToken, ForgotPasswordRequest, ResetPasswordRequest
from app.services.email import send_password_reset_email

router = APIRouter()

@router.post("/login", response_model=dict)
def login_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    session: Session = Depends(get_session),
) -> Any:
    """
    OAuth2 compatible token login, get an access token for future requests
    """
    user = session.exec(select(User).where(User.email == form_data.username)).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    return {
        "access_token": create_access_token(
            user.email, expires_delta=access_token_expires
        ),
        "token_type": "bearer",
    }

@router.post("/register", response_model=UserRead)
def register_new_user(
    user_in: UserCreate,
    session: Session = Depends(get_session),
) -> Any:
    """
    Create new user without the need to be logged in.
    """
    user = session.exec(select(User).where(User.email == user_in.email)).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this email already exists.",
        )
    
    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        address=user_in.address,
        role=user_in.role,
        is_active=False,
    )
    session.add(new_user)
    session.commit()
    session.refresh(new_user)
    return new_user


def generate_reset_code() -> str:
    """Generate a 6-digit reset code"""
    return ''.join(random.choices(string.digits, k=6))


@router.post("/forgot-password", response_model=dict)
async def forgot_password(
    request: ForgotPasswordRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> Any:
    """
    Request password reset - sends 6-digit code to email
    """
    # Check if user exists
    user = session.exec(select(User).where(User.email == request.email)).first()

    # Always return success to prevent email enumeration
    if not user:
        return {"message": "If an account with this email exists, a reset code has been sent."}

    # Invalidate any existing reset tokens for this email
    existing_tokens = session.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.email == request.email,
            PasswordResetToken.used == False
        )
    ).all()

    for token in existing_tokens:
        token.used = True
        session.add(token)

    # Generate new reset code
    code = generate_reset_code()
    expires_at = datetime.utcnow() + timedelta(minutes=settings.PASSWORD_RESET_EXPIRE_MINUTES)

    # Save to database
    reset_token = PasswordResetToken(
        email=request.email,
        code=code,
        expires_at=expires_at,
    )
    session.add(reset_token)
    session.commit()

    # Send email in background
    background_tasks.add_task(send_password_reset_email, request.email, code)

    return {"message": "If an account with this email exists, a reset code has been sent."}


@router.post("/reset-password", response_model=dict)
def reset_password(
    request: ResetPasswordRequest,
    session: Session = Depends(get_session),
) -> Any:
    """
    Reset password with email, code, and new password
    """
    # Find valid reset token
    reset_token = session.exec(
        select(PasswordResetToken).where(
            PasswordResetToken.email == request.email,
            PasswordResetToken.code == request.code,
            PasswordResetToken.used == False,
        )
    ).first()

    if not reset_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or expired reset code",
        )

    # Check if expired
    if datetime.utcnow() > reset_token.expires_at:
        reset_token.used = True
        session.add(reset_token)
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Reset code has expired",
        )

    # Find user
    user = session.exec(select(User).where(User.email == request.email)).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User not found",
        )

    # Update password
    user.hashed_password = get_password_hash(request.new_password)
    user.updated_at = datetime.utcnow()

    # Mark token as used
    reset_token.used = True

    session.add(user)
    session.add(reset_token)
    session.commit()

    return {"message": "Password has been reset successfully"}