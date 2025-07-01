from sqlmodel import Session, select
from datetime import datetime, timezone
from passlib.context import CryptContext

from app.core.config import settings
from app.models.user import User, UserRole

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def get_password_hash(password: str) -> str:
    """Get password hash"""
    return pwd_context.hash(password)

def create_admin_user(session: Session) -> None:
    """Create admin user if none exists"""
    # Check if admin already exists
    admin = session.exec(select(User).where(User.email == settings.ADMIN_EMAIL)).first()
    
    if not admin:
        print(f"Creating admin user: {settings.ADMIN_EMAIL}")
        admin = User(
            email=settings.ADMIN_EMAIL,
            full_name=settings.ADMIN_NAME,
            hashed_password=get_password_hash(settings.ADMIN_PASSWORD),
            role=UserRole.ADMIN,
            is_active=True,
            created_at=datetime.now(timezone.utc)
        )
        session.add(admin)
        session.commit()
        print("Admin user created successfully")
    else:
        print("Admin user already exists")