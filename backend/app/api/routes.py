import os
from datetime import datetime
from typing import List, Optional
from pathlib import Path

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, Depends
from fastapi.responses import JSONResponse
from loguru import logger

from ..database import get_database, DatabaseManager
from ..models import (
    Entity, Meeting, ActionItem, EntityTypeModel, MeetingType,
    EntityCreate, EntityUpdate, EntityBulkDelete, EntityBulkUpdateType, 
    MeetingCreate, MeetingUpdate,
    ActionItemCreate, ActionItemUpdate,
    EntityTypeCreate, EntityTypeUpdate,
    MeetingTypeCreate, MeetingTypeUpdate,
    MeetingWithEntities, EntityWithMeetings, EntityWithType,
    MeetingProcessRequest, EntityLowUsage
)
from ..services.meeting_processor import MeetingProcessor
from ..services.entity_manager import EntityManager


router = APIRouter()


# Dependency to get database
def get_db() -> DatabaseManager:
    return get_database()


# Dependency to get meeting processor
def get_meeting_processor() -> MeetingProcessor:
    return MeetingProcessor()


# Dependency to get entity manager
def get_entity_manager() -> EntityManager:
    return EntityManager()


# Entity Type endpoints
@router.post("/entity-types", response_model=EntityTypeModel)
async def create_entity_type(
    entity_type: EntityTypeCreate,
    db: DatabaseManager = Depends(get_db)
):
    """Create a new entity type"""
    try:
        # Check if slug already exists
        existing = await db.get_entity_type_by_slug(entity_type.slug)
        if existing:
            raise HTTPException(status_code=400, detail="Entity type slug already exists")
        
        return await db.create_entity_type(entity_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating entity type: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/entity-types", response_model=List[EntityTypeModel])
async def list_entity_types(db: DatabaseManager = Depends(get_db)):
    """List all entity types"""
    try:
        return await db.get_entity_types()
    except Exception as e:
        logger.error(f"Error listing entity types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/entity-types/{type_id}", response_model=EntityTypeModel)
async def get_entity_type(
    type_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific entity type by ID"""
    entity_type = await db.get_entity_type_by_id(type_id)
    if not entity_type:
        raise HTTPException(status_code=404, detail="Entity type not found")
    return entity_type


@router.put("/entity-types/{type_id}", response_model=EntityTypeModel)
async def update_entity_type(
    type_id: int,
    entity_type_update: EntityTypeUpdate,
    db: DatabaseManager = Depends(get_db)
):
    """Update an entity type"""
    entity_type = await db.update_entity_type(type_id, entity_type_update)
    if not entity_type:
        raise HTTPException(status_code=404, detail="Entity type not found")
    return entity_type


@router.delete("/entity-types/{type_id}")
async def delete_entity_type(
    type_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Delete an entity type"""
    success = await db.delete_entity_type(type_id)
    if not success:
        # Check if it exists to provide better error message
        entity_type = await db.get_entity_type_by_id(type_id)
        if not entity_type:
            raise HTTPException(status_code=404, detail="Entity type not found")
        else:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete system entity type or entity type in use"
            )
    return {"success": True}


# Meeting Type endpoints
@router.post("/meeting-types", response_model=MeetingType)
async def create_meeting_type(
    meeting_type: MeetingTypeCreate,
    db: DatabaseManager = Depends(get_db)
):
    """Create a new meeting type"""
    try:
        # Check if slug already exists
        existing = await db.get_meeting_type_by_slug(meeting_type.slug)
        if existing:
            raise HTTPException(status_code=400, detail="Meeting type slug already exists")
        
        return await db.create_meeting_type(meeting_type)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating meeting type: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/meeting-types", response_model=List[MeetingType])
async def list_meeting_types(db: DatabaseManager = Depends(get_db)):
    """List all meeting types"""
    try:
        return await db.get_meeting_types()
    except Exception as e:
        logger.error(f"Error listing meeting types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meeting-types/{type_id}", response_model=MeetingType)
async def get_meeting_type(
    type_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific meeting type by ID"""
    meeting_type = await db.get_meeting_type_by_id(type_id)
    if not meeting_type:
        raise HTTPException(status_code=404, detail="Meeting type not found")
    return meeting_type


@router.put("/meeting-types/{type_id}", response_model=MeetingType)
async def update_meeting_type(
    type_id: int,
    meeting_type_update: MeetingTypeUpdate,
    db: DatabaseManager = Depends(get_db)
):
    """Update a meeting type"""
    meeting_type = await db.update_meeting_type(type_id, meeting_type_update)
    if not meeting_type:
        raise HTTPException(status_code=404, detail="Meeting type not found")
    return meeting_type


@router.delete("/meeting-types/{type_id}")
async def delete_meeting_type(
    type_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Delete a meeting type"""
    success = await db.delete_meeting_type(type_id)
    if not success:
        # Check if it exists to provide better error message
        meeting_type = await db.get_meeting_type_by_id(type_id)
        if not meeting_type:
            raise HTTPException(status_code=404, detail="Meeting type not found")
        else:
            raise HTTPException(
                status_code=400, 
                detail="Cannot delete system meeting type or meeting type in use"
            )
    return {"success": True}


# Entity endpoints
@router.post("/entities", response_model=EntityWithType)
async def create_entity(
    entity: EntityCreate,
    db: DatabaseManager = Depends(get_db)
):
    """Create a new entity"""
    try:
        # Validate that the entity type exists
        entity_type = await db.get_entity_type_by_slug(entity.type_slug)
        if not entity_type:
            raise HTTPException(status_code=400, detail="Invalid entity type")
        
        return await db.create_entity(entity)
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating entity: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/entities", response_model=List[EntityWithType])
async def list_entities(
    limit: int = 100,
    offset: int = 0,
    db: DatabaseManager = Depends(get_db)
):
    """List all entities with pagination"""
    try:
        return await db.get_entities(limit=limit, offset=offset)
    except Exception as e:
        logger.error(f"Error listing entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/entities/low-usage", response_model=List[EntityLowUsage])
async def get_low_usage_entities(db: DatabaseManager = Depends(get_db)):
    """Get entities that appear in exactly 1 meeting (low usage entities)"""
    try:
        return await db.get_low_usage_entities()
    except Exception as e:
        logger.error(f"Error retrieving low usage entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/entities/{entity_id}", response_model=EntityWithType)
async def get_entity(
    entity_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific entity by ID"""
    entity = await db.get_entity_by_id(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity


@router.put("/entities/{entity_id}", response_model=EntityWithType)
async def update_entity(
    entity_id: int,
    entity_update: EntityUpdate,
    db: DatabaseManager = Depends(get_db)
):
    """Update an entity"""
    try:
        # Validate entity type if being updated
        if entity_update.type_slug:
            entity_type = await db.get_entity_type_by_slug(entity_update.type_slug)
            if not entity_type:
                raise HTTPException(status_code=400, detail="Invalid entity type")
        
        entity = await db.update_entity(entity_id, entity_update)
        if not entity:
            raise HTTPException(status_code=404, detail="Entity not found")
        return entity
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating entity: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/entities/{entity_id}")
async def delete_entity(
    entity_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Delete an entity"""
    success = await db.delete_entity(entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entity not found")
    return {"message": "Entity deleted successfully"}


@router.post("/entities/bulk-delete")
async def bulk_delete_entities(
    request: EntityBulkDelete,
    db: DatabaseManager = Depends(get_db)
):
    """Delete multiple entities by IDs"""
    try:
        entity_ids = request.ids
        deleted_count = 0
        failed_ids = []
        
        for entity_id in entity_ids:
            success = await db.delete_entity(entity_id)
            if success:
                deleted_count += 1
            else:
                failed_ids.append(entity_id)
        
        return {
            "message": f"Successfully deleted {deleted_count} entities",
            "deleted_count": deleted_count,
            "failed_ids": failed_ids
        }
        
    except Exception as e:
        logger.error(f"Error bulk deleting entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/entities/bulk-update-type")
async def bulk_update_entity_types(
    request: EntityBulkUpdateType,
    db: DatabaseManager = Depends(get_db)
):
    """Update type for multiple entities"""
    try:
        # Validate that the entity type exists
        entity_type = await db.get_entity_type_by_slug(request.type_slug)
        if not entity_type:
            raise HTTPException(status_code=400, detail="Invalid entity type")
        
        entity_ids = request.ids
        updated_count = 0
        failed_ids = []
        
        for entity_id in entity_ids:
            try:
                # Update only the type_slug field
                entity = await db.update_entity(
                    entity_id, 
                    EntityUpdate(type_slug=request.type_slug)
                )
                if entity:
                    updated_count += 1
                else:
                    failed_ids.append(entity_id)
            except Exception as e:
                logger.warning(f"Failed to update entity {entity_id}: {e}")
                failed_ids.append(entity_id)
        
        return {
            "message": f"Successfully updated {updated_count} entities to type '{entity_type.name}'",
            "updated_count": updated_count,
            "failed_ids": failed_ids
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error bulk updating entity types: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/entities/{entity_id}/meetings", response_model=List[Meeting])
async def get_entity_meetings(
    entity_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Get all meetings for a specific entity"""
    # Check if entity exists
    entity = await db.get_entity_by_id(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    return await db.get_meetings_by_entity(entity_id)



# Meeting endpoints
@router.post("/meetings", response_model=Meeting)
async def create_meeting(
    meeting: MeetingCreate,
    db: DatabaseManager = Depends(get_db)
):
    """Create a new meeting"""
    try:
        new_meeting = await db.create_meeting(meeting)
        
        # Add entities to meeting if provided
        if meeting.entity_ids:
            for entity_id in meeting.entity_ids:
                await db.add_entity_to_meeting(new_meeting.id, entity_id)
        
        return new_meeting
    except Exception as e:
        logger.error(f"Error creating meeting: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/meetings", response_model=List[Meeting])
async def list_meetings(
    limit: int = 50,
    offset: int = 0,
    db: DatabaseManager = Depends(get_db)
):
    """List all meetings with pagination, ordered by date (newest first)"""
    try:
        return await db.get_meetings(limit=limit, offset=offset)
    except Exception as e:
        logger.error(f"Error listing meetings: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/meetings/{meeting_id}", response_model=MeetingWithEntities)
async def get_meeting(
    meeting_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Get a specific meeting with its entities and action items"""
    meeting = await db.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    # Get related entities and action items
    entities = await db.get_entities_by_meeting(meeting_id)
    action_items = await db.get_action_items_by_meeting(meeting_id)
    
    return MeetingWithEntities(
        **meeting.model_dump(),
        entities=entities,
        action_items=action_items
    )


@router.put("/meetings/{meeting_id}", response_model=Meeting)
async def update_meeting(
    meeting_id: int,
    meeting_update: MeetingUpdate,
    db: DatabaseManager = Depends(get_db)
):
    """Update a meeting"""
    meeting = await db.update_meeting(meeting_id, meeting_update)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return meeting


@router.delete("/meetings/{meeting_id}")
async def delete_meeting(
    meeting_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Delete a meeting"""
    success = await db.delete_meeting(meeting_id)
    if not success:
        raise HTTPException(status_code=404, detail="Meeting not found")
    return {"message": "Meeting deleted successfully"}


# Meeting processing endpoints
@router.post("/meetings/process")
async def process_meeting(
    title: str = Form(...),
    date: str = Form(...),
    transcript: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    entity_ids: Optional[str] = Form(None),  # JSON string of entity IDs
    meeting_type_slug: Optional[str] = Form('general'),  # Meeting type slug
    db: DatabaseManager = Depends(get_db),
    processor: MeetingProcessor = Depends(get_meeting_processor)
):
    """Process a meeting from transcript or audio file"""
    try:
        # Parse date
        meeting_date = datetime.fromisoformat(date.replace('Z', '+00:00'))
        
        # Parse entity IDs if provided
        entity_id_list = []
        if entity_ids:
            import json
            entity_id_list = json.loads(entity_ids)
        
        # Handle audio file upload if provided
        audio_file_path = None
        if audio_file:
            # Save uploaded file
            upload_dir = Path(os.getenv("UPLOAD_DIRECTORY", "./uploads"))
            upload_dir.mkdir(exist_ok=True)
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{timestamp}_{audio_file.filename}"
            audio_file_path = upload_dir / filename
            
            with open(audio_file_path, "wb") as f:
                content = await audio_file.read()
                f.write(content)
            
            logger.info(f"Audio file saved: {audio_file_path}")
        
        # Get meeting type for custom instructions
        meeting_type = None
        if meeting_type_slug:
            meeting_type = await db.get_meeting_type_by_slug(meeting_type_slug)
            if not meeting_type:
                logger.warning(f"Meeting type '{meeting_type_slug}' not found, using default processing")
        
        logger.info(f"Processing meeting with type: {meeting_type.name if meeting_type else 'Default'}")
        
        # Process the meeting
        result = await processor.process_meeting(
            transcript=transcript,
            audio_file_path=str(audio_file_path) if audio_file_path else None,
            meeting_type=meeting_type
        )
        
        # Create meeting in database
        meeting_create = MeetingCreate(
            title=title,
            date=meeting_date,
            transcript=result.transcript,
            meeting_type_slug=meeting_type_slug or 'general',
            entity_ids=entity_id_list
        )
        
        meeting = await db.create_meeting(meeting_create)
        
        # Update with processing results
        await db.update_meeting(meeting.id, MeetingUpdate(
            summary=result.summary,
            transcript=result.transcript
        ))
        
        # Add entities to meeting
        for entity_id in entity_id_list:
            await db.add_entity_to_meeting(meeting.id, entity_id)
        
        # Create action items
        for action_desc in result.action_items:
            action_item = ActionItemCreate(description=action_desc)
            await db.create_action_item(meeting.id, action_item)
        
        # Create new entities if needed
        entity_manager = get_entity_manager()
        await entity_manager.process_entities(result.entities, meeting.id, db)
        
        # Return the complete meeting
        return await get_meeting(meeting.id, db)
        
    except Exception as e:
        logger.error(f"Error processing meeting: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# Action item endpoints
@router.post("/meetings/{meeting_id}/action-items", response_model=ActionItem)
async def create_action_item(
    meeting_id: int,
    action_item: ActionItemCreate,
    db: DatabaseManager = Depends(get_db)
):
    """Create a new action item for a meeting"""
    # Check if meeting exists
    meeting = await db.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    try:
        return await db.create_action_item(meeting_id, action_item)
    except Exception as e:
        logger.error(f"Error creating action item: {e}")
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/meetings/{meeting_id}/action-items", response_model=List[ActionItem])
async def get_meeting_action_items(
    meeting_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Get all action items for a meeting"""
    # Check if meeting exists
    meeting = await db.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    return await db.get_action_items_by_meeting(meeting_id)


@router.put("/action-items/{action_id}", response_model=ActionItem)
async def update_action_item(
    action_id: int,
    action_update: ActionItemUpdate,
    db: DatabaseManager = Depends(get_db)
):
    """Update an action item"""
    # This would need to be implemented in the database manager
    # For now, return a placeholder
    raise HTTPException(status_code=501, detail="Action item update not implemented yet")


# Meeting-Entity relationship endpoints
@router.post("/meetings/{meeting_id}/entities/{entity_id}")
async def add_entity_to_meeting(
    meeting_id: int,
    entity_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Add an entity to a meeting"""
    # Check if meeting and entity exist
    meeting = await db.get_meeting_by_id(meeting_id)
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
    
    entity = await db.get_entity_by_id(entity_id)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    
    await db.add_entity_to_meeting(meeting_id, entity_id)
    return {"message": "Entity added to meeting successfully"}


@router.delete("/meetings/{meeting_id}/entities/{entity_id}")
async def remove_entity_from_meeting(
    meeting_id: int,
    entity_id: int,
    db: DatabaseManager = Depends(get_db)
):
    """Remove an entity from a meeting"""
    success = await db.remove_entity_from_meeting(meeting_id, entity_id)
    if not success:
        raise HTTPException(status_code=404, detail="Entity-meeting relationship not found")
    return {"message": "Entity removed from meeting successfully"}