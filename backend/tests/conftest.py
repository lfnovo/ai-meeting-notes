"""
Pytest configuration and shared fixtures for Entity Cleanup tests.
"""

import pytest
import asyncio
import sys
import os
from typing import AsyncGenerator, Dict, Any

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from database import DatabaseManager


@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest.fixture
async def clean_test_db() -> AsyncGenerator[tuple, None]:
    """
    Create a clean in-memory test database with sample data.
    This fixture provides a controlled environment for testing entity cleanup.
    """
    # Use in-memory SQLite for isolated testing
    db = DatabaseManager(":memory:")
    
    try:
        # Initialize database schema
        await db.init_database()
        
        # Create test entity types
        person_type = await db.create_entity_type({
            "name": "Person",
            "slug": "person", 
            "color_class": "bg-blue-100 text-blue-800 border-blue-200",
            "description": "Test person type"
        })
        
        company_type = await db.create_entity_type({
            "name": "Company",
            "slug": "company",
            "color_class": "bg-green-100 text-green-800 border-green-200", 
            "description": "Test company type"
        })
        
        # Create entities with different usage patterns
        # 1. Entity with 0 meeting associations (low-usage)
        entity_unused = await db.create_entity({
            "name": "Never Used Entity",
            "type_slug": "person",
            "description": "Entity that was never associated with any meeting"
        })
        
        # 2. Entity with 1 meeting association (low-usage) 
        entity_low_usage = await db.create_entity({
            "name": "Barely Used Entity", 
            "type_slug": "company",
            "description": "Entity used in only one meeting"
        })
        
        # 3. Entity with 2 meeting associations (NOT low-usage)
        entity_active = await db.create_entity({
            "name": "Active Entity",
            "type_slug": "person", 
            "description": "Entity used in multiple meetings"
        })
        
        # 4. Entity with 3+ meeting associations (definitely NOT low-usage)
        entity_very_active = await db.create_entity({
            "name": "Very Active Entity",
            "type_slug": "company",
            "description": "Entity used in many meetings"
        })
        
        # Create test meetings
        meeting1 = await db.create_meeting({
            "title": "Meeting Alpha", 
            "date": "2024-01-15",
            "transcript": "Test meeting transcript alpha"
        })
        
        meeting2 = await db.create_meeting({
            "title": "Meeting Beta",
            "date": "2024-01-16", 
            "transcript": "Test meeting transcript beta"
        })
        
        meeting3 = await db.create_meeting({
            "title": "Meeting Gamma",
            "date": "2024-01-17",
            "transcript": "Test meeting transcript gamma"  
        })
        
        meeting4 = await db.create_meeting({
            "title": "Meeting Delta",
            "date": "2024-01-18",
            "transcript": "Test meeting transcript delta"
        })
        
        # Create meeting-entity associations to establish usage patterns
        async with db.get_connection() as conn:
            # entity_low_usage: 1 meeting association
            await conn.execute(
                "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)",
                (meeting1.id, entity_low_usage.id)
            )
            
            # entity_active: 2 meeting associations  
            await conn.execute(
                "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)",
                (meeting1.id, entity_active.id) 
            )
            await conn.execute(
                "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)",
                (meeting2.id, entity_active.id)
            )
            
            # entity_very_active: 3 meeting associations
            await conn.execute(
                "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)",
                (meeting2.id, entity_very_active.id)
            )
            await conn.execute(
                "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)", 
                (meeting3.id, entity_very_active.id)
            )
            await conn.execute(
                "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)",
                (meeting4.id, entity_very_active.id)
            )
            
            await conn.commit()
        
        # Prepare test data structure
        test_data = {
            "db": db,
            "entity_types": {
                "person": person_type,
                "company": company_type
            },
            "entities": {
                "unused": entity_unused,           # 0 meetings (low-usage)
                "low_usage": entity_low_usage,    # 1 meeting (low-usage) 
                "active": entity_active,          # 2 meetings (NOT low-usage)
                "very_active": entity_very_active # 3 meetings (NOT low-usage)
            },
            "meetings": {
                "meeting1": meeting1,
                "meeting2": meeting2, 
                "meeting3": meeting3,
                "meeting4": meeting4
            }
        }
        
        yield db, test_data
        
    finally:
        # Cleanup is automatic for in-memory database
        pass


@pytest.fixture  
def sample_entity_data() -> Dict[str, Any]:
    """Provide sample entity data for testing."""
    return {
        "valid_entity": {
            "name": "Test Entity",
            "type_slug": "person",
            "description": "A test entity for validation"
        },
        "bulk_delete_payload": {
            "ids": [1, 2, 3]
        },
        "empty_bulk_delete": {
            "ids": []
        },
        "invalid_bulk_delete": {
            "ids": [99999, 99998, 99997]  # Non-existent IDs
        }
    }


# Async test utilities
def pytest_configure(config):
    """Configure pytest for async testing."""
    import warnings
    warnings.filterwarnings("ignore", category=DeprecationWarning)