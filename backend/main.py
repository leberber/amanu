from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from sqlmodel import Session
import time
import os

from app.database import create_db_and_tables, engine
from app.api.api_v1.api import api_router
from app.core.config import settings
from app.core.admin import create_admin_user
from app.seed_data import seed_data
from app.models.push_subscription import PushSubscription  # Register model for table creation
from app.models.password_reset import PasswordResetToken  # Register model for table creation
from app.models.notification_history import NotificationHistory  # Register model for table creation
from app.models.email_verification import EmailVerificationToken  # Register model for table creation
from app.models.user_notification import UserNotification  # Register model for table creation
from app.models.cross_sell_promotion import CrossSellPromotion  # Register model for table creation
from app.models.volume_discount import VolumeDiscount  # Register model for table creation
from app.models.stock import StockItem  # Register model for table creation
from app.models.restock import RestockItem  # Register model for table creation

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for AgroClik - wholesale supplier platform. Store owners order, we deliver or they pick up.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Configure CORS - Allow all local IPs and production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",
        "http://localhost:8000",
        "https://agroclik.com",
        "https://www.agroclik.com",
    ],
    allow_origin_regex=r"http://(192\.168\.\d{1,3}\.\d{1,3}|127\.0\.0\.1)(:\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Add middleware for request timing
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve .well-known directory for Android App Links verification
well_known_path = os.path.join(os.path.dirname(__file__), ".well-known")
if os.path.exists(well_known_path):
    app.mount("/.well-known", StaticFiles(directory=well_known_path), name="well-known")

@app.on_event("startup")
def on_startup():
    """Create tables and initial data on startup"""
    create_db_and_tables()
    
    # Create admin user
    with Session(engine) as session:
        create_admin_user(session)
    
    # Seed data
    seed_data()

@app.get("/")
def root():
    """Root endpoint - health check"""
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "status": "online"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)