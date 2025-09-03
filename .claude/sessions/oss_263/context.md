# OSS-263: Entity Check-up Feature - Context

## Why This Feature
- **Maintenance Tool**: Enable continuous maintenance of the entity system
- **Data Quality**: Remove low-usage entities that may be irrelevant or extraction errors
- **User Experience**: Keep the system clean and organized, reducing clutter in entity listings
- **System Optimization**: Maintain a focused, high-quality entity database

## What We're Building

### Core Functionality
A dedicated "Check-up" page that identifies and allows removal of entities appearing in exactly 1 meeting.

### Key Components
1. **New Navigation Item**: "Check-up" in the top bar
2. **Check-up Page**: Dedicated maintenance interface
3. **Entity List**: Display low-usage entities with context
4. **Deletion Tools**: Individual and bulk removal capabilities
5. **Confirmation System**: User confirmation before any deletion

### Detailed Requirements

#### Backend API
- `GET /entities/low-usage` - Returns entities with exactly 1 meeting association
- `DELETE /entities/{id}` - Removes specific entity (CASCADE delete)
- `DELETE /entities/batch` - Removes multiple entities in one operation

#### Frontend Interface
- **Route**: `/checkup`
- **Display**: Shadcn Table with entity information
- **Selection**: Checkbox column for multi-select
- **Context Info**: Show meeting title and date (no pagination needed)
- **Actions**: Individual delete buttons + "Delete Selected" for bulk operations
- **Feedback**: Entity counter, confirmation modals

#### Data Query Logic
```sql
SELECT e.*, COUNT(me.meeting_id) as meeting_count 
FROM entities e 
JOIN meeting_entities me ON e.id = me.entity_id 
GROUP BY e.id 
HAVING meeting_count = 1
```

## Expected Behavior

### Deletion Model
- **Complete Deletion**: Remove entity record entirely (CASCADE delete from meeting_entities)
- **No Audit**: No deletion logging required for MVP
- **No Protection**: All entity types can be deleted
- **Data Integrity**: Ensure no orphaned references remain

### User Flow
1. User clicks "Check-up" in top navigation
2. Page loads with automatic query of low-usage entities
3. User sees list with meeting context (title + date)
4. User can select individual or multiple entities
5. User clicks delete (individual or bulk)
6. Confirmation modal appears
7. Upon confirmation, entities are removed
8. List updates to reflect changes

### Technical Constraints
- **No Pagination**: Display all results in single view
- **Testing**: Unit tests only for MVP
- **UI Framework**: Use existing Shadcn UI patterns
- **No Audit Trail**: No logging of deletions required

## Success Criteria
- User can access Check-up page from top navigation
- Low-usage entities are correctly identified and displayed
- Individual and bulk deletion work properly
- Meeting context is clearly shown
- No data integrity issues after deletions
- Proper confirmation prevents accidental deletions

## Out of Scope
- Audit logging/tracking of deletions
- Entity type protection rules
- Pagination for large result sets
- Advanced filtering or search capabilities
- Undo functionality
- Integration tests (unit tests only)