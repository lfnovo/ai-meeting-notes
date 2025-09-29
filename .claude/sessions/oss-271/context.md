# OSS-271: Entity Cleanup Feature - Context Document

## Why (Context)
The product's core value proposition is relationship mapping between entities across multiple meetings. Entities that are associated with 0 or 1 meetings don't contribute meaningfully to this value proposition and just add noise to the database. This feature enables users to identify and remove these "orphaned" entities to keep the database clean and focused.

## What (Goal)
Create a new "Entity Cleanup" UI page that allows users to:
1. View a list of orphaned entities (those with 0 or 1 meeting associations)
2. Select multiple entities for deletion using checkboxes
3. Delete selected entities with a confirmation modal
4. Receive clear feedback about the deletion operation

### Orphaned Entity Definition
An entity is considered "orphaned" if it is associated with 0 or 1 meetings.

## How (Approach)

### Backend Implementation
- **New Endpoint 1**: `GET /api/v1/entities/orphaned` - Returns list of entities with ≤1 meeting
- **Endpoint Enhancement**: Existing `POST /api/v1/entities/bulk-delete` already exists and will be used
- **Database Query**: Join entities with meeting_entities, group by entity, filter where COUNT ≤ 1
- **Sort Order**:
  - First: entities with 0 meetings (alphabetically by name)
  - Second: entities with 1 meeting (alphabetically by name)

### Frontend Implementation
- **New Route**: `/entity-cleanup`
- **Navigation**: Add as last item in main menu navigation (after Admin)
- **Components**:
  - Entity list/table with checkbox selection
  - Bulk action button with loading states
  - Confirmation modal with:
    - Count of selected entities
    - Breakdown by entity type (e.g., "5 People, 3 Companies, 2 Projects")
    - Warning about permanence
    - Cancel/Confirm buttons
  - Toast notification for success feedback

### Database Behavior
- **Foreign Key Cascade**: `meeting_entities` table already has `ON DELETE CASCADE` for entity_id
- **Action Items**: The `action_items.assignee` field is TEXT (free-form), not a foreign key to entities, so no cascade needed
- **Hard Delete**: Permanent deletion from database (no soft delete)

### UX Flow
1. User navigates to "Entity Cleanup" from main menu
2. Page loads showing orphaned entities sorted (0 meetings first, then 1 meeting, both alphabetically)
3. User selects entities via checkboxes
4. User clicks "Delete Selected" button
5. Confirmation modal appears showing:
   - "Are you sure you want to delete X entities?"
   - Breakdown: "5 People, 3 Companies, 2 Projects"
   - Warning: "This action cannot be undone"
6. User confirms
7. Backend deletes entities (cascade handles meeting_entities)
8. Success toast appears: "X entities deleted successfully"
9. List auto-refreshes, other views invalidate cache

## Testing Checklist
- [ ] GET /entities/orphaned returns correct entities (0 and 1 meeting associations)
- [ ] Entities are sorted correctly (0 meetings first, then 1, both alphabetical)
- [ ] Bulk delete successfully removes entities
- [ ] meeting_entities records cascade delete properly
- [ ] Confirmation modal displays correct counts and breakdowns
- [ ] Toast notifications appear on success
- [ ] List refreshes automatically after deletion
- [ ] TanStack Query cache invalidates properly across all views

## Dependencies
- Backend: FastAPI, DatabaseManager class, existing models
- Frontend: React, React Router, TanStack Query, shadcn/ui components (Button, Checkbox, Alert/Modal, Badge)
- Database: SQLite with existing schema (entities, meeting_entities tables)

## Constraints
- No authentication/authorization (single-user app)
- Hard delete only (permanent, no undo beyond the confirmation modal)
- All entities come from meeting processing (no manual entity creation)
- Must maintain existing code patterns and conventions

## Clarifications Confirmed
1. ✅ Menu placement: Main menu, last element (after Admin)
2. ✅ Access control: No restrictions needed (single-user app)
3. ✅ Action items: No impact (assignee is TEXT field, not FK)
4. ✅ Real-time updates: Yes, auto-refresh list + invalidate caches
5. ✅ Sorting: 0 meetings first (alphabetical), then 1 meeting (alphabetical)