from sqlmodel import Session, SQLModel, create_engine
from app.core.config import settings

# Create SQLite engine
engine = create_engine(
    settings.DATABASE_URL, 
    echo=False,  # Set to True for debugging
    connect_args={"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
)

def create_db_and_tables():
    """Create database tables if they don't exist"""
    SQLModel.metadata.create_all(engine)

def get_session():
    """Create a new database session"""
    with Session(engine) as session:
        yield session