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
from app.seed_test_users import seed_test_users
from app.seed_test_orders import seed_test_orders
from app.models.push_subscription import PushSubscription  # Register model for table creation
from app.models.password_reset import PasswordResetToken  # Register model for table creation
from app.models.notification_history import NotificationHistory  # Register model for table creation
from app.models.email_verification import EmailVerificationToken  # Register model for table creation
from app.models.user_notification import UserNotification  # Register model for table creation
from app.models.cross_sell_promotion import CrossSellPromotion  # Register model for table creation
from app.models.volume_discount import VolumeDiscount  # Register model for table creation
from app.models.restock import RestockItem  # Register model for table creation
from app.models.driver import DriverProfile  # Register model for table creation
from app.models.shipping import H3DeliveryZone, ShippingPriceConfig  # Register models for table creation
from app.models.trip import Trip, TripStop  # Register models for table creation
from app.models.order import Order  # Ensure Order model with new columns is registered
from app.models.customer_route import CustomerRoute  # Register model for table creation
from app.services.customer_route_service import fetch_and_save_route, get_gmaps_client
from sqlmodel import select
from app.models.user import User

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for AgroClik - wholesale supplier platform. Store owners order, we deliver or they pick up.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    redirect_slashes=False,
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

    # Seed test users (drivers, customers, staff)
    seed_test_users()

    # Seed test orders for batching testing
    # seed_test_orders()  # Commented out to prevent generating new orders on every restart

    # Fetch routes for customers without routes (if Google API key is configured)
    fetch_missing_customer_routes()


def fetch_missing_customer_routes():
    """
    Fetch routes from Google for all customers who have coordinates but no stored route.
    Runs on startup. Only fetches for users without existing routes.
    """
    # Check if Google API key is configured
    if not get_gmaps_client():
        print("⚠️  GOOGLE_MAPS_API_KEY not configured - skipping route fetching")
        return

    with Session(engine) as session:
        # Get users with coordinates who don't have routes
        existing_route_ids = session.exec(select(CustomerRoute.user_id)).all()
        existing_ids = set(existing_route_ids)

        users_without_routes = session.exec(
            select(User).where(
                User.latitude.isnot(None),
                User.longitude.isnot(None)
            )
        ).all()

        users_to_fetch = [u for u in users_without_routes if u.id not in existing_ids]

        if not users_to_fetch:
            print("✓ All customers already have routes stored")
            return

        print(f"📍 Fetching routes for {len(users_to_fetch)} customers...")

        fetched = 0
        failed = 0

        for user in users_to_fetch:
            try:
                route = fetch_and_save_route(session, user.id, user.latitude, user.longitude)
                if route:
                    fetched += 1
                    print(f"  ✓ {user.store_name or user.full_name}: {route.distance_meters/1000:.1f} km ({route.corridor})")
                else:
                    failed += 1
                    print(f"  ✗ {user.store_name or user.full_name}: No route found")
            except Exception as e:
                failed += 1
                print(f"  ✗ {user.store_name or user.full_name}: Error - {e}")

        print(f"📍 Routes fetched: {fetched} success, {failed} failed")

@app.get("/")
def root():
    """Root endpoint - health check"""
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "status": "online"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)