# Entity System Feature

## Overview

The entity system is a dynamic, relationship-based feature that tracks people, companies, projects, and other important entities across meetings. It provides context and continuity by linking entities to relevant meetings and enabling cross-meeting insights.

## System Architecture

### Dynamic Entity Type System

Unlike hardcoded entity categories, the system supports runtime-configurable entity types:

```python
class EntityTypeModel(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=50)
    slug: str = Field(..., min_length=1, max_length=50)  # URL-friendly identifier
    color_class: str = Field(..., min_length=1, max_length=100)  # CSS styling
    description: Optional[str] = None
    is_system: bool = False  # System types cannot be deleted
```

**Default Entity Types**:
- **Person**: `bg-blue-100 text-blue-800 border-blue-200`
- **Company**: `bg-green-100 text-green-800 border-green-200`
- **Project**: `bg-purple-100 text-purple-800 border-purple-200`
- **Other**: `bg-gray-100 text-gray-800 border-gray-200`

### Entity Data Model

**Core Entity Structure**:
```python
class Entity(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    type_slug: str = Field(..., min_length=1, max_length=50)  # FK to entity_types.slug
    description: Optional[str] = None
    created_at: Optional[datetime] = None
```

**Enhanced Entity with Type Information**:
```python
class EntityWithType(Entity):
    type_name: Optional[str] = None          # "Person", "Company", etc.
    type_color_class: Optional[str] = None   # CSS classes for styling
```

## Relationship Management

### Many-to-Many Meeting Associations

Entities and meetings have flexible many-to-many relationships through the `meeting_entities` junction table:

**Database Schema**:
```sql
CREATE TABLE meeting_entities (
    meeting_id INTEGER NOT NULL,
    entity_id INTEGER NOT NULL,
    PRIMARY KEY (meeting_id, entity_id),
    FOREIGN KEY (meeting_id) REFERENCES meetings (id) ON DELETE CASCADE,
    FOREIGN KEY (entity_id) REFERENCES entities (id) ON DELETE CASCADE
);
```

**Benefits**:
- One entity can appear in multiple meetings
- One meeting can involve multiple entities
- Automatic cleanup when meetings or entities are deleted
- Efficient querying of related data

### Association Operations

**Add Entity to Meeting**:
```python
async def add_entity_to_meeting(self, meeting_id: int, entity_id: int) -> None:
    async with self.get_connection() as conn:
        await conn.execute("""
            INSERT OR IGNORE INTO meeting_entities (meeting_id, entity_id)
            VALUES (?, ?)
        """, (meeting_id, entity_id))
        await conn.commit()
```

**Query Patterns**:
```python
# Get all entities for a meeting
async def get_entities_by_meeting(self, meeting_id: int) -> List[EntityWithType]:
    cursor = await conn.execute("""
        SELECT e.*, et.name as type_name, et.color_class as type_color_class
        FROM entities e
        JOIN meeting_entities me ON e.id = me.entity_id
        JOIN entity_types et ON e.type_slug = et.slug
        WHERE me.meeting_id = ?
        ORDER BY e.name
    """, (meeting_id,))

# Get all meetings for an entity
async def get_meetings_by_entity(self, entity_id: int) -> List[Meeting]:
    cursor = await conn.execute("""
        SELECT m.* FROM meetings m
        JOIN meeting_entities me ON m.id = me.meeting_id
        WHERE me.entity_id = ?
        ORDER BY m.date DESC
    """, (entity_id,))
```

## AI-Driven Entity Extraction

### Extraction Process

During meeting processing, entities are automatically extracted from transcripts using specialized AI prompts:

**Entity Extraction Prompt**:
```python
base_prompt = """You are an expert at extracting entities from meeting transcripts. 

Extract and return a list of important entities mentioned in the meeting, including:
- People's names (colleagues, clients, stakeholders)
- Company names
- Project names
- Product names
- Important tools or systems mentioned

Rules:
- Return each entity in the format "EntityName|EntityType" where EntityType is one of: Person, Company, Project, Product, Tool, Other
- Use the exact name as mentioned in the transcript
- Don't include common words or generic terms
- Focus on proper nouns and specific named entities
"""
```

### EntityManager Service

Coordinates entity creation and matching:

```python
class EntityManager:
    def __init__(self):
        pass
    
    async def create_or_get_entities(
        self, 
        entity_strings: List[str], 
        db: DatabaseManager
    ) -> List[EntityWithType]:
        """Create new entities or return existing ones"""
        entities = []
        
        for entity_string in entity_strings:
            name, entity_type = self._parse_entity_string(entity_string)
            
            # Try to find existing entity by name
            existing = await self._find_existing_entity(name, db)
            if existing:
                entities.append(existing)
            else:
                # Create new entity with inferred type
                type_slug = self._map_ai_type_to_slug(entity_type)
                new_entity = await db.create_entity(
                    EntityCreate(
                        name=name, 
                        type_slug=type_slug,
                        description=f"Auto-extracted {entity_type.lower()}"
                    )
                )
                entities.append(new_entity)
        
        return entities
    
    def _parse_entity_string(self, entity_string: str) -> Tuple[str, str]:
        """Parse 'EntityName|EntityType' format from AI"""
        if '|' in entity_string:
            name, entity_type = entity_string.split('|', 1)
            return name.strip(), entity_type.strip()
        return entity_string.strip(), "Other"
    
    def _map_ai_type_to_slug(self, ai_type: str) -> str:
        """Map AI-detected types to database slugs"""
        type_mapping = {
            "Person": "person",
            "Company": "company", 
            "Project": "project",
            "Product": "other",
            "Tool": "other",
            "Other": "other"
        }
        return type_mapping.get(ai_type, "other")
```

## Entity Management Features

### CRUD Operations

**Create Entity**:
```python
@router.post("/entities", response_model=EntityWithType)
async def create_entity(
    entity: EntityCreate,
    db: DatabaseManager = Depends(get_db)
):
    return await db.create_entity(entity)
```

**Update Entity**:
```python
@router.put("/entities/{entity_id}", response_model=EntityWithType)
async def update_entity(
    entity_id: int,
    entity_data: EntityUpdate,
    db: DatabaseManager = Depends(get_db)
):
    entity = await db.update_entity(entity_id, entity_data)
    if not entity:
        raise HTTPException(status_code=404, detail="Entity not found")
    return entity
```

### Bulk Operations

**Bulk Delete**:
```python
@router.post("/entities/bulk-delete")
async def bulk_delete_entities(
    data: EntityBulkDelete,  # Contains list of entity IDs
    db: DatabaseManager = Depends(get_db)
):
    deleted_count = 0
    for entity_id in data.ids:
        if await db.delete_entity(entity_id):
            deleted_count += 1
    return {"deleted": deleted_count, "total": len(data.ids)}
```

**Bulk Type Update**:
```python
@router.post("/entities/bulk-update-type")
async def bulk_update_entity_type(
    data: EntityBulkUpdateType,  # Contains IDs and new type_slug
    db: DatabaseManager = Depends(get_db)
):
    updated_count = 0
    for entity_id in data.ids:
        entity = await db.update_entity(
            entity_id, 
            EntityUpdate(type_slug=data.type_slug)
        )
        if entity:
            updated_count += 1
    return {"updated": updated_count, "total": len(data.ids)}
```

## Entity Type Administration

### Dynamic Type Management

**Create Custom Entity Type**:
```python
@router.post("/entity-types", response_model=EntityTypeModel)
async def create_entity_type(
    entity_type: EntityTypeCreate,
    db: DatabaseManager = Depends(get_db)
):
    # Validate slug uniqueness
    existing = await db.get_entity_type_by_slug(entity_type.slug)
    if existing:
        raise HTTPException(status_code=400, detail="Entity type slug already exists")
    
    return await db.create_entity_type(entity_type)
```

**Example Custom Type**:
```json
{
  "name": "Client",
  "slug": "client", 
  "color_class": "bg-yellow-100 text-yellow-800 border-yellow-200",
  "description": "External client organizations"
}
```

### Protected System Types

System entity types have special protection:

```python
async def delete_entity_type(self, type_id: int) -> bool:
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
```

## Frontend Integration

### Entity Display Components

**Entity Badge Component**:
```typescript
interface EntityBadgeProps {
  entity: Entity;
  size?: "sm" | "md" | "lg";
}

function EntityBadge({ entity, size = "md" }: EntityBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border",
        entity.type_color_class,
        {
          "text-xs px-1.5 py-0.5": size === "sm",
          "text-sm px-3 py-1.5": size === "lg",
        }
      )}
    >
      {entity.name}
    </span>
  );
}
```

### Entity Selection UI

**Multi-Select Component**:
```typescript
function EntitySelector({ 
  selectedIds, 
  onSelectionChange 
}: EntitySelectorProps) {
  const { data: entities } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entityApi.getAll().then(res => res.data),
  });

  return (
    <div className="space-y-2">
      {entities?.map(entity => (
        <label key={entity.id} className="flex items-center space-x-2">
          <input
            type="checkbox"
            checked={selectedIds.includes(entity.id)}
            onChange={(e) => {
              if (e.target.checked) {
                onSelectionChange([...selectedIds, entity.id]);
              } else {
                onSelectionChange(selectedIds.filter(id => id !== entity.id));
              }
            }}
          />
          <EntityBadge entity={entity} size="sm" />
        </label>
      ))}
    </div>
  );
}
```

## Use Cases & Workflows

### 1. Meeting Processing Workflow

1. User uploads meeting audio/transcript
2. AI extracts entities: "John Smith|Person", "Acme Corp|Company", "Project X|Project"
3. EntityManager processes extractions:
   - "John Smith" already exists → link to existing entity
   - "Acme Corp" is new → create new company entity
   - "Project X" already exists → link to existing project
4. Meeting-entity associations are created automatically
5. User can review and adjust entity associations

### 2. Cross-Meeting Entity Tracking

1. User views entity detail page for "John Smith"
2. System displays all meetings involving John Smith
3. User can see John's involvement timeline
4. Related entities (companies, projects) are also shown

### 3. Administrative Management

1. Admin creates custom entity type "Vendor" with orange styling
2. Bulk operation updates 15 entities from "Company" to "Vendor" type
3. Reports now distinguish between clients and vendors
4. AI prompts can be updated to recognize vendor entities

## Data Insights & Analytics

### Entity Relationship Analytics

**Meeting Participation Frequency**:
```sql
SELECT e.name, COUNT(me.meeting_id) as meeting_count
FROM entities e
JOIN meeting_entities me ON e.id = me.entity_id
GROUP BY e.id, e.name
ORDER BY meeting_count DESC;
```

**Entity Co-occurrence Analysis**:
```sql
-- Find entities that frequently appear together
SELECT e1.name as entity1, e2.name as entity2, COUNT(*) as co_occurrences
FROM meeting_entities me1
JOIN meeting_entities me2 ON me1.meeting_id = me2.meeting_id AND me1.entity_id < me2.entity_id
JOIN entities e1 ON me1.entity_id = e1.id
JOIN entities e2 ON me2.entity_id = e2.id
GROUP BY e1.id, e2.id, e1.name, e2.name
ORDER BY co_occurrences DESC;
```

## Future Enhancements

### Planned Features

1. **Entity Merging**: Combine duplicate entities with history preservation
2. **Fuzzy Matching**: Improved entity recognition for similar names
3. **Entity Hierarchies**: Parent-child relationships (companies → departments)
4. **Custom Attributes**: Extensible entity metadata
5. **Entity Templates**: Pre-configured entity sets for specific domains

### Integration Opportunities

1. **CRM Integration**: Sync with external customer relationship systems
2. **Directory Services**: Import from LDAP/Active Directory
3. **Calendar Integration**: Auto-associate entities with calendar events
4. **Export Capabilities**: Generate entity reports and relationship maps

The entity system provides a flexible, scalable foundation for tracking and understanding the people, organizations, and concepts that matter across an organization's meeting ecosystem.