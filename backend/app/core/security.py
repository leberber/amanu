from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Union
from jose import jwt
from passlib.context import CryptContext
from sqlmodel import Session, select
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.database import get_session
from app.core.config import settings
from app.models.user import User, UserRole

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 token URL
oauth2_scheme = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl=f"{settings.API_V1_STR}/auth/login", auto_error=False)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return pwd_context.verify(plain_password, hashed_password)

def get_password_hash(password: str) -> str:
    """Get password hash"""
    return pwd_context.hash(password)

def create_access_token(subject: Union[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    """Create JWT access token"""
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode = {"exp": expire, "sub": str(subject)}
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

GOOGLE_SIGNUP_TOKEN_TYPE = "google_signup"
GOOGLE_SIGNUP_EXPIRE_MINUTES = 30


def create_google_signup_token(google_id: str, email: str, full_name: str, profile_picture: Optional[str]) -> str:
    """Short-lived token proving a verified Google identity, used to finish registration.
    Has no "sub" claim, so it can never be used as an access token."""
    expire = datetime.now(timezone.utc) + timedelta(minutes=GOOGLE_SIGNUP_EXPIRE_MINUTES)
    to_encode = {
        "exp": expire,
        "type": GOOGLE_SIGNUP_TOKEN_TYPE,
        "google_id": google_id,
        "email": email,
        "full_name": full_name,
        "profile_picture": profile_picture,
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def decode_google_signup_token(token: str) -> dict:
    """Decode a Google signup token, raising 400 if invalid or expired"""
    invalid = HTTPException(
        status_code=status.HTTP_400_BAD_REQUEST,
        detail="Google sign-up session expired. Please sign in with Google again.",
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except jwt.JWTError:
        raise invalid
    if payload.get("type") != GOOGLE_SIGNUP_TOKEN_TYPE or not payload.get("google_id") or not payload.get("email"):
        raise invalid
    return payload


def get_google_signup_identity(signup_token: str, session: Session) -> dict:
    """Decode a Google signup token and ensure no account exists for it yet"""
    payload = decode_google_signup_token(signup_token)
    existing = session.exec(
        select(User).where(
            (User.google_id == payload["google_id"]) | (User.email == payload["email"])
        )
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists.",
        )
    return payload


def get_current_user(token: str = Depends(oauth2_scheme), session: Session = Depends(get_session)) -> User:
    """Get current user from token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            raise credentials_exception
    except jwt.JWTError:
        raise credentials_exception
    
    user = session.exec(select(User).where(User.email == email)).first()
    if user is None:
        raise credentials_exception

    return user

def get_current_active_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current active user"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def get_current_admin_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current admin user"""
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges"
        )
    return current_user

def get_optional_user(token: Optional[str] = Depends(oauth2_scheme_optional), session: Session = Depends(get_session)) -> Optional[User]:
    """Get current user if token provided, else None (for public endpoints)"""
    if not token:
        return None
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        email: str = payload.get("sub")
        if email is None:
            return None
        return session.exec(select(User).where(User.email == email)).first()
    except Exception:
        return None

def get_current_staff_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current staff or admin user"""
    if current_user.role not in [UserRole.ADMIN, UserRole.STAFF]:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges"
        )
    return current_user


def get_current_accountant_user(current_user: User = Depends(get_current_user)) -> User:
    """Get current accountant (or admin) user"""
    if current_user.role not in [UserRole.ADMIN, UserRole.ACCOUNTANT]:
        raise HTTPException(
            status_code=403,
            detail="The user doesn't have enough privileges"
        )
    return current_user