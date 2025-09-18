# OSS-267: Entity Cleanup Interface - Remove Low-Engagement Entities

## Problem Statement

**WHY**: Clean up the entity database by removing entities with minimal engagement (0 or 1 associated meetings). This improves user experience when browsing entities by focusing only on relevant, actively used entities. The system should dynamically update when meetings are deleted, automatically surfacing entities that fall into the cleanup criteria.

## Solution Overview

**WHAT**: Build a dedicated cleanup interface that allows users to identify and bulk delete entities with low engagement.

### Core Features

1. **New Route**: `/entities/cleanup` - Dedicated cleanup page
2. **Backend Endpoints**:
   - `GET /entities/cleanup` - Filter entities by meeting count (≤1 meetings)
   - `DELETE /entities/bulk` - Bulk deletion with list of entity IDs
3. **Frontend Interface**: Simple list with bulk selection checkboxes and modal confirmation
4. **Database Operations**: Hard delete with cascading removal of all relationships

## Technical Requirements

### Backend Implementation
- **Endpoint 1**: `GET /entities/cleanup` returns entities with 0 or 1 associated meetings
- **Endpoint 2**: `DELETE /entities/bulk` accepts list of entity IDs for bulk deletion
- **Cascading Logic**: Delete from action_items, meeting_entities, then entities
- **Error Handling**: Continue with successful deletions, report errors for failed ones

### Frontend Implementation
- **Route**: `/entities/cleanup`
- **Components**:
  - EntityCleanupPage (main container)
  - EntityCleanupList (list with checkboxes)
  - BulkDeleteModal (confirmation dialog)
- **Flow**: List → Select → Bulk Delete Button → Modal Confirmation → Hard Delete → Success/Error Feedback

### Database Operations
```sql
-- Identification query
SELECT e.* FROM entities e
LEFT JOIN meeting_entities me ON e.id = me.entity_id
GROUP BY e.id
HAVING COUNT(me.meeting_id) <= 1;

-- Cascading deletion order
1. DELETE FROM action_items WHERE assignee IN (entity_ids)
2. DELETE FROM meeting_entities WHERE entity_id IN (entity_ids)
3. DELETE FROM entities WHERE id IN (entity_ids)
```

### Navigation & UX
- **Navigation Placement**: Prominent "Cleanup" link positioned after "Entities", before "Admin"
- **Protection**: No protection for any entity types
- **Performance**: No limits on bulk selection quantity
- **Feedback**: Clear success/error feedback for partial failures

### Dynamic Updates
When meetings are deleted, entities that fall to 0 or 1 meetings automatically appear in cleanup interface on next page load.

## Clarifications Confirmed

1. **Entity Protection**: No protection for any entity types - all entities eligible for cleanup
2. **Error Handling**: Continue with successful deletions and provide error feedback for failed ones
3. **Performance**: No special safeguards needed for large bulk deletions
4. **Navigation**: Prominent "Cleanup" link after Entities, before Admin in navigation
5. **Testing**: Unit tests only, no integration tests required

## Success Criteria

- [ ] GET /entities/cleanup returns entities with ≤1 meetings
- [ ] DELETE /entities/bulk performs cascading deletion with partial failure handling
- [ ] Frontend displays entity list with multi-select checkboxes
- [ ] Modal confirmation shows before permanent deletion
- [ ] Database maintains referential integrity after deletion
- [ ] Success/error feedback provided to user with details on partial failures
- [ ] Page refreshes to show updated entity list
- [ ] Navigation link "Cleanup" added prominently after Entities, before Admin

## User Flow

1. User navigates to `/entities/cleanup` via prominent navigation link
2. System displays entities with 0-1 meetings
3. User selects entities via checkboxes
4. User clicks "Delete Selected" button
5. Modal opens with deletion confirmation
6. User confirms deletion
7. System performs hard delete with cascading (continues on errors)
8. Success message displays with error details if any, list refreshes

## Expected Outcome
- Reduced average entity list size for active users
- Improved entity browsing performance
- Clean database with only actively used entities