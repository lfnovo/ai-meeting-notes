from contextlib import asynccontextmanager
import os
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv
from loguru import logger

from .database import init_db
from .api.routes import router as api_router


# Load environment variables
load_dotenv()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan manager"""
    # Startup
    logger.info("Starting Meeting Minutes App...")
    
    # Initialize database
    await init_db()
    logger.success("Database initialized")
    
    # Create upload directory if it doesn't exist
    upload_dir = Path(os.getenv("UPLOAD_DIRECTORY", "./uploads"))
    upload_dir.mkdir(exist_ok=True)
    logger.info(f"Upload directory: {upload_dir}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down Meeting Minutes App...")


# Create FastAPI application
app = FastAPI(
    title="Meeting Minutes API",
    description="API for processing meeting transcripts and generating structured minutes",
    version="0.1.0",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],  # React dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api/v1")

# Serve uploaded files
upload_directory = os.getenv("UPLOAD_DIRECTORY", "./uploads")
if os.path.exists(upload_directory):
    app.mount("/uploads", StaticFiles(directory=upload_directory), name="uploads")


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Meeting Minutes API",
        "version": "0.1.0",
        "docs": "/docs"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "message": "API is running"}


if __name__ == "__main__":
    import uvicorn
    
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", 8000))
    debug = os.getenv("DEBUG", "false").lower() == "true"
    
    uvicorn.run(
        "main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )