# OSS-266: Entity Cleanup - Remove Low-Engagement Entities

## Context (WHY)
The system accumulates entities over time that have minimal or no engagement with meetings. Entities mentioned only once or never linked create noise in entity management. Users need a way to clean up irrelevant entities to maintain a focused, meaningful database. Administrative cleanup improves system performance and user experience.

## Goal (WHAT)
Create a dedicated "Cleanup" page in the administrative interface that allows users to identify and remove entities with low engagement (0 or 1 meeting associations).

### Core Features:
- **Cleanup Page**: New dedicated page accessible from top bar navigation (last position)
- **Entity Listing**: Display entities with 0 or 1 meeting associations as simple cards
- **Multi-selection**: Checkbox system for selecting multiple entities at once
- **Bulk Operations**: "Delete Selected" button for removing multiple entities
- **Confirmation**: Simple modal confirmation showing count ("Delete 5 entities?")
- **Sorting**: Alphabetical ordering by entity name
- **Post-Deletion**: Refresh page after successful deletion
- **Error Handling**: Show error messages if deletion fails

### User Flow:
1. Navigate to "Cleanup" page from top bar (last position)
2. View list of low-engagement entities displayed as cards
3. Select relevant entities using checkboxes (individual or bulk selection)
4. Click "Delete Selected" button
5. Confirm deletion in simple modal dialog ("Delete X entities?")
6. Selected entities are permanently removed from system
7. Page refreshes to show updated results

## Approach (HOW)

### Technical Implementation:
- **Database**: Use current SQLite setup (ignore SurrealDB migration)
- **Query Logic**: Filter entities with `COUNT(meeting_entities.meeting_id) <= 1`
- **Backend Endpoints**:
  - `GET /admin/cleanup/entities` - returns low-engagement entities
  - `DELETE /admin/cleanup/entities` - bulk delete selected entities
- **Frontend**: New `/cleanup` route with multi-select interface
- **Deletion**: Hard delete from database (no soft delete required)
- **Performance**: Load all qualifying entities at once (no pagination needed)
- **Navigation**: Add "Cleanup" button to top bar navigation (last position)

### Dependencies:
- Current entity management system
- Existing card UI components
- Modal confirmation components
- Top bar navigation structure

### Constraints:
- Use current SQLite database setup
- Leverage existing UI patterns and components
- Hard delete only (no recovery mechanism needed)
- No pagination required

### Testing:
- Test entity filtering logic (0 and 1 meeting associations)
- Test multi-select functionality
- Test bulk deletion
- Test error handling scenarios
- Test UI responsiveness and accessibility