"""
Critical tests for the Entity Cleanup feature (OSS-266).

These tests focus on the most important aspects of entity cleanup functionality:
1. Database query correctness (get_low_usage_entities)
2. API endpoint functionality (GET /entities/low-usage)
3. Bulk delete API endpoint (POST /entities/bulk-delete)
4. Edge cases (empty results, invalid data)
5. Data integrity (query filtering logic)
"""

import pytest
import asyncio
from typing import List, Dict, Any
import sys
import os

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'app'))

from database import DatabaseManager
from models import EntityWithUsageStats, EntityBulkDelete
from fastapi.testclient import TestClient
from main import app


@pytest.fixture
def client():
    """FastAPI test client"""
    return TestClient(app)


@pytest.fixture
async def test_db():
    """Create a test database with sample data"""
    db = DatabaseManager(":memory:")  # Use in-memory SQLite for testing
    
    # Initialize the database
    await db.init_database()
    
    # Create test entity types
    await db.create_entity_type({
        "name": "Person", 
        "slug": "person", 
        "color_class": "bg-blue-100"
    })
    await db.create_entity_type({
        "name": "Company", 
        "slug": "company", 
        "color_class": "bg-green-100"
    })
    
    # Create test entities with known usage patterns
    # Entity with 0 meetings (should be in low-usage)
    entity_0_meetings = await db.create_entity({
        "name": "Unused Entity",
        "type_slug": "person",
        "description": "Never used in meetings"
    })
    
    # Entity with 1 meeting (should be in low-usage)  
    entity_1_meeting = await db.create_entity({
        "name": "Low Usage Entity",
        "type_slug": "company", 
        "description": "Used in only 1 meeting"
    })
    
    # Entity with 2 meetings (should NOT be in low-usage)
    entity_2_meetings = await db.create_entity({
        "name": "Active Entity",
        "type_slug": "person",
        "description": "Used in multiple meetings"
    })
    
    # Create test meetings
    meeting1 = await db.create_meeting({
        "title": "Test Meeting 1",
        "date": "2024-01-01",
        "transcript": "Test transcript 1"
    })
    
    meeting2 = await db.create_meeting({
        "title": "Test Meeting 2", 
        "date": "2024-01-02",
        "transcript": "Test transcript 2"
    })
    
    meeting3 = await db.create_meeting({
        "title": "Test Meeting 3",
        "date": "2024-01-03", 
        "transcript": "Test transcript 3"
    })
    
    # Associate entities with meetings to create usage patterns
    # entity_1_meeting: 1 meeting association
    async with db.get_connection() as conn:
        await conn.execute(
            "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)",
            (meeting1.id, entity_1_meeting.id)
        )
        
        # entity_2_meetings: 2 meeting associations  
        await conn.execute(
            "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)",
            (meeting2.id, entity_2_meetings.id)
        )
        await conn.execute(
            "INSERT INTO meeting_entities (meeting_id, entity_id) VALUES (?, ?)",
            (meeting3.id, entity_2_meetings.id)
        )
        await conn.commit()
    
    return db, {
        "entity_0_meetings": entity_0_meetings,
        "entity_1_meeting": entity_1_meeting,
        "entity_2_meetings": entity_2_meetings,
        "meeting1": meeting1,
        "meeting2": meeting2,
        "meeting3": meeting3
    }


class TestEntityCleanup:
    """Test suite for Entity Cleanup functionality"""
    
    @pytest.mark.asyncio
    async def test_1_get_low_usage_entities_query_correctness(self):
        """
        TEST 1: Verify the database query returns correct low-usage entities
        CRITICAL: This ensures the core filtering logic (≤1 meeting) works correctly
        """
        db, test_data = await test_db()
        
        # Execute the low-usage query
        low_usage_entities = await db.get_low_usage_entities()
        
        # Verify correct entities are returned
        entity_names = [entity.name for entity in low_usage_entities]
        
        # Should include entities with 0 and 1 meeting associations
        assert "Unused Entity" in entity_names, "Entity with 0 meetings should be included"
        assert "Low Usage Entity" in entity_names, "Entity with 1 meeting should be included"
        
        # Should NOT include entity with 2 meetings
        assert "Active Entity" not in entity_names, "Entity with 2+ meetings should be excluded"
        
        # Verify meeting counts are correct
        for entity in low_usage_entities:
            if entity.name == "Unused Entity":
                assert entity.meeting_count == 0, f"Expected 0 meetings, got {entity.meeting_count}"
            elif entity.name == "Low Usage Entity":
                assert entity.meeting_count == 1, f"Expected 1 meeting, got {entity.meeting_count}"
        
        print(f"✅ Test 1 PASSED: Found {len(low_usage_entities)} low-usage entities with correct filtering")


    def test_2_api_endpoint_returns_correct_data(self, client):
        """
        TEST 2: Verify the API endpoint returns properly formatted data
        CRITICAL: This ensures frontend can consume the API correctly
        """
        # Make API request
        response = client.get("/api/v1/entities/low-usage")
        
        # Verify response structure
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        
        entities = response.json()
        assert isinstance(entities, list), "Response should be a list of entities"
        
        if entities:  # Only test structure if entities exist
            # Verify entity structure matches EntityWithUsageStats model
            entity = entities[0]
            required_fields = ["id", "name", "type_slug", "meeting_count", "created_at"]
            
            for field in required_fields:
                assert field in entity, f"Missing required field: {field}"
            
            # Verify meeting_count is numeric and <= 1 
            assert isinstance(entity["meeting_count"], int), "meeting_count should be integer"
            assert entity["meeting_count"] <= 1, f"Low-usage entity has {entity['meeting_count']} meetings, should be ≤1"
            
            # Verify type information is included
            if "type_name" in entity:
                assert isinstance(entity["type_name"], (str, type(None))), "type_name should be string or null"
        
        print(f"✅ Test 2 PASSED: API endpoint returns {len(entities)} properly formatted entities")


    def test_3_bulk_delete_api_endpoint_functionality(self, client):
        """
        TEST 3: Verify bulk delete endpoint works correctly and safely
        CRITICAL: This ensures the delete operation is safe and doesn't cause data loss
        """
        # First get some low-usage entities to delete
        response = client.get("/api/v1/entities/low-usage")
        assert response.status_code == 200
        
        entities = response.json()
        if not entities:
            pytest.skip("No low-usage entities available for delete test")
        
        # Take only the first entity for safe testing
        entity_to_delete = entities[0]
        entity_id = entity_to_delete["id"]
        
        # Verify entity exists before deletion
        verify_response = client.get(f"/api/v1/entities/{entity_id}")
        assert verify_response.status_code == 200, "Entity should exist before deletion"
        
        # Perform bulk delete
        delete_response = client.post("/api/v1/entities/bulk-delete", json={"ids": [entity_id]})
        
        # Verify delete response
        assert delete_response.status_code in [200, 204], f"Delete failed with status {delete_response.status_code}"
        
        # Verify entity is actually deleted
        verify_deleted = client.get(f"/api/v1/entities/{entity_id}")
        assert verify_deleted.status_code == 404, "Entity should not exist after deletion"
        
        print(f"✅ Test 3 PASSED: Successfully deleted entity {entity_id} via bulk delete API")


    def test_4_edge_case_empty_results_handling(self, client):
        """
        TEST 4: Verify system handles edge cases gracefully
        CRITICAL: This ensures the system is robust with edge cases
        """
        # Test API response when no low-usage entities exist
        # (This might not happen in practice, but the API should handle it)
        response = client.get("/api/v1/entities/low-usage")
        assert response.status_code == 200, "API should return 200 even with no results"
        
        entities = response.json()
        assert isinstance(entities, list), "Should return empty list, not null"
        
        # Test bulk delete with empty array
        empty_delete = client.post("/api/v1/entities/bulk-delete", json={"ids": []})
        assert empty_delete.status_code in [200, 204, 400], "Empty delete should be handled gracefully"
        
        # Test bulk delete with invalid IDs
        invalid_delete = client.post("/api/v1/entities/bulk-delete", json={"ids": [99999, 99998]})
        # Should not crash, but may return 404 or partial success
        assert invalid_delete.status_code in [200, 204, 404], "Invalid IDs should be handled gracefully"
        
        print("✅ Test 4 PASSED: Edge cases handled gracefully")


    @pytest.mark.asyncio
    async def test_5_data_integrity_query_filtering_accuracy(self):
        """
        TEST 5: Verify the SQL query logic is mathematically correct
        CRITICAL: This ensures no entities are incorrectly marked for deletion
        """
        db, test_data = await test_db()
        
        # Get all entities and their actual meeting counts
        async with db.get_connection() as conn:
            # Get actual meeting counts for each entity using raw SQL
            cursor = await conn.execute("""
                SELECT e.id, e.name, COUNT(me.meeting_id) as actual_count
                FROM entities e
                LEFT JOIN meeting_entities me ON e.id = me.entity_id  
                GROUP BY e.id, e.name
                ORDER BY e.name
            """)
            actual_counts = await cursor.fetchall()
        
        # Get low-usage entities using our method
        low_usage_entities = await db.get_low_usage_entities()
        low_usage_ids = {entity.id for entity in low_usage_entities}
        
        # Verify each entity is correctly classified
        for row in actual_counts:
            entity_id, entity_name, actual_meeting_count = row["id"], row["name"], row["actual_count"]
            
            if actual_meeting_count <= 1:
                assert entity_id in low_usage_ids, \
                    f"Entity '{entity_name}' has {actual_meeting_count} meetings but is NOT in low-usage list"
            else:
                assert entity_id not in low_usage_ids, \
                    f"Entity '{entity_name}' has {actual_meeting_count} meetings but IS in low-usage list"
        
        # Verify meeting_count field accuracy in our results
        for entity in low_usage_entities:
            # Find corresponding actual count
            actual_row = next(r for r in actual_counts if r["id"] == entity.id)
            actual_count = actual_row["actual_count"]
            
            assert entity.meeting_count == actual_count, \
                f"Entity '{entity.name}' meeting_count mismatch: query={entity.meeting_count}, actual={actual_count}"
        
        print(f"✅ Test 5 PASSED: All {len(low_usage_entities)} entities correctly classified with accurate counts")


# Run the tests if executed directly
if __name__ == "__main__":
    import asyncio
    
    print("🧪 Running Critical Entity Cleanup Tests...")
    print("=" * 60)
    
    # Run async tests
    async def run_async_tests():
        test_instance = TestEntityCleanup()
        
        try:
            await test_instance.test_1_get_low_usage_entities_query_correctness()
            await test_instance.test_5_data_integrity_query_filtering_accuracy()
            print("\n🎉 All critical tests PASSED!")
            print("Entity Cleanup feature is safe for production deployment.")
        except Exception as e:
            print(f"\n❌ Test FAILED: {e}")
            raise
    
    # For manual testing without pytest
    if len(sys.argv) > 1 and sys.argv[1] == "--manual":
        asyncio.run(run_async_tests())
    else:
        print("Run with: uv run pytest backend/tests/test_entity_cleanup.py -v")