#!/usr/bin/env python3
"""
Simple script to run the backend server
"""
import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent / "backend"
sys.path.insert(0, str(backend_dir))

if __name__ == "__main__":
    import uvicorn
    from dotenv import load_dotenv
    
    # Load environment variables
    load_dotenv()
    
    # Configuration
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", 8000))
    debug = os.getenv("DEBUG", "true").lower() == "true"
    
    print(f"🚀 Starting Meeting Minutes API on http://{host}:{port}")
    print(f"📚 API Documentation: http://{host}:{port}/docs")
    
    uvicorn.run(
        "app.main:app",
        host=host,
        port=port,
        reload=debug,
        log_level="info"
    )