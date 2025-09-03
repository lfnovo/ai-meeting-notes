"""
Comprehensive tests for Entity Check-up feature backend functionality.

This module tests:
1. Database method `get_low_usage_entities()` with various scenarios
2. GET endpoint `/entities/low-usage` with different conditions  
3. Bulk deletion integration and error cases
4. Edge cases and error scenarios
"""

import pytest
import asyncio
import tempfile
import os
import sys
from datetime import datetime, timedelta
from typing import List, Dict, Any
from unittest.mock import AsyncMock, MagicMock, patch
from pathlib import Path

# Add backend to path for imports
backend_dir = Path(__file__).parent.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi.testclient import TestClient
from fastapi import HTTPException
import aiosqlite

from app.database import DatabaseManager
from app.models import (
    EntityLowUsage, EntityCreate, EntityTypeCreate, MeetingCreate, 
    EntityBulkDelete, EntityWithType
)
from app.api.routes import router
from app.main import app


@pytest.fixture
async def temp_database():
    """Create a temporary SQLite database for testing"""
    temp_file = tempfile.NamedTemporaryFile(delete=False, suffix='.db')
    temp_file.close()
    
    db_url = f"sqlite:///{temp_file.name}"
    db_manager = DatabaseManager(db_url)
    
    # Initialize the database schema
    await db_manager.init_database()
    
    yield db_manager
    
    # Cleanup
    os.unlink(temp_file.name)


@pytest.fixture
async def sample_entity_types(temp_database):
    """Create sample entity types for testing"""
    entity_types_data = [
        EntityTypeCreate(
            name="Person",
            slug="person",
            color_class="bg-blue-100 text-blue-800",
            description="People mentioned in meetings"
        ),
        EntityTypeCreate(
            name="Project",
            slug="project", 
            color_class="bg-green-100 text-green-800",
            description="Projects discussed"
        ),
        EntityTypeCreate(
            name="Decision",
            slug="decision",
            color_class="bg-purple-100 text-purple-800",
            description="Decisions made"
        )
    ]
    
    created_types = []
    for entity_type_data in entity_types_data:
        created_type = await temp_database.create_entity_type(entity_type_data)
        created_types.append(created_type)
    
    return created_types


@pytest.fixture
async def sample_meetings(temp_database):
    """Create sample meetings for testing"""
    meetings_data = [
        MeetingCreate(
            title="Team Standup",
            date=datetime.now() - timedelta(days=7),
            transcript="Meeting about daily updates"
        ),
        MeetingCreate(
            title="Project Review",
            date=datetime.now() - timedelta(days=5),
            transcript="Review of project progress"
        ),
        MeetingCreate(
            title="Planning Session", 
            date=datetime.now() - timedelta(days=3),
            transcript="Planning for next quarter"
        )
    ]
    
    created_meetings = []
    for meeting_data in meetings_data:
        created_meeting = await temp_database.create_meeting(meeting_data)
        created_meetings.append(created_meeting)
    
    return created_meetings


@pytest.fixture
async def sample_entities_with_usage(temp_database, sample_entity_types, sample_meetings):
    """
    Create entities with different usage patterns:
    - Some entities appear in only 1 meeting (low usage)
    - Some entities appear in multiple meetings (high usage)
    """
    # Create entities
    entities_data = [
        # Low usage entities (appear in only 1 meeting each)
        EntityCreate(name="John Doe", type_slug="person", description="Developer"),
        EntityCreate(name="Alpha Project", type_slug="project", description="New initiative"),
        EntityCreate(name="Budget Decision", type_slug="decision", description="Q4 budget"),
        
        # High usage entities (will appear in multiple meetings)
        EntityCreate(name="Jane Smith", type_slug="person", description="Project Manager"),
        EntityCreate(name="Beta Project", type_slug="project", description="Ongoing project"),
    ]
    
    created_entities = []
    for entity_data in entities_data:
        created_entity = await temp_database.create_entity(entity_data)
        created_entities.append(created_entity)
    
    # Link entities to meetings to create usage patterns
    # Low usage: entities 0, 1, 2 appear in only one meeting each
    await temp_database.add_entity_to_meeting(sample_meetings[0].id, created_entities[0].id)  # John -> Meeting 1
    await temp_database.add_entity_to_meeting(sample_meetings[1].id, created_entities[1].id)  # Alpha -> Meeting 2
    await temp_database.add_entity_to_meeting(sample_meetings[2].id, created_entities[2].id)  # Budget -> Meeting 3
    
    # High usage: entities 3, 4 appear in multiple meetings
    await temp_database.add_entity_to_meeting(sample_meetings[0].id, created_entities[3].id)  # Jane -> Meeting 1
    await temp_database.add_entity_to_meeting(sample_meetings[1].id, created_entities[3].id)  # Jane -> Meeting 2
    await temp_database.add_entity_to_meeting(sample_meetings[0].id, created_entities[4].id)  # Beta -> Meeting 1
    await temp_database.add_entity_to_meeting(sample_meetings[2].id, created_entities[4].id)  # Beta -> Meeting 3
    
    return {
        'low_usage': created_entities[:3],  # John, Alpha Project, Budget Decision
        'high_usage': created_entities[3:],  # Jane Smith, Beta Project
        'all': created_entities
    }


class TestGetLowUsageEntitiesDatabase:
    """Test the database method get_low_usage_entities() with various scenarios"""
    
    @pytest.mark.asyncio
    async def test_get_low_usage_entities_success(self, temp_database, sample_entities_with_usage):
        """Test successful retrieval of low usage entities"""
        # Act
        low_usage_entities = await temp_database.get_low_usage_entities()
        
        # Assert
        assert isinstance(low_usage_entities, list)
        assert len(low_usage_entities) == 3  # Only 3 entities have low usage
        
        # Verify the entities are the expected ones
        entity_names = {entity.name for entity in low_usage_entities}
        expected_names = {"John Doe", "Alpha Project", "Budget Decision"}
        assert entity_names == expected_names
        
        # Verify structure of returned objects
        for entity in low_usage_entities:
            assert isinstance(entity, EntityLowUsage)
            assert entity.id is not None
            assert entity.name
            assert entity.type_slug
            assert entity.meeting_id is not None
            assert entity.meeting_title
            assert entity.meeting_date
            assert entity.type_name
            assert entity.color_class
    
    @pytest.mark.asyncio 
    async def test_get_low_usage_entities_no_results(self, temp_database, sample_entity_types, sample_meetings):
        """Test when no low usage entities exist"""
        # Create entities that all appear in multiple meetings
        entity_data = EntityCreate(name="High Usage Entity", type_slug="person")
        entity = await temp_database.create_entity(entity_data)
        
        # Add entity to multiple meetings
        await temp_database.add_entity_to_meeting(sample_meetings[0].id, entity.id)
        await temp_database.add_entity_to_meeting(sample_meetings[1].id, entity.id)
        
        # Act
        low_usage_entities = await temp_database.get_low_usage_entities()
        
        # Assert
        assert isinstance(low_usage_entities, list)
        assert len(low_usage_entities) == 0
    
    @pytest.mark.asyncio
    async def test_get_low_usage_entities_single_result(self, temp_database, sample_entity_types, sample_meetings):
        """Test when only one low usage entity exists"""
        # Create a single entity in one meeting
        entity_data = EntityCreate(name="Single Use Entity", type_slug="person")
        entity = await temp_database.create_entity(entity_data)
        await temp_database.add_entity_to_meeting(sample_meetings[0].id, entity.id)
        
        # Act  
        low_usage_entities = await temp_database.get_low_usage_entities()
        
        # Assert
        assert len(low_usage_entities) == 1
        assert low_usage_entities[0].name == "Single Use Entity"
        assert low_usage_entities[0].meeting_id == sample_meetings[0].id
    
    @pytest.mark.asyncio
    async def test_get_low_usage_entities_ordering(self, temp_database, sample_entities_with_usage):
        """Test that results are ordered by created_at DESC"""
        # Act
        low_usage_entities = await temp_database.get_low_usage_entities()
        
        # Assert - should be ordered by created_at DESC
        # Since entities were created in order, the most recent should be first
        assert len(low_usage_entities) > 1
        for i in range(len(low_usage_entities) - 1):
            current_date = low_usage_entities[i].created_at
            next_date = low_usage_entities[i + 1].created_at
            # More recent entities should come first
            assert current_date >= next_date
    
    @pytest.mark.asyncio
    async def test_get_low_usage_entities_database_error(self, temp_database):
        """Test database connection error handling"""
        # Mock a database connection error
        with patch.object(temp_database, 'get_connection') as mock_connection:
            mock_connection.side_effect = aiosqlite.Error("Database connection failed")
            
            # Act & Assert
            with pytest.raises(aiosqlite.Error):
                await temp_database.get_low_usage_entities()


class TestLowUsageEntitiesEndpoint:
    """Test the GET /entities/low-usage endpoint"""
    
    @pytest.fixture
    def test_client(self, temp_database):
        """Create test client with mocked database dependency"""
        def override_get_db():
            return temp_database
        
        app.dependency_overrides[lambda: None] = override_get_db
        return TestClient(app)
    
    def test_get_low_usage_entities_endpoint_success(self, test_client, sample_entities_with_usage):
        """Test successful GET request to /entities/low-usage"""
        # Act
        response = test_client.get("/api/v1/entities/low-usage")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 3
        
        # Verify response structure
        for entity in data:
            assert "id" in entity
            assert "name" in entity 
            assert "type_slug" in entity
            assert "meeting_id" in entity
            assert "meeting_title" in entity
            assert "meeting_date" in entity
            assert "type_name" in entity
            assert "color_class" in entity
    
    def test_get_low_usage_entities_endpoint_empty_result(self, test_client, sample_entity_types):
        """Test endpoint when no low usage entities exist"""
        # Act
        response = test_client.get("/api/v1/entities/low-usage")
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) == 0
    
    @patch('app.api.routes.get_database')
    def test_get_low_usage_entities_endpoint_database_error(self, mock_get_db, test_client):
        """Test endpoint error handling when database fails"""
        # Mock database error
        mock_db = AsyncMock()
        mock_db.get_low_usage_entities.side_effect = Exception("Database error")
        mock_get_db.return_value = mock_db
        
        # Act
        response = test_client.get("/api/v1/entities/low-usage")
        
        # Assert
        assert response.status_code == 500
        assert "Database error" in response.json()["detail"]
    
    def test_get_low_usage_entities_endpoint_content_type(self, test_client, sample_entities_with_usage):
        """Test response content type and headers"""
        # Act
        response = test_client.get("/api/v1/entities/low-usage")
        
        # Assert
        assert response.status_code == 200
        assert response.headers["content-type"] == "application/json"


class TestBulkDeleteIntegration:
    """Test bulk delete functionality with low usage entities"""
    
    @pytest.fixture
    def test_client(self, temp_database):
        """Create test client with mocked database dependency"""
        def override_get_db():
            return temp_database
        
        app.dependency_overrides[lambda: None] = override_get_db
        return TestClient(app)
    
    @pytest.mark.asyncio
    async def test_bulk_delete_low_usage_entities(self, test_client, temp_database, sample_entities_with_usage):
        """Test that low usage entities can be bulk deleted"""
        # Get low usage entities first
        low_usage_entities = await temp_database.get_low_usage_entities()
        entity_ids = [entity.id for entity in low_usage_entities]
        
        # Act - bulk delete
        delete_request = {"ids": entity_ids}
        response = test_client.post("/api/v1/entities/bulk-delete", json=delete_request)
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 3
        assert len(data["failed_ids"]) == 0
        assert "Successfully deleted 3 entities" in data["message"]
        
        # Verify entities are actually deleted
        remaining_entities = await temp_database.get_low_usage_entities()
        assert len(remaining_entities) == 0
    
    @pytest.mark.asyncio
    async def test_bulk_delete_cascade_behavior(self, test_client, temp_database, sample_entities_with_usage):
        """Test that CASCADE deletion works properly (meeting_entities records are cleaned up)"""
        # Get initial count of meeting_entities relationships
        async with temp_database.get_connection() as conn:
            cursor = await conn.execute("SELECT COUNT(*) FROM meeting_entities")
            initial_count = (await cursor.fetchone())[0]
        
        # Get low usage entities and delete them
        low_usage_entities = await temp_database.get_low_usage_entities()
        entity_ids = [entity.id for entity in low_usage_entities]
        
        delete_request = {"ids": entity_ids}
        response = test_client.post("/api/v1/entities/bulk-delete", json=delete_request)
        assert response.status_code == 200
        
        # Check that meeting_entities records are properly cleaned up
        async with temp_database.get_connection() as conn:
            cursor = await conn.execute("SELECT COUNT(*) FROM meeting_entities")
            final_count = (await cursor.fetchone())[0]
        
        # Should have fewer meeting_entities records (the low usage ones were deleted)
        assert final_count < initial_count
        assert final_count == initial_count - 3  # 3 low usage entities were deleted
    
    def test_bulk_delete_partial_failure(self, test_client, sample_entities_with_usage):
        """Test bulk delete with some valid and some invalid entity IDs"""
        # Mix valid and invalid entity IDs
        valid_id = sample_entities_with_usage['low_usage'][0].id
        invalid_ids = [99999, 99998]  # These IDs don't exist
        
        delete_request = {"ids": [valid_id] + invalid_ids}
        response = test_client.post("/api/v1/entities/bulk-delete", json=delete_request)
        
        # Assert
        assert response.status_code == 200
        data = response.json()
        assert data["deleted_count"] == 1  # Only one valid entity deleted
        assert len(data["failed_ids"]) == 2  # Two invalid IDs failed
        assert invalid_ids[0] in data["failed_ids"]
        assert invalid_ids[1] in data["failed_ids"]
    
    def test_bulk_delete_empty_list(self, test_client):
        """Test bulk delete with empty entity list"""
        delete_request = {"ids": []}
        response = test_client.post("/api/v1/entities/bulk-delete", json=delete_request)
        
        # Assert - should fail validation
        assert response.status_code == 422  # Validation error
    
    def test_bulk_delete_too_many_entities(self, test_client):
        """Test bulk delete with too many entities (exceeding limit)"""
        # Create more IDs than the max limit (100)
        too_many_ids = list(range(1, 102))  # 101 IDs
        
        delete_request = {"ids": too_many_ids}
        response = test_client.post("/api/v1/entities/bulk-delete", json=delete_request)
        
        # Assert - should fail validation
        assert response.status_code == 422  # Validation error


class TestEdgeCasesAndErrors:
    """Test edge cases and error scenarios"""
    
    @pytest.mark.asyncio
    async def test_get_low_usage_entities_with_orphaned_data(self, temp_database, sample_entity_types, sample_meetings):
        """Test behavior with data integrity issues (orphaned relationships)"""
        # Create entity and link to meeting
        entity_data = EntityCreate(name="Test Entity", type_slug="person")
        entity = await temp_database.create_entity(entity_data)
        await temp_database.add_entity_to_meeting(sample_meetings[0].id, entity.id)
        
        # Now manually delete the meeting to create orphaned relationship
        async with temp_database.get_connection() as conn:
            await conn.execute("DELETE FROM meetings WHERE id = ?", (sample_meetings[0].id,))
            await conn.commit()
        
        # Act - should handle orphaned data gracefully
        low_usage_entities = await temp_database.get_low_usage_entities()
        
        # Assert - orphaned relationships should not appear in results
        assert isinstance(low_usage_entities, list)
        # The exact behavior depends on the JOIN - with INNER JOIN, orphaned records won't appear
    
    @pytest.mark.asyncio
    async def test_get_low_usage_entities_with_deleted_entity_type(self, temp_database, sample_meetings):
        """Test behavior when entity type is deleted but entities still reference it"""
        # Create entity type and entity
        entity_type_data = EntityTypeCreate(
            name="Temp Type", 
            slug="temp",
            color_class="bg-red-100"
        )
        entity_type = await temp_database.create_entity_type(entity_type_data)
        
        entity_data = EntityCreate(name="Test Entity", type_slug="temp")
        entity = await temp_database.create_entity(entity_data)
        await temp_database.add_entity_to_meeting(sample_meetings[0].id, entity.id)
        
        # Delete the entity type
        async with temp_database.get_connection() as conn:
            await conn.execute("DELETE FROM entity_types WHERE slug = ?", ("temp",))
            await conn.commit()
        
        # Act - should handle missing entity type gracefully
        low_usage_entities = await temp_database.get_low_usage_entities()
        
        # Assert - entities with deleted types should not appear (due to INNER JOIN)
        entity_names = [entity.name for entity in low_usage_entities]
        assert "Test Entity" not in entity_names
    
    @pytest.mark.asyncio
    async def test_concurrent_access_to_get_low_usage_entities(self, temp_database, sample_entities_with_usage):
        """Test concurrent access to the get_low_usage_entities method"""
        # Create multiple concurrent calls
        tasks = []
        for _ in range(5):
            task = asyncio.create_task(temp_database.get_low_usage_entities())
            tasks.append(task)
        
        # Wait for all tasks to complete
        results = await asyncio.gather(*tasks)
        
        # Assert all results are consistent
        assert len(results) == 5
        for result in results:
            assert len(result) == 3  # All should return the same number of low usage entities
            assert all(isinstance(entity, EntityLowUsage) for entity in result)
    
    def test_invalid_endpoint_methods(self, test_client):
        """Test that invalid HTTP methods return appropriate errors"""
        # POST to GET endpoint
        response = test_client.post("/api/v1/entities/low-usage")
        assert response.status_code == 405  # Method not allowed
        
        # PUT to GET endpoint
        response = test_client.put("/api/v1/entities/low-usage")
        assert response.status_code == 405
        
        # DELETE to GET endpoint
        response = test_client.delete("/api/v1/entities/low-usage")
        assert response.status_code == 405


class TestDataConsistency:
    """Test data consistency and validation"""
    
    @pytest.mark.asyncio
    async def test_low_usage_entities_data_integrity(self, temp_database, sample_entities_with_usage):
        """Test that the data returned by get_low_usage_entities is consistent and valid"""
        # Act
        low_usage_entities = await temp_database.get_low_usage_entities()
        
        # Assert data integrity
        for entity in low_usage_entities:
            # Verify entity exists in database
            db_entity = await temp_database.get_entity_by_id(entity.id)
            assert db_entity is not None
            assert db_entity.name == entity.name
            assert db_entity.type_slug == entity.type_slug
            
            # Verify meeting exists
            db_meeting = await temp_database.get_meeting_by_id(entity.meeting_id)
            assert db_meeting is not None
            assert db_meeting.title == entity.meeting_title
            
            # Verify entity-meeting relationship exists
            entity_meetings = await temp_database.get_meetings_by_entity(entity.id)
            meeting_ids = [m.id for m in entity_meetings]
            assert entity.meeting_id in meeting_ids
            
            # Verify this entity truly appears in only 1 meeting
            assert len(entity_meetings) == 1
    
    @pytest.mark.asyncio
    async def test_entity_type_consistency(self, temp_database, sample_entities_with_usage):
        """Test that entity type information is consistent"""
        # Act
        low_usage_entities = await temp_database.get_low_usage_entities()
        
        # Assert entity type consistency
        for entity in low_usage_entities:
            # Get entity type from database
            entity_types = await temp_database.get_entity_types()
            matching_type = next((et for et in entity_types if et.slug == entity.type_slug), None)
            
            assert matching_type is not None
            assert matching_type.name == entity.type_name
            assert matching_type.color_class == entity.color_class


if __name__ == "__main__":
    pytest.main([__file__])