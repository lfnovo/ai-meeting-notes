"""
Pytest configuration and shared fixtures for the AI Meeting Notes backend tests.

This module provides:
- Common pytest configuration
- Shared fixtures for database setup and cleanup
- Common test utilities
"""

import pytest
import asyncio
import tempfile
import os
from pathlib import Path
import sys

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from app.database import DatabaseManager
    from app.main import app
except ImportError:
    # If imports fail, tests will still be discoverable but may fail at runtime
    DatabaseManager = None
    app = None


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def temp_db_file():
    """Create a temporary database file and clean up after test"""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
    temp_file.close()
    
    yield temp_file.name
    
    # Cleanup
    try:
        os.unlink(temp_file.name)
    except FileNotFoundError:
        pass  # File already deleted


@pytest.fixture
async def clean_database(temp_db_file):
    """Create a clean database instance for each test"""
    db_url = f"sqlite:///{temp_db_file}"
    db_manager = DatabaseManager(db_url)
    
    # Initialize the database schema
    await db_manager.init_database()
    
    yield db_manager


# Ensure dependency overrides are cleared after each test
@pytest.fixture(autouse=True)
def clear_dependency_overrides():
    """Clear FastAPI dependency overrides after each test"""
    yield
    app.dependency_overrides.clear()


# Configure pytest asyncio mode
pytest_plugins = ["pytest_asyncio"]