from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "Fresh Produce E-commerce API"
    
    # BACKEND_CORS_ORIGINS is a comma-separated list of origins
    # e.g: "http://localhost,http://localhost:4200,http://localhost:3000"
    BACKEND_CORS_ORIGINS: List[AnyHttpUrl] = ['*']

    @field_validator("BACKEND_CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> Union[List[str], str]:
        if isinstance(v, str) and not v.startswith("["):
            return [i.strip() for i in v.split(",")]
        elif isinstance(v, (list, str)):
            return v
        raise ValueError(v)

    # Database settings
    DATABASE_URL: str = os.getenv("DATABASE_URL", "sqlite:///./app.db")
    
    # Security settings
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here-make-it-very-secure-and-very-long")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440
    
    # Admin user settings
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@elsuqhub.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "admin123")
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "Admin User")

    # Web Push (VAPID) settings
    VAPID_PUBLIC_KEY: str = os.getenv("VAPID_PUBLIC_KEY", "BHkTMQhVsnq8zbGQ3RcFBuECBAc5NQg7oDoL-vOCBqoeHuBiwFTwqaprYE1eSSETpigznJZgaYWQXTAoLeqzASg")
    VAPID_PRIVATE_KEY: str = os.getenv("VAPID_PRIVATE_KEY", "nBEUTd-UShCMC5O4Eyjsp8uaFJxkfLoL2cz5ln0cZ9c")
    VAPID_CLAIMS_EMAIL: str = os.getenv("VAPID_CLAIMS_EMAIL", "mailto:admin@elsuqhub.com")

settings = Settings()