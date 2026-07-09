from datetime import datetime, timedelta, timezone
from typing import Any, Optional
import random
import string

from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from fastapi.security import OAuth2PasswordRequestForm
from sqlmodel import Session, select
from pydantic import BaseModel, EmailStr
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

from app.database import get_session
from app.core.security import (
    create_access_token,
    get_password_hash,
    verify_password,
)
from app.core.config import settings
from app.core.geo import lat_lng_to_h3
from app.models.user import User, UserCreate, UserRead, AuthProvider
from app.models.password_reset import PasswordResetToken, ForgotPasswordRequest, ResetPasswordRequest
from app.models.email_verification import EmailVerificationToken, SendVerificationCodeRequest, VerifyEmailRequest
from app.services.email import send_password_reset_email, send_email_verification_email


class GoogleAuthRequest(BaseModel):
    """Request model for Google OAuth"""
    credential: str  # The ID token from Google Sign-In


class GoogleAuthResponse(BaseModel):
    """Response model for Google OAuth"""
    access_token: str
    token_type: str = "bearer"
    user: UserRead
    is_new_user: bool
    profile_complete: bool

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

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    # Check if user signed up with Google (no password)
    if user.auth_provider == AuthProvider.GOOGLE and not user.hashed_password:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="This account uses Google Sign-In. Please sign in with Google.",
        )

    if not verify_password(form_data.password, user.hashed_password):
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

    # Calculate H3 index from coordinates
    h3_index = lat_lng_to_h3(user_in.latitude, user_in.longitude)

    new_user = User(
        email=user_in.email,
        hashed_password=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        phone=user_in.phone,
        address=user_in.address,
        wilaya=user_in.wilaya,
        daira=user_in.daira,
        commune=user_in.commune,
        latitude=user_in.latitude,
        longitude=user_in.longitude,
        h3_index=h3_index,
        role=user_in.role,
        segment_id=user_in.segment_id,
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


def generate_verification_code() -> str:
    """Generate a 6-digit verification code"""
    return ''.join(random.choices(string.digits, k=6))


@router.post("/send-verification-code", response_model=dict)
async def send_verification_code(
    request: SendVerificationCodeRequest,
    background_tasks: BackgroundTasks,
    session: Session = Depends(get_session),
) -> Any:
    """
    Send email verification code - used during registration
    """
    # Check if email is already registered
    existing_user = session.exec(select(User).where(User.email == request.email)).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This email is already registered",
        )

    # Invalidate any existing verification tokens for this email
    existing_tokens = session.exec(
        select(EmailVerificationToken).where(
            EmailVerificationToken.email == request.email,
            EmailVerificationToken.used == False
        )
    ).all()

    for token in existing_tokens:
        token.used = True
        session.add(token)

    # Generate new verification code
    code = generate_verification_code()
    expires_at = datetime.utcnow() + timedelta(minutes=15)

    # Save to database
    verification_token = EmailVerificationToken(
        email=request.email,
        code=code,
        expires_at=expires_at,
    )
    session.add(verification_token)
    session.commit()

    # Send email in background
    background_tasks.add_task(send_email_verification_email, request.email, code)

    return {"message": "Verification code sent to your email"}


@router.post("/verify-email", response_model=dict)
def verify_email(
    request: VerifyEmailRequest,
    session: Session = Depends(get_session),
) -> Any:
    """
    Verify email with code - used during registration
    """
    # Find valid verification token
    verification_token = session.exec(
        select(EmailVerificationToken).where(
            EmailVerificationToken.email == request.email,
            EmailVerificationToken.code == request.code,
            EmailVerificationToken.used == False,
        )
    ).first()

    if not verification_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid verification code",
        )

    # Check if expired
    if datetime.utcnow() > verification_token.expires_at:
        verification_token.used = True
        session.add(verification_token)
        session.commit()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Verification code has expired",
        )

    # Mark token as used
    verification_token.used = True
    session.add(verification_token)
    session.commit()

    return {"message": "Email verified successfully", "verified": True}


def is_profile_complete(user: User) -> bool:
    """Check if user has completed their profile (has location info)"""
    return bool(
        user.phone and
        user.latitude and
        user.longitude and
        user.wilaya and
        user.commune
    )


@router.post("/google", response_model=GoogleAuthResponse)
def google_auth(
    request: GoogleAuthRequest,
    session: Session = Depends(get_session),
) -> Any:
    """
    Authenticate with Google OAuth.
    - Verifies the Google ID token
    - Creates a new user if not exists
    - Returns JWT token and user info
    """
    try:
        # Verify the Google ID token
        idinfo = id_token.verify_oauth2_token(
            request.credential,
            google_requests.Request(),
            settings.GOOGLE_CLIENT_ID
        )

        # Get user info from the token
        google_id = idinfo['sub']
        email = idinfo['email']
        full_name = idinfo.get('name', email.split('@')[0])
        profile_picture = idinfo.get('picture')

        # Check if user exists by google_id or email
        user = session.exec(
            select(User).where(
                (User.google_id == google_id) | (User.email == email)
            )
        ).first()

        is_new_user = False

        if user:
            # Existing user - update Google info if needed
            if not user.google_id:
                user.google_id = google_id
                user.auth_provider = AuthProvider.GOOGLE
            if profile_picture and not user.profile_picture:
                user.profile_picture = profile_picture
            user.updated_at = datetime.utcnow()
            session.add(user)
            session.commit()
            session.refresh(user)
        else:
            # New user - create account
            is_new_user = True
            user = User(
                email=email,
                full_name=full_name,
                google_id=google_id,
                profile_picture=profile_picture,
                auth_provider=AuthProvider.GOOGLE,
                hashed_password=None,  # No password for Google users
                is_active=False,  # Pending admin approval like regular users
            )
            session.add(user)
            session.commit()
            session.refresh(user)

        # Create access token
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            user.email, expires_delta=access_token_expires
        )

        return GoogleAuthResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserRead.model_validate(user),
            is_new_user=is_new_user,
            profile_complete=is_profile_complete(user)
        )

    except ValueError as e:
        # Invalid token
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid Google token: {str(e)}",
        )