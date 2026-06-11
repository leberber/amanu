from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
import uvicorn
from sqlmodel import Session
import time
import os
import logging
import traceback

from app.database import create_db_and_tables, engine
from app.core.logging_config import setup_logging, get_logger
from app.core.system_metrics import get_metrics

# Setup logging first
setup_logging()
logger = get_logger("app")
from app.api.api_v1.api import api_router
from app.core.config import settings
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
from app.models.major_road import MajorRoad  # Register model for table creation
from app.models.purchase_order import PurchaseOrder, PurchaseOrderItem  # Register models for table creation
from app.models.facturation import CompanySettings, Facturation, FacturationItem  # Register models for table creation
from app.models.supplier import SupplierPayment, SupplierProductPrice  # Register models for table creation
from app.models.product_purchase_lot import ProductPurchaseLot  # Register model for table creation

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

# Add middleware for request timing, logging, and metrics
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    metrics = get_metrics()

    # Log incoming request (skip noisy endpoints)
    if not request.url.path.startswith("/api/v1/admin/system"):
        logger.info(f"REQUEST {request.method} {request.url.path}")

    try:
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)

        # Record metrics with error message for failed requests
        error_msg = None
        if response.status_code >= 400:
            # Map common status codes to messages
            error_messages = {
                400: "Bad Request",
                401: "Unauthorized",
                403: "Forbidden",
                404: "Not Found",
                405: "Method Not Allowed",
                409: "Conflict",
                422: "Validation Error",
                429: "Too Many Requests",
                500: "Internal Server Error",
                502: "Bad Gateway",
                503: "Service Unavailable",
            }
            error_msg = error_messages.get(response.status_code, f"HTTP {response.status_code}")

        metrics.record_request(request.url.path, request.method, response.status_code, process_time, error_msg)

        # Log response (skip noisy endpoints)
        if not request.url.path.startswith("/api/v1/admin/system"):
            log_level = logging.WARNING if response.status_code >= 400 else logging.INFO
            logger.log(log_level, f"RESPONSE {request.method} {request.url.path} - {response.status_code} ({process_time:.3f}s)")

        return response
    except Exception as e:
        process_time = time.time() - start_time
        error_msg = f"{type(e).__name__}: {str(e)}"
        # Record error in metrics with message
        metrics.record_request(request.url.path, request.method, 500, process_time, error_msg)
        # Log error with compact traceback
        tb_lines = traceback.format_exc().strip().split('\n')
        relevant_lines = [l.strip() for l in tb_lines if 'amanu/backend' in l or l.startswith('ValueError') or l.startswith('TypeError') or l.startswith('KeyError') or 'Error' in l][-5:]
        compact_tb = ' → '.join(relevant_lines) if relevant_lines else tb_lines[-1]
        logger.error(f"EXCEPTION {request.method} {request.url.path} - {type(e).__name__}: {str(e)} | {compact_tb}")
        raise


# Global exception handler for unhandled errors
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    tb_lines = traceback.format_exc().strip().split('\n')
    relevant_lines = [l.strip() for l in tb_lines if 'amanu/backend' in l or 'Error' in l][-5:]
    compact_tb = ' → '.join(relevant_lines) if relevant_lines else tb_lines[-1]
    logger.error(f"UNHANDLED {request.method} {request.url.path} - {type(exc).__name__}: {str(exc)} | {compact_tb}")
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )

# Include API router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Serve .well-known directory for Android App Links verification
well_known_path = os.path.join(os.path.dirname(__file__), ".well-known")
if os.path.exists(well_known_path):
    app.mount("/.well-known", StaticFiles(directory=well_known_path), name="well-known")

@app.on_event("startup")
def on_startup():
    """Create tables and initial data on startup"""
    logger.info("=" * 50)
    logger.info("APPLICATION STARTING")
    logger.info("=" * 50)
    create_db_and_tables()

@app.get("/")
def root():
    """Root endpoint - health check"""
    return {"message": f"Welcome to {settings.PROJECT_NAME} API", "status": "online"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)