from typing import List, Optional, Union
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class Settings(BaseSettings):
    API_V1_STR: str = "/api/v1"
    PROJECT_NAME: str = "AgroClik API"
    
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

    # Email settings for password reset
    MAIL_USERNAME: str = os.getenv("MAIL_USERNAME", "")
    MAIL_PASSWORD: str = os.getenv("MAIL_PASSWORD", "")
    MAIL_FROM: str = os.getenv("MAIL_FROM", "")
    MAIL_SERVER: str = os.getenv("MAIL_SERVER", "smtp.gmail.com")
    MAIL_PORT: int = int(os.getenv("MAIL_PORT", "587"))
    MAIL_FROM_NAME: str = os.getenv("MAIL_FROM_NAME", "AgroClik")

    # Password reset settings
    PASSWORD_RESET_EXPIRE_MINUTES: int = 15

    # Google OAuth settings
    GOOGLE_CLIENT_ID: str = os.getenv("GOOGLE_CLIENT_ID", "")

    # AWS S3 settings
    AWS_ACCESS_KEY_ID: str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_S3_BUCKET: str = os.getenv("AWS_S3_BUCKET", "agroclik")
    AWS_S3_REGION: str = os.getenv("AWS_S3_REGION", "eu-west-3")

    # Google Maps API settings (for route fetching)
    GOOGLE_MAPS_API_KEY: str = os.getenv("GOOGLE_MAPS_API_KEY", "")

    # Depot location (warehouse)
    DEPOT_LATITUDE: float = float(os.getenv("DEPOT_LATITUDE", "36.549608"))
    DEPOT_LONGITUDE: float = float(os.getenv("DEPOT_LONGITUDE", "4.099945"))
    DEPOT_NAME: str = os.getenv("DEPOT_NAME", "Entrepôt Elsuq - Ouadhia")

settings = Settings()