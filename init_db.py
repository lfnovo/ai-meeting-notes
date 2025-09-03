#!/usr/bin/env python3
"""
Initialize the database
"""
import asyncio
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

async def main():
    from dotenv import load_dotenv
    from loguru import logger
    from app.database import init_db
    
    # Load environment variables
    load_dotenv()
    
    logger.info("🗃️  Initializing database...")
    
    try:
        await init_db()
        logger.success("✅ Database initialization completed successfully!")
    except Exception as e:
        logger.error(f"❌ Database initialization failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    asyncio.run(main())