# Entity Cleanup Feature

## Overview

The Entity Cleanup feature helps maintain database hygiene by identifying and removing "orphaned" entities - those with 0 or 1 meeting associations. This feature supports the core product value of relationship mapping by ensuring the database focuses on entities that contribute meaningful insights through multiple meeting appearances.

## Purpose

Entities are automatically extracted from meeting transcripts, which can result in:
- **False positives**: Incorrectly identified entities
- **One-time mentions**: Entities that don't recur across meetings
- **Noise**: Entities that don't contribute to relationship insights

The Entity Cleanup feature addresses this by providing a simple, safe way to remove low-value entities.

## Definition: Orphaned Entity

An entity is considered "orphaned" if it meets one of these criteria:
- **0 meetings**: Never associated with any meeting
- **1 meeting**: Associated with exactly one meeting

**Rationale**: The product's core value is understanding entity relationships *across multiple meetings*. Entities with ≤1 meeting don't contribute to this value proposition.

## User Interface

### Access
Navigate to **Entity Cleanup** from the main navigation menu (last item, with trash icon).

### Page Layout

#### 1. Statistics Cards
Three cards display quick metrics:
- **No Meetings**: Count of entities with 0 meeting associations
- **One Meeting**: Count of entities with 1 meeting association
- **Total Orphaned**: Total count of entities ready for cleanup

#### 2. Entity List
Entities are displayed in two grouped sections:

**Section 1: No Meetings**
- Entities that have never been mentioned in any meeting
- Sorted alphabetically by name
- Likely candidates for deletion (potential extraction errors)

**Section 2: One Meeting**
- Entities mentioned in exactly one meeting
- Sorted alphabetically by name
- May be legitimate one-time participants or references

#### 3. Selection System
- **Individual selection**: Checkbox on each entity card
- **Bulk selection**: "Select all" checkbox at top
- **Selected count**: Displayed in Delete button (e.g., "Delete Selected (5)")
- **Visual feedback**: Selected entities show a blue ring highlight

#### 4. Entity Card Information
Each card displays:
- Entity name
- Entity type badge (with color coding)
- Description (if available)
- Meeting count indicator

### Deletion Workflow

1. **Select Entities**: Check boxes for entities to delete
2. **Click "Delete Selected (X)"**: Button appears when ≥1 entity selected
3. **Confirmation Modal**: Review deletion details:
   - Total count of entities to be deleted
   - Breakdown by type (e.g., "5 People, 3 Companies, 2 Projects")
   - Warning that action is permanent
4. **Confirm or Cancel**:
   - Click "Cancel" to abort
   - Click "Delete X Entities" to proceed
5. **Deletion Executes**: All selected entities removed in a single transaction
6. **Success Feedback**: Green alert shows "Successfully deleted X entities"
7. **Auto-refresh**: List updates automatically, statistics recalculate

## Backend Implementation

### Database Query

The orphaned entities query combines:
- Entity data from `entities` table
- Entity type information from `entity_types` table (for display)
- Meeting count from `meeting_entities` junction table

**SQL Pattern**:
```sql
SELECT e.*,
       et.name as type_name,
       et.color_class as type_color_class,
       COUNT(me.meeting_id) as meeting_count
FROM entities e
JOIN entity_types et ON e.type_slug = et.slug
LEFT JOIN meeting_entities me ON e.id = me.entity_id
GROUP BY e.id, e.name, e.type_slug, e.description, e.created_at,
         et.name, et.color_class
HAVING meeting_count <= 1
ORDER BY meeting_count ASC, e.name ASC
```

**Key aspects**:
- `LEFT JOIN` ensures entities with 0 meetings are included
- `GROUP BY` with all non-aggregated columns (SQLite requirement)
- `HAVING` filters for ≤1 meeting associations
- `ORDER BY` sorts by meeting count first (0 before 1), then alphabetically

### API Endpoints

#### Get Orphaned Entities
```
GET /api/v1/entities/orphaned
```

**Response**: Array of entities with `meeting_count` field
```json
[
  {
    "id": 123,
    "name": "Example Entity",
    "type_slug": "person",
    "description": "Automatically extracted from meeting",
    "created_at": "2025-09-29T10:30:00",
    "type_name": "Person",
    "type_color_class": "bg-blue-100 text-blue-800",
    "meeting_count": 0
  }
]
```

#### Bulk Delete Entities
```
POST /api/v1/entities/bulk-delete
```

**Request Body**:
```json
{
  "ids": [123, 456, 789]
}
```

**Response**:
```json
{
  "message": "Successfully deleted 3 entities",
  "deleted_count": 3,
  "failed_ids": []
}
```

### Transaction Safety

Bulk delete operations use database transactions to ensure atomicity:
- All deletions succeed together, or none do
- Prevents partial deletions if an error occurs
- Maintains database consistency

### Cascade Behavior

The `meeting_entities` junction table has `ON DELETE CASCADE` on the `entity_id` foreign key:
- When an entity is deleted, its meeting associations are automatically removed
- No orphaned records left in `meeting_entities`
- Referential integrity maintained

**Note**: The `action_items.assignee` field is TEXT (not a foreign key), so deleting entities doesn't affect action items.

## Frontend Implementation

### Technology Stack
- **React 19** with TypeScript
- **TanStack Query** for server state management
- **Shadcn UI** components for UI elements
- **Tailwind CSS** for styling

### State Management

**Server State** (via TanStack Query):
- `['entities', 'orphaned']` - Orphaned entities list
- `['entity-types']` - Entity type definitions

**Local State** (via React hooks):
- `selectedEntityIds` - Set of selected entity IDs
- `isConfirmModalOpen` - Modal visibility
- `error` - Error message display
- `successMessage` - Success feedback (auto-clears after 5s)

### Cache Invalidation

After successful deletion, multiple query keys are invalidated to update all views:
```typescript
queryClient.invalidateQueries({ queryKey: ['entities'] });
queryClient.invalidateQueries({ queryKey: ['entities', 'orphaned'] });
```

This ensures:
- Entity Cleanup page refreshes
- Main Entities page updates
- Entity counts recalculate
- No stale data displayed

## Safety Considerations

### Confirmation Modal
- **Required before deletion**: Cannot bypass
- **Clear information**: Shows exact count and type breakdown
- **Explicit warning**: States action is permanent
- **Two-button choice**: Cancel vs Confirm, clearly labeled

### No Undo
Deletion is permanent with no undo mechanism. Mitigations:
- Comprehensive confirmation modal
- Visual review of selected entities before clicking delete
- Type breakdown helps user understand impact
- Transaction ensures all-or-nothing deletion

### Data Integrity
- Foreign key cascades handle related records
- Transactions prevent partial deletions
- No orphaned junction table records
- Entity type system not affected

## Use Cases

### 1. Post-Import Cleanup
After importing or processing many meetings, clean up extraction errors and one-time mentions.

### 2. Database Maintenance
Periodically review and remove entities that don't contribute to relationship insights.

### 3. Testing/Development
Remove test entities or development data without affecting production entities.

### 4. Quality Improvement
Identify patterns in frequently misidentified entities to improve extraction prompts.

## Limitations

1. **No Pagination**: All orphaned entities load at once
   - *Acceptable for expected data volumes*
   - Future enhancement if needed

2. **No Undo**: Deletion is permanent
   - *Mitigated by confirmation modal*
   - Future enhancement: soft delete pattern

3. **No Audit Trail**: No record of deleted entities
   - *Not required for single-user MVP*
   - Future enhancement: deletion log

4. **No Filtering**: Cannot filter by entity type within orphaned list
   - *Future enhancement opportunity*

5. **No Preview**: Cannot see which meeting an entity with 1 association is linked to
   - *Future enhancement: show meeting link*

## Performance

### Expected Performance
- **Query time**: <100ms for typical databases (1000s of entities)
- **Deletion time**: <500ms for typical bulk operations (10-50 entities)
- **UI responsiveness**: Immediate feedback with loading states

### Scalability
- SQLite GROUP BY performs well for single-user databases
- No pagination needed for expected orphaned entity counts
- Could add pagination if databases grow to 10,000+ entities

## Future Enhancements

### High Value
1. **Soft Delete Pattern**: 30-day grace period before permanent deletion
2. **Meeting Preview**: Show which meeting an entity is associated with (for 1-meeting entities)
3. **Filter by Type**: Checkbox filters to show only specific entity types
4. **Undo Recent Deletion**: Session-based undo for last deletion

### Medium Value
1. **Export List**: Download orphaned entities as CSV before deletion
2. **Scheduled Cleanup**: Automated cleanup on a schedule
3. **Cleanup Suggestions**: AI-powered recommendations for cleanup
4. **Batch Size Limits**: Prevent timeouts on very large selections

### Low Value
1. **Pagination**: Only needed if orphaned counts exceed hundreds
2. **Search Within Orphaned**: Only valuable with large orphaned lists
3. **Custom Thresholds**: Allow defining "orphaned" as 0-2 meetings instead of 0-1

## Related Documentation

- [Entity Management Feature](./entity-system.md) - Core entity management patterns
- [Database Schema](../implementation/database-schema.md) - Schema and query patterns
- [API Specification](../../specs/technical/API_SPECIFICATION.md) - Complete API reference
- [Business Logic](../../specs/technical/BUSINESS_LOGIC.md) - Entity relationship rules