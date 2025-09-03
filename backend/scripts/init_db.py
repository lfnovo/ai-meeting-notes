#!/usr/bin/env python3
"""
Initialize the database with tables and indexes.
"""
import asyncio
import os
import sys
from pathlib import Path

# Add the backend directory to the path so we can import our modules
backend_dir = Path(__file__).parent.parent
sys.path.insert(0, str(backend_dir))

from dotenv import load_dotenv
from loguru import logger

from app.database import init_db


async def main():
    """Initialize the database"""
    # Load environment variables
    load_dotenv()
    
    logger.info("Initializing database...")
    
    try:
        await init_db()
        logger.success("Database initialization completed successfully!")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())