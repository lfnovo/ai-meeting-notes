import aiosqlite
import os
from datetime import datetime
from typing import List, Optional, Dict, Any
from contextlib import asynccontextmanager

from loguru import logger

from .models import (
    Entity, Meeting, ActionItem, MeetingEntity, EntityTypeModel, MeetingType,
    EntityCreate, EntityUpdate, MeetingCreate, MeetingUpdate,
    ActionItemCreate, ActionItemUpdate, EntityTypeCreate, EntityTypeUpdate,
    MeetingTypeCreate, MeetingTypeUpdate, EntityWithType, EntityLowUsage
)


class DatabaseManager:
    """Database abstraction layer for easy switching between database backends"""
    
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.db_path = database_url.replace("sqlite:///", "")
    
    @asynccontextmanager
    async def get_connection(self):
        """Get database connection with automatic cleanup"""
        conn = await aiosqlite.connect(self.db_path)
        conn.row_factory = aiosqlite.Row
        
        # Enable foreign key constraints for proper CASCADE behavior
        await conn.execute("PRAGMA foreign_keys = ON")
        
        try:
            yield conn
        finally:
            await conn.close()
    
    async def init_database(self) -> None:
        """Initialize database tables"""
        async with self.get_connection() as conn:
            # Create entity_types table first
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS entity_types (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    slug TEXT NOT NULL UNIQUE,
                    color_class TEXT NOT NULL,
                    description TEXT,
                    is_system BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Insert default entity types if they don't exist
            default_types = [
                ('Person', 'person', 'bg-blue-100 text-blue-800 border-blue-200', 'Individual people', True),
                ('Company', 'company', 'bg-green-100 text-green-800 border-green-200', 'Organizations and businesses', True),
                ('Project', 'project', 'bg-purple-100 text-purple-800 border-purple-200', 'Projects and initiatives', True),
                ('Other', 'other', 'bg-gray-100 text-gray-800 border-gray-200', 'Miscellaneous entities', True),
            ]
            
            for name, slug, color_class, description, is_system in default_types:
                await conn.execute("""
                    INSERT OR IGNORE INTO entity_types (name, slug, color_class, description, is_system)
                    VALUES (?, ?, ?, ?, ?)
                """, (name, slug, color_class, description, is_system))
            
            # Create meeting_types table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS meeting_types (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL UNIQUE,
                    slug TEXT NOT NULL UNIQUE,
                    description TEXT,
                    summary_instructions TEXT,
                    entity_instructions TEXT,
                    action_item_instructions TEXT,
                    is_system BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Insert default meeting types if they don't exist
            default_meeting_types = [
                ('General Meeting', 'general', 'Default meeting type for general discussions', None, None, None, True),
                ('Daily Standup', 'standup', 'Daily team standup meetings', 
                 'Focus on what was accomplished yesterday, what will be done today, and any blockers or impediments.',
                 'Extract team member names, projects being worked on, and any tools or systems mentioned.',
                 'Identify blockers, impediments, or action items that need to be addressed by the team or individuals.', True),
                ('Sprint Planning', 'sprint-planning', 'Sprint planning and story estimation meetings',
                 'Summarize the sprint goals, stories planned, capacity discussions, and any major decisions about scope or timeline.',
                 'Extract team member names, user stories, epics, and any external stakeholders mentioned.',
                 'Capture story assignments, estimation decisions, and any follow-up tasks for story refinement.', True),
                ('Retrospective', 'retrospective', 'Team retrospective meetings',
                 'Focus on what went well, what could be improved, and key takeaways from the period being reviewed.',
                 'Extract team member names, processes, tools, and any external factors mentioned.',
                 'Identify specific action items for process improvements and who will own them.', True),
                ('Client Meeting', 'client-meeting', 'Meetings with external clients or stakeholders',
                 'Emphasize client requirements, feedback, decisions made, and next steps in the relationship.',
                 'Extract client names, company names, project names, and any deliverables or systems discussed.',
                 'Focus on client requests, commitments made, deliverables promised, and follow-up actions.', True),
            ]
            
            for name, slug, description, summary_instr, entity_instr, action_instr, is_system in default_meeting_types:
                await conn.execute("""
                    INSERT OR IGNORE INTO meeting_types (name, slug, description, summary_instructions, entity_instructions, action_item_instructions, is_system)
                    VALUES (?, ?, ?, ?, ?, ?, ?)
                """, (name, slug, description, summary_instr, entity_instr, action_instr, is_system))
            
            # Check if entities table needs migration
            cursor = await conn.execute("PRAGMA table_info(entities)")
            columns = {row[1] for row in await cursor.fetchall()}
            
            if 'type' in columns and 'type_slug' not in columns:
                # Migrate existing entities table
                await conn.execute("""
                    ALTER TABLE entities ADD COLUMN type_slug TEXT
                """)
                
                # Update existing data
                await conn.execute("""
                    UPDATE entities SET type_slug = type WHERE type_slug IS NULL
                """)
                
                # Create new entities table with proper foreign key
                await conn.execute("""
                    CREATE TABLE entities_new (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE,
                        type_slug TEXT NOT NULL,
                        description TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (type_slug) REFERENCES entity_types (slug)
                    )
                """)
                
                # Copy data to new table
                await conn.execute("""
                    INSERT INTO entities_new (id, name, type_slug, description, created_at)
                    SELECT id, name, type_slug, description, created_at FROM entities
                """)
                
                # Drop old table and rename new one
                await conn.execute("DROP TABLE entities")
                await conn.execute("ALTER TABLE entities_new RENAME TO entities")
            else:
                # Create entities table with proper schema
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS entities (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL UNIQUE,
                        type_slug TEXT NOT NULL,
                        description TEXT,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (type_slug) REFERENCES entity_types (slug)
                    )
                """)
            
            # Check if meetings table needs migration for meeting_type_slug
            cursor = await conn.execute("PRAGMA table_info(meetings)")
            meeting_columns = {row[1] for row in await cursor.fetchall()}
            
            if 'meeting_type_slug' not in meeting_columns:
                # Create meetings table or add meeting_type_slug column
                if not meeting_columns:
                    # Table doesn't exist, create it with all columns
                    await conn.execute("""
                        CREATE TABLE meetings (
                            id INTEGER PRIMARY KEY AUTOINCREMENT,
                            title TEXT NOT NULL,
                            date TIMESTAMP NOT NULL,
                            transcript TEXT,
                            summary TEXT,
                            audio_file_path TEXT,
                            meeting_type_slug TEXT NOT NULL DEFAULT 'general',
                            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            FOREIGN KEY (meeting_type_slug) REFERENCES meeting_types (slug)
                        )
                    """)
                else:
                    # Table exists, add the new column
                    await conn.execute("""
                        ALTER TABLE meetings ADD COLUMN meeting_type_slug TEXT NOT NULL DEFAULT 'general'
                    """)
                    
                    # Add foreign key constraint (SQLite doesn't support adding FK constraints directly)
                    # For now, we'll rely on application-level validation
            else:
                # Create meetings table with all columns if it doesn't exist
                await conn.execute("""
                    CREATE TABLE IF NOT EXISTS meetings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        title TEXT NOT NULL,
                        date TIMESTAMP NOT NULL,
                        transcript TEXT,
                        summary TEXT,
                        audio_file_path TEXT,
                        meeting_type_slug TEXT NOT NULL DEFAULT 'general',
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (meeting_type_slug) REFERENCES meeting_types (slug)
                    )
                """)
            
            # Create action_items table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS action_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    meeting_id INTEGER NOT NULL,
                    description TEXT NOT NULL,
                    assignee TEXT,
                    due_date TIMESTAMP,
                    status TEXT NOT NULL DEFAULT 'pending' 
                        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
                )
            """)
            
            # Create meeting_entities junction table
            await conn.execute("""
                CREATE TABLE IF NOT EXISTS meeting_entities (
                    meeting_id INTEGER NOT NULL,
                    entity_id INTEGER NOT NULL,
                    PRIMARY KEY (meeting_id, entity_id),
                    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
                    FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
                )
            """)
            
            # Create indexes for better performance
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings (date)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings (meeting_type_slug)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_entities_name ON entities (name)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items (meeting_id)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items (status)")
            await conn.execute("CREATE INDEX IF NOT EXISTS idx_meeting_types_slug ON meeting_types (slug)")
            
            await conn.commit()
            logger.info("Database initialized successfully")
    
    # Entity Type operations
    async def create_entity_type(self, entity_type_data: EntityTypeCreate) -> EntityTypeModel:
        """Create a new entity type"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                INSERT INTO entity_types (name, slug, color_class, description)
                VALUES (?, ?, ?, ?)
            """, (entity_type_data.name, entity_type_data.slug, entity_type_data.color_class, entity_type_data.description))
            
            type_id = cursor.lastrowid
            await conn.commit()
            
            return await self.get_entity_type_by_id(type_id)
    
    async def get_entity_type_by_id(self, type_id: int) -> Optional[EntityTypeModel]:
        """Get entity type by ID"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM entity_types WHERE id = ?
            """, (type_id,))
            row = await cursor.fetchone()
            
            if row:
                return EntityTypeModel(**dict(row))
            return None
    
    async def get_entity_type_by_slug(self, slug: str) -> Optional[EntityTypeModel]:
        """Get entity type by slug"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM entity_types WHERE slug = ?
            """, (slug,))
            row = await cursor.fetchone()
            
            if row:
                return EntityTypeModel(**dict(row))
            return None
    
    async def get_entity_types(self) -> List[EntityTypeModel]:
        """Get all entity types"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM entity_types 
                ORDER BY name
            """)
            rows = await cursor.fetchall()
            
            return [EntityTypeModel(**dict(row)) for row in rows]
    
    async def update_entity_type(self, type_id: int, entity_type_data: EntityTypeUpdate) -> Optional[EntityTypeModel]:
        """Update an entity type"""
        updates = []
        values = []
        
        if entity_type_data.name is not None:
            updates.append("name = ?")
            values.append(entity_type_data.name)
        if entity_type_data.color_class is not None:
            updates.append("color_class = ?")
            values.append(entity_type_data.color_class)
        if entity_type_data.description is not None:
            updates.append("description = ?")
            values.append(entity_type_data.description)
        
        if not updates:
            return await self.get_entity_type_by_id(type_id)
        
        values.append(type_id)
        
        async with self.get_connection() as conn:
            await conn.execute(f"""
                UPDATE entity_types 
                SET {', '.join(updates)}
                WHERE id = ?
            """, values)
            await conn.commit()
            
            return await self.get_entity_type_by_id(type_id)
    
    async def delete_entity_type(self, type_id: int) -> bool:
        """Delete an entity type (only if it's not a system type and not in use)"""
        async with self.get_connection() as conn:
            # Check if it's a system type
            cursor = await conn.execute("SELECT is_system FROM entity_types WHERE id = ?", (type_id,))
            row = await cursor.fetchone()
            if not row or row[0]:  # is_system is True
                return False
            
            # Check if any entities use this type
            cursor = await conn.execute("""
                SELECT COUNT(*) FROM entities e 
                JOIN entity_types et ON e.type_slug = et.slug 
                WHERE et.id = ?
            """, (type_id,))
            count = (await cursor.fetchone())[0]
            if count > 0:
                return False
            
            # Safe to delete
            cursor = await conn.execute("DELETE FROM entity_types WHERE id = ?", (type_id,))
            await conn.commit()
            return cursor.rowcount > 0
    
    # Meeting Type operations
    async def create_meeting_type(self, meeting_type_data: MeetingTypeCreate) -> MeetingType:
        """Create a new meeting type"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                INSERT INTO meeting_types (name, slug, description, summary_instructions, entity_instructions, action_item_instructions)
                VALUES (?, ?, ?, ?, ?, ?)
            """, (meeting_type_data.name, meeting_type_data.slug, meeting_type_data.description, 
                  meeting_type_data.summary_instructions, meeting_type_data.entity_instructions, 
                  meeting_type_data.action_item_instructions))
            
            type_id = cursor.lastrowid
            await conn.commit()
            
            return await self.get_meeting_type_by_id(type_id)
    
    async def get_meeting_type_by_id(self, type_id: int) -> Optional[MeetingType]:
        """Get meeting type by ID"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM meeting_types WHERE id = ?
            """, (type_id,))
            row = await cursor.fetchone()
            
            if row:
                return MeetingType(**dict(row))
            return None
    
    async def get_meeting_type_by_slug(self, slug: str) -> Optional[MeetingType]:
        """Get meeting type by slug"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM meeting_types WHERE slug = ?
            """, (slug,))
            row = await cursor.fetchone()
            
            if row:
                return MeetingType(**dict(row))
            return None
    
    async def get_meeting_types(self) -> List[MeetingType]:
        """Get all meeting types"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM meeting_types ORDER BY name
            """)
            rows = await cursor.fetchall()
            
            return [MeetingType(**dict(row)) for row in rows]
    
    async def update_meeting_type(self, type_id: int, meeting_type_update: MeetingTypeUpdate) -> Optional[MeetingType]:
        """Update a meeting type"""
        async with self.get_connection() as conn:
            # Build update query dynamically based on provided fields
            update_fields = []
            update_values = []
            
            if meeting_type_update.name is not None:
                update_fields.append("name = ?")
                update_values.append(meeting_type_update.name)
            
            if meeting_type_update.description is not None:
                update_fields.append("description = ?")
                update_values.append(meeting_type_update.description)
            
            if meeting_type_update.summary_instructions is not None:
                update_fields.append("summary_instructions = ?")
                update_values.append(meeting_type_update.summary_instructions)
            
            if meeting_type_update.entity_instructions is not None:
                update_fields.append("entity_instructions = ?")
                update_values.append(meeting_type_update.entity_instructions)
            
            if meeting_type_update.action_item_instructions is not None:
                update_fields.append("action_item_instructions = ?")
                update_values.append(meeting_type_update.action_item_instructions)
            
            if not update_fields:
                return await self.get_meeting_type_by_id(type_id)
            
            update_values.append(type_id)
            
            cursor = await conn.execute(f"""
                UPDATE meeting_types 
                SET {', '.join(update_fields)}
                WHERE id = ?
            """, update_values)
            
            await conn.commit()
            
            if cursor.rowcount > 0:
                return await self.get_meeting_type_by_id(type_id)
            return None
    
    async def delete_meeting_type(self, type_id: int) -> bool:
        """Delete a meeting type"""
        async with self.get_connection() as conn:
            # Check if it's a system type
            cursor = await conn.execute("""
                SELECT is_system FROM meeting_types WHERE id = ?
            """, (type_id,))
            row = await cursor.fetchone()
            
            if not row or row[0]:  # System types cannot be deleted
                return False
            
            # Check if any meetings are using this type
            cursor = await conn.execute("""
                SELECT COUNT(*) FROM meetings WHERE meeting_type_slug = (
                    SELECT slug FROM meeting_types WHERE id = ?
                )
            """, (type_id,))
            count = await cursor.fetchone()
            
            if count and count[0] > 0:  # Type is in use
                return False
            
            cursor = await conn.execute("""
                DELETE FROM meeting_types WHERE id = ?
            """, (type_id,))
            await conn.commit()
            
            return cursor.rowcount > 0
    
    # Entity operations
    async def create_entity(self, entity_data: EntityCreate) -> EntityWithType:
        """Create a new entity"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                INSERT INTO entities (name, type_slug, description)
                VALUES (?, ?, ?)
            """, (entity_data.name, entity_data.type_slug, entity_data.description))
            
            entity_id = cursor.lastrowid
            await conn.commit()
            
            return await self.get_entity_by_id(entity_id)
    
    async def get_entity_by_id(self, entity_id: int) -> Optional[EntityWithType]:
        """Get entity by ID with type information"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT e.*, et.name as type_name, et.color_class as type_color_class
                FROM entities e
                JOIN entity_types et ON e.type_slug = et.slug
                WHERE e.id = ?
            """, (entity_id,))
            row = await cursor.fetchone()
            
            if row:
                return EntityWithType(**dict(row))
            return None
    
    async def get_entities(self, limit: int = 100, offset: int = 0) -> List[EntityWithType]:
        """Get all entities with type information and pagination"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT e.*, et.name as type_name, et.color_class as type_color_class
                FROM entities e
                JOIN entity_types et ON e.type_slug = et.slug
                ORDER BY e.name
                LIMIT ? OFFSET ?
            """, (limit, offset))
            rows = await cursor.fetchall()
            
            return [EntityWithType(**dict(row)) for row in rows]
    
    async def update_entity(self, entity_id: int, entity_data: EntityUpdate) -> Optional[EntityWithType]:
        """Update an entity"""
        updates = []
        values = []
        
        if entity_data.name is not None:
            updates.append("name = ?")
            values.append(entity_data.name)
        if entity_data.type_slug is not None:
            updates.append("type_slug = ?")
            values.append(entity_data.type_slug)
        if entity_data.description is not None:
            updates.append("description = ?")
            values.append(entity_data.description)
        
        if not updates:
            return await self.get_entity_by_id(entity_id)
        
        values.append(entity_id)
        
        async with self.get_connection() as conn:
            await conn.execute(f"""
                UPDATE entities 
                SET {', '.join(updates)}
                WHERE id = ?
            """, values)
            await conn.commit()
            
            return await self.get_entity_by_id(entity_id)
    
    async def delete_entity(self, entity_id: int) -> bool:
        """Delete an entity and all its relationships"""
        async with self.get_connection() as conn:
            # First, check if entity exists
            cursor = await conn.execute("SELECT COUNT(*) FROM entities WHERE id = ?", (entity_id,))
            count = (await cursor.fetchone())[0]
            
            if count == 0:
                return False
            
            try:
                # Begin transaction (SQLite autocommit is off inside the connection context)
                # First delete all relationships in meeting_entities junction table
                await conn.execute("DELETE FROM meeting_entities WHERE entity_id = ?", (entity_id,))
                
                # Then delete the entity itself
                cursor = await conn.execute("DELETE FROM entities WHERE id = ?", (entity_id,))
                
                # Commit the transaction
                await conn.commit()
                
                # Return True if entity was actually deleted
                return cursor.rowcount > 0
                
            except Exception as e:
                # Rollback transaction on error
                await conn.rollback()
                logger.error(f"Error deleting entity {entity_id}: {e}")
                return False
    
    async def get_low_usage_entities(self) -> List[EntityLowUsage]:
        """Get entities that appear in exactly 1 meeting"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                WITH low_usage_entity_ids AS (
                    SELECT entity_id
                    FROM meeting_entities
                    GROUP BY entity_id
                    HAVING COUNT(meeting_id) = 1
                )
                SELECT 
                    e.id,
                    e.name,
                    e.type_slug,
                    e.description,
                    e.created_at,
                    m.id as meeting_id,
                    m.title as meeting_title,
                    m.date as meeting_date,
                    et.name as type_name,
                    et.color_class as color_class
                FROM entities e
                JOIN entity_types et ON e.type_slug = et.slug
                JOIN meeting_entities me ON e.id = me.entity_id
                JOIN meetings m ON me.meeting_id = m.id
                WHERE e.id IN (SELECT entity_id FROM low_usage_entity_ids)
                ORDER BY e.created_at DESC
            """)
            rows = await cursor.fetchall()
            
            return [EntityLowUsage(**dict(row)) for row in rows]
    
    # Meeting operations
    async def create_meeting(self, meeting_data: MeetingCreate) -> Meeting:
        """Create a new meeting"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                INSERT INTO meetings (title, date, transcript)
                VALUES (?, ?, ?)
            """, (meeting_data.title, meeting_data.date, meeting_data.transcript))
            
            meeting_id = cursor.lastrowid
            await conn.commit()
            
            return await self.get_meeting_by_id(meeting_id)
    
    async def get_meeting_by_id(self, meeting_id: int) -> Optional[Meeting]:
        """Get meeting by ID"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM meetings WHERE id = ?
            """, (meeting_id,))
            row = await cursor.fetchone()
            
            if row:
                return Meeting(**dict(row))
            return None
    
    async def get_meetings(self, limit: int = 50, offset: int = 0) -> List[Meeting]:
        """Get all meetings ordered by date (newest first)"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM meetings 
                ORDER BY date DESC
                LIMIT ? OFFSET ?
            """, (limit, offset))
            rows = await cursor.fetchall()
            
            return [Meeting(**dict(row)) for row in rows]
    
    async def update_meeting(self, meeting_id: int, meeting_data: MeetingUpdate) -> Optional[Meeting]:
        """Update a meeting"""
        updates = []
        values = []
        
        if meeting_data.title is not None:
            updates.append("title = ?")
            values.append(meeting_data.title)
        if meeting_data.date is not None:
            updates.append("date = ?")
            values.append(meeting_data.date)
        if meeting_data.transcript is not None:
            updates.append("transcript = ?")
            values.append(meeting_data.transcript)
        if meeting_data.summary is not None:
            updates.append("summary = ?")
            values.append(meeting_data.summary)
        
        if not updates:
            return await self.get_meeting_by_id(meeting_id)
        
        values.append(meeting_id)
        
        async with self.get_connection() as conn:
            await conn.execute(f"""
                UPDATE meetings 
                SET {', '.join(updates)}
                WHERE id = ?
            """, values)
            await conn.commit()
            
            return await self.get_meeting_by_id(meeting_id)
    
    async def delete_meeting(self, meeting_id: int) -> bool:
        """Delete a meeting"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
            await conn.commit()
            return cursor.rowcount > 0
    
    # Action item operations
    async def create_action_item(self, meeting_id: int, action_data: ActionItemCreate) -> ActionItem:
        """Create a new action item"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                INSERT INTO action_items (meeting_id, description, assignee, due_date, status)
                VALUES (?, ?, ?, ?, ?)
            """, (meeting_id, action_data.description, action_data.assignee, 
                  action_data.due_date, action_data.status.value))
            
            action_id = cursor.lastrowid
            await conn.commit()
            
            return await self.get_action_item_by_id(action_id)
    
    async def get_action_item_by_id(self, action_id: int) -> Optional[ActionItem]:
        """Get action item by ID"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM action_items WHERE id = ?
            """, (action_id,))
            row = await cursor.fetchone()
            
            if row:
                return ActionItem(**dict(row))
            return None
    
    async def get_action_items_by_meeting(self, meeting_id: int) -> List[ActionItem]:
        """Get all action items for a meeting"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT * FROM action_items 
                WHERE meeting_id = ?
                ORDER BY created_at
            """, (meeting_id,))
            rows = await cursor.fetchall()
            
            return [ActionItem(**dict(row)) for row in rows]
    
    # Meeting-Entity relationship operations
    async def add_entity_to_meeting(self, meeting_id: int, entity_id: int) -> None:
        """Add an entity to a meeting"""
        async with self.get_connection() as conn:
            await conn.execute("""
                INSERT OR IGNORE INTO meeting_entities (meeting_id, entity_id)
                VALUES (?, ?)
            """, (meeting_id, entity_id))
            await conn.commit()
    
    async def remove_entity_from_meeting(self, meeting_id: int, entity_id: int) -> bool:
        """Remove an entity from a meeting"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                DELETE FROM meeting_entities 
                WHERE meeting_id = ? AND entity_id = ?
            """, (meeting_id, entity_id))
            await conn.commit()
            return cursor.rowcount > 0
    
    async def get_entities_by_meeting(self, meeting_id: int) -> List[EntityWithType]:
        """Get all entities for a meeting with type information"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT e.*, et.name as type_name, et.color_class as type_color_class
                FROM entities e
                JOIN meeting_entities me ON e.id = me.entity_id
                JOIN entity_types et ON e.type_slug = et.slug
                WHERE me.meeting_id = ?
                ORDER BY e.name
            """, (meeting_id,))
            rows = await cursor.fetchall()
            
            return [EntityWithType(**dict(row)) for row in rows]
    
    async def get_meetings_by_entity(self, entity_id: int) -> List[Meeting]:
        """Get all meetings for an entity"""
        async with self.get_connection() as conn:
            cursor = await conn.execute("""
                SELECT m.* FROM meetings m
                JOIN meeting_entities me ON m.id = me.meeting_id
                WHERE me.entity_id = ?
                ORDER BY m.date DESC
            """, (entity_id,))
            rows = await cursor.fetchall()
            
            return [Meeting(**dict(row)) for row in rows]


# Global database instance
db_manager: Optional[DatabaseManager] = None


def get_database() -> DatabaseManager:
    """Get the global database instance"""
    global db_manager
    if db_manager is None:
        database_url = os.getenv("DATABASE_URL", "sqlite:///./meetings.db")
        db_manager = DatabaseManager(database_url)
    return db_manager


async def init_db() -> None:
    """Initialize the database"""
    db = get_database()
    await db.init_database()