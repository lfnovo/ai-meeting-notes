# Database Schema Implementation

## Overview

The AI Meeting Notes application uses SQLite with a carefully designed relational schema that supports dynamic entity types, flexible meeting categorization, and efficient relationship management. The schema emphasizes data integrity, performance, and extensibility.

## Complete Schema Definition

### Core Tables

#### entity_types
**Purpose**: Dynamic entity type system with styling information
```sql
CREATE TABLE entity_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,                    -- Display name: "Person", "Company"
    slug TEXT NOT NULL UNIQUE,                    -- URL-friendly: "person", "company"  
    color_class TEXT NOT NULL,                    -- CSS classes for styling
    description TEXT,                             -- Optional description
    is_system BOOLEAN DEFAULT FALSE,              -- System types cannot be deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Default Data**:
```sql
INSERT INTO entity_types (name, slug, color_class, description, is_system) VALUES
('Person', 'person', 'bg-blue-100 text-blue-800 border-blue-200', 'Individual people', TRUE),
('Company', 'company', 'bg-green-100 text-green-800 border-green-200', 'Organizations and businesses', TRUE),
('Project', 'project', 'bg-purple-100 text-purple-800 border-purple-200', 'Projects and initiatives', TRUE),
('Other', 'other', 'bg-gray-100 text-gray-800 border-gray-200', 'Miscellaneous entities', TRUE);
```

#### meeting_types
**Purpose**: Customizable meeting templates with AI processing instructions
```sql
CREATE TABLE meeting_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,                    -- Display name: "Daily Standup"
    slug TEXT NOT NULL UNIQUE,                    -- URL-friendly: "standup"
    description TEXT,                             -- Optional description
    summary_instructions TEXT,                    -- Custom AI summary prompts
    entity_instructions TEXT,                     -- Custom AI entity extraction
    action_item_instructions TEXT,                -- Custom AI action item extraction
    is_system BOOLEAN DEFAULT FALSE,              -- System types cannot be deleted
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Default Data**:
```sql
INSERT INTO meeting_types (name, slug, description, summary_instructions, entity_instructions, action_item_instructions, is_system) VALUES
('General Meeting', 'general', 'Default meeting type for general discussions', NULL, NULL, NULL, TRUE),
('Daily Standup', 'standup', 'Daily team standup meetings', 
 'Focus on what was accomplished yesterday, what will be done today, and any blockers or impediments.',
 'Extract team member names, projects being worked on, and any tools or systems mentioned.',
 'Identify blockers, impediments, or action items that need to be addressed by the team or individuals.', TRUE);
```

#### entities
**Purpose**: Main entity storage with dynamic typing
```sql
CREATE TABLE entities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,                    -- Entity name: "John Smith", "Acme Corp"
    type_slug TEXT NOT NULL,                      -- FK to entity_types.slug
    description TEXT,                             -- Optional description
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (type_slug) REFERENCES entity_types (slug)
);
```

#### meetings
**Purpose**: Core meeting data storage
```sql
CREATE TABLE meetings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,                          -- Meeting title
    date TIMESTAMP NOT NULL,                      -- Meeting date/time
    transcript TEXT,                              -- Full meeting transcript
    summary TEXT,                                 -- AI-generated summary
    audio_file_path TEXT,                         -- Path to uploaded audio file
    meeting_type_slug TEXT NOT NULL DEFAULT 'general',  -- FK to meeting_types.slug
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_type_slug) REFERENCES meeting_types (slug)
);
```

#### action_items
**Purpose**: Task and action item tracking
```sql
CREATE TABLE action_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    meeting_id INTEGER NOT NULL,                  -- FK to meetings.id
    description TEXT NOT NULL,                    -- Action item description
    assignee TEXT,                                -- Optional assignee name
    due_date TIMESTAMP,                           -- Optional due date
    status TEXT NOT NULL DEFAULT 'pending'       -- Status constraint
        CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
);
```

#### meeting_entities (Junction Table)
**Purpose**: Many-to-many relationship between meetings and entities
```sql
CREATE TABLE meeting_entities (
    meeting_id INTEGER NOT NULL,                  -- FK to meetings.id
    entity_id INTEGER NOT NULL,                   -- FK to entities.id
    PRIMARY KEY (meeting_id, entity_id),          -- Composite primary key
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
);
```

## Performance Indexes

### Strategic Index Design

```sql
-- Meeting queries (most common operations)
CREATE INDEX IF NOT EXISTS idx_meetings_date ON meetings (date);
CREATE INDEX IF NOT EXISTS idx_meetings_type ON meetings (meeting_type_slug);

-- Entity queries
CREATE INDEX IF NOT EXISTS idx_entities_name ON entities (name);

-- Action item queries  
CREATE INDEX IF NOT EXISTS idx_action_items_meeting ON action_items (meeting_id);
CREATE INDEX IF NOT EXISTS idx_action_items_status ON action_items (status);

-- Meeting type lookups
CREATE INDEX IF NOT EXISTS idx_meeting_types_slug ON meeting_types (slug);
```

### Index Usage Patterns

**Meeting List Queries**:
```sql
-- Uses idx_meetings_date for chronological ordering
SELECT * FROM meetings ORDER BY date DESC LIMIT 50;

-- Uses idx_meetings_type for filtering by meeting type
SELECT * FROM meetings WHERE meeting_type_slug = 'standup' ORDER BY date DESC;
```

**Entity Relationship Queries**:
```sql  
-- Uses idx_action_items_meeting for meeting detail pages
SELECT * FROM action_items WHERE meeting_id = ? ORDER BY created_at;

-- Junction table queries use composite primary key
SELECT e.* FROM entities e 
JOIN meeting_entities me ON e.id = me.entity_id 
WHERE me.meeting_id = ?;
```

## Relationship Patterns

### Entity Type Relationships

**One-to-Many**: entity_types → entities
```sql
SELECT e.*, et.name as type_name, et.color_class as type_color_class
FROM entities e
JOIN entity_types et ON e.type_slug = et.slug
WHERE e.id = ?;
```

### Meeting Type Relationships

**One-to-Many**: meeting_types → meetings
```sql
SELECT m.*, mt.name as meeting_type_name
FROM meetings m  
JOIN meeting_types mt ON m.meeting_type_slug = mt.slug
WHERE m.id = ?;
```

### Entity-Meeting Relationships

**Many-to-Many**: entities ↔ meetings (via meeting_entities)
```sql
-- All entities for a meeting
SELECT e.*, et.name as type_name, et.color_class as type_color_class
FROM entities e
JOIN meeting_entities me ON e.id = me.entity_id
JOIN entity_types et ON e.type_slug = et.slug
WHERE me.meeting_id = ?
ORDER BY e.name;

-- All meetings for an entity
SELECT m.* FROM meetings m
JOIN meeting_entities me ON m.id = me.meeting_id
WHERE me.entity_id = ?
ORDER BY m.date DESC;
```

### Action Item Relationships

**One-to-Many**: meetings → action_items
```sql
-- All action items for a meeting
SELECT * FROM action_items 
WHERE meeting_id = ?
ORDER BY created_at;

-- Action items by status across all meetings
SELECT ai.*, m.title as meeting_title
FROM action_items ai
JOIN meetings m ON ai.meeting_id = m.id  
WHERE ai.status = 'pending'
ORDER BY ai.due_date ASC NULLS LAST;
```

## Migration Strategy

### Schema Evolution Pattern

**Version 1**: Initial schema with hardcoded entity types
**Version 2**: Dynamic entity types system
**Version 3**: Meeting types with AI instructions

**Migration Implementation**:
```python
async def init_database(self) -> None:
    """Initialize database tables with migration support"""
    async with self.get_connection() as conn:
        # Check existing schema version
        cursor = await conn.execute("PRAGMA table_info(entities)")
        columns = {row[1] for row in await cursor.fetchall()}
        
        # Migration: Add type_slug column if missing
        if 'type' in columns and 'type_slug' not in columns:
            logger.info("Migrating entities table to dynamic types")
            await self._migrate_entities_to_dynamic_types(conn)
        
        # Migration: Add meeting_type_slug if missing
        cursor = await conn.execute("PRAGMA table_info(meetings)")
        meeting_columns = {row[1] for row in await cursor.fetchall()}
        
        if 'meeting_type_slug' not in meeting_columns:
            logger.info("Adding meeting type support")
            await self._add_meeting_type_column(conn)
```

**Safe Migration Pattern**:
```python
async def _migrate_entities_to_dynamic_types(self, conn):
    # 1. Create entity_types table
    await conn.execute("CREATE TABLE entity_types ...")
    
    # 2. Insert default types
    await conn.execute("INSERT INTO entity_types ...")
    
    # 3. Add new column
    await conn.execute("ALTER TABLE entities ADD COLUMN type_slug TEXT")
    
    # 4. Migrate existing data
    await conn.execute("UPDATE entities SET type_slug = type WHERE type_slug IS NULL")
    
    # 5. Create new table with constraints
    await conn.execute("CREATE TABLE entities_new ...")
    
    # 6. Copy data
    await conn.execute("INSERT INTO entities_new SELECT ...")
    
    # 7. Atomic table swap
    await conn.execute("DROP TABLE entities")
    await conn.execute("ALTER TABLE entities_new RENAME TO entities")
```

## Data Integrity Constraints

### Foreign Key Constraints

**Entity Type Integrity**:
```sql
-- entities.type_slug must exist in entity_types.slug
FOREIGN KEY (type_slug) REFERENCES entity_types (slug)
```

**Meeting Type Integrity**:
```sql  
-- meetings.meeting_type_slug must exist in meeting_types.slug
FOREIGN KEY (meeting_type_slug) REFERENCES meeting_types (slug)
```

**Action Item Integrity**:
```sql
-- action_items.meeting_id must exist in meetings.id
-- CASCADE delete removes action items when meeting is deleted
FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE
```

**Junction Table Integrity**:
```sql
-- Both foreign keys with CASCADE delete
FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
```

### Check Constraints

**Action Item Status**:
```sql
CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled'))
```

**Unique Constraints**:
- `entity_types.name` and `entity_types.slug` must be unique
- `meeting_types.name` and `meeting_types.slug` must be unique  
- `entities.name` must be unique
- `meeting_entities (meeting_id, entity_id)` composite primary key

## Query Patterns & Optimization

### Common Query Patterns

**Meeting Feed with Pagination**:
```sql
SELECT m.*, mt.name as meeting_type_name
FROM meetings m
LEFT JOIN meeting_types mt ON m.meeting_type_slug = mt.slug
ORDER BY m.date DESC
LIMIT ? OFFSET ?;
```

**Meeting Detail with Related Data**:
```sql
-- Meeting with entities
SELECT m.*, 
       GROUP_CONCAT(e.name || '|' || et.name || '|' || et.color_class) as entity_data
FROM meetings m
LEFT JOIN meeting_entities me ON m.id = me.meeting_id
LEFT JOIN entities e ON me.entity_id = e.id  
LEFT JOIN entity_types et ON e.type_slug = et.slug
WHERE m.id = ?
GROUP BY m.id;

-- Action items separately for cleaner JSON
SELECT * FROM action_items WHERE meeting_id = ? ORDER BY created_at;
```

**Entity Dashboard**:
```sql
-- Entity with meeting count
SELECT e.*, et.name as type_name, et.color_class,
       COUNT(me.meeting_id) as meeting_count
FROM entities e
JOIN entity_types et ON e.type_slug = et.slug
LEFT JOIN meeting_entities me ON e.id = me.entity_id
GROUP BY e.id, e.name, et.name, et.color_class
ORDER BY meeting_count DESC, e.name;
```

### Advanced Analytics Queries

**Entity Co-occurrence Analysis**:
```sql
-- Find entities that frequently appear together
SELECT e1.name as entity1, e2.name as entity2, COUNT(*) as co_occurrences
FROM meeting_entities me1
JOIN meeting_entities me2 ON me1.meeting_id = me2.meeting_id 
    AND me1.entity_id < me2.entity_id
JOIN entities e1 ON me1.entity_id = e1.id
JOIN entities e2 ON me2.entity_id = e2.id
GROUP BY e1.id, e2.id, e1.name, e2.name
HAVING COUNT(*) >= 2
ORDER BY co_occurrences DESC;
```

**Meeting Type Usage Statistics**:
```sql
SELECT mt.name, mt.slug,
       COUNT(m.id) as meeting_count,
       AVG(LENGTH(m.summary)) as avg_summary_length,
       AVG((SELECT COUNT(*) FROM action_items ai WHERE ai.meeting_id = m.id)) as avg_action_items
FROM meeting_types mt
LEFT JOIN meetings m ON mt.slug = m.meeting_type_slug
GROUP BY mt.id, mt.name, mt.slug
ORDER BY meeting_count DESC;
```

**Action Item Completion Rates**:
```sql
SELECT 
    status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM action_items), 2) as percentage
FROM action_items
GROUP BY status
ORDER BY count DESC;
```

## Backup & Recovery

### SQLite Backup Strategy

**Application-Level Backup**:
```python
async def backup_database(backup_path: str) -> None:
    """Create a backup of the SQLite database"""
    async with aiosqlite.connect(DB_PATH) as source:
        async with aiosqlite.connect(backup_path) as backup:
            await source.backup(backup)
    logger.info(f"Database backed up to {backup_path}")
```

**Scheduled Backup Pattern**:
```python
import asyncio
from datetime import datetime

async def daily_backup():
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_path = f"backups/meetings_backup_{timestamp}.db"
    await backup_database(backup_path)

# Run as background task
asyncio.create_task(daily_backup())
```

### Data Export Capabilities

**Meeting Export**:
```sql
-- Export all meeting data with relationships
SELECT 
    m.title,
    m.date,
    m.transcript,
    m.summary,
    mt.name as meeting_type,
    GROUP_CONCAT(e.name) as entities,
    GROUP_CONCAT(ai.description, '; ') as action_items
FROM meetings m
LEFT JOIN meeting_types mt ON m.meeting_type_slug = mt.slug
LEFT JOIN meeting_entities me ON m.id = me.meeting_id
LEFT JOIN entities e ON me.entity_id = e.id
LEFT JOIN action_items ai ON m.id = ai.meeting_id
GROUP BY m.id
ORDER BY m.date DESC;
```

## Performance Monitoring

### Query Performance Analysis

**SQLite Query Plan Analysis**:
```sql
-- Analyze query performance
EXPLAIN QUERY PLAN 
SELECT m.*, COUNT(me.entity_id) as entity_count
FROM meetings m
LEFT JOIN meeting_entities me ON m.id = me.meeting_id
GROUP BY m.id
ORDER BY m.date DESC
LIMIT 10;
```

**Index Usage Validation**:
```python
async def analyze_query_performance():
    async with get_connection() as conn:
        # Enable query analysis
        await conn.execute("PRAGMA optimize")
        
        # Check index usage
        cursor = await conn.execute("PRAGMA index_list('meetings')")
        indexes = await cursor.fetchall()
        
        for index in indexes:
            print(f"Index: {index['name']}")
            cursor = await conn.execute(f"PRAGMA index_info('{index['name']}')")
            columns = await cursor.fetchall()
            print(f"Columns: {[col['name'] for col in columns]}")
```

This database schema provides a robust, scalable foundation that efficiently supports the application's core features while maintaining data integrity and enabling powerful analytical queries across the meeting ecosystem.