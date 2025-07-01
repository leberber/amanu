from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import uvicorn
from sqlmodel import Session
import time

from app.database import create_db_and_tables, engine
from app.api.api_v1.api import api_router
from app.core.config import settings
from app.core.admin import create_admin_user
from app.seed_data import seed_data

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="API for an e-commerce platform selling fruits and vegetables",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    # allow_origins=settings.BACKEND_CORS_ORIGINS,
        allow_origins=[
        # "http://localhost:4200",  # Angular dev server
        '*'
        # "https://your-production-frontend.com",  # Your production frontend
    ],

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