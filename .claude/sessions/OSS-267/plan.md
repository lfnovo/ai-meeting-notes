# OSS-267: Entity Cleanup Interface - Remove Low-Engagement Entities

If you are working on this feature, make sure to update this plan.md file as you go.

## PHASE 1: Backend Database Layer [Completed ✅]

Implement the core database functionality for entity cleanup operations. This phase focuses on the data layer without API exposure to allow for manual testing of the database operations.

### Implement get_entities_for_cleanup method in DatabaseManager [Completed ✅]

Add new method to `backend/app/database.py` that returns entities with ≤1 associated meetings. The method should:
- Execute LEFT JOIN query between entities, entity_types, and meeting_entities
- Group by entity.id and filter by HAVING COUNT(meeting_id) <= 1
- Return List[EntityWithType] with type information included
- Order by created_at DESC for consistent results
- Handle empty results gracefully

### Implement bulk_delete_entities method in DatabaseManager [Completed ✅]

Add cascading bulk delete method to `backend/app/database.py` that:
- Accepts List[int] entity_ids parameter
- Performs cascading deletes in correct order: action_items → meeting_entities → entities
- Uses individual delete operations for partial failure handling
- Returns detailed response with deleted_count, failed_ids, and error messages
- Maintains referential integrity throughout the process
- Logs operations for debugging purposes

### Manual testing of database methods [Completed ✅]

Test database methods directly to ensure functionality:
- Verify get_entities_for_cleanup returns correct entities based on meeting count
- Test bulk_delete_entities with success scenarios
- Test bulk_delete_entities with partial failure scenarios
- Check cascading deletes maintain referential integrity
- Test edge cases (empty lists, non-existent entities)

### Comments:
- Database methods implemented successfully using python-developer sub-agent
- Both methods follow existing DatabaseManager patterns and conventions
- Manual testing confirmed: 160 entities found for cleanup, cascading deletes working properly
- Partial failure handling tested with mixed valid/invalid IDs - works as expected
- Methods ready for API layer integration in Phase 2
- No issues found during testing - database foundation is solid

## PHASE 2: Backend API Layer [Completed ✅]

Expose the database functionality through REST API endpoints following the existing patterns in the application.

### Implement GET /entities/cleanup endpoint [Completed ✅]

Add new endpoint to `backend/app/api/routes.py` that:
- Uses existing dependency injection pattern with get_db()
- Calls DatabaseManager.get_entities_for_cleanup() method
- Returns List[EntityWithType] response model
- Includes proper error handling with try-catch and HTTP exceptions
- Follows existing endpoint patterns for consistency
- Adds appropriate logging for operations

### Implement DELETE /entities/bulk endpoint [Completed ✅]

Add new bulk delete endpoint to `backend/app/api/routes.py` that:
- Accepts EntityBulkDelete request model (already exists)
- Uses existing dependency injection pattern
- Calls DatabaseManager.bulk_delete_entities() method
- Returns detailed response with success/failure information
- Implements partial failure handling (continue on errors)
- Includes comprehensive error handling and logging
- Follows existing bulk operation patterns

### Test API endpoints manually [Completed ✅]

Verify API functionality using manual testing:
- Test GET /entities/cleanup returns appropriate entities
- Test DELETE /entities/bulk with various scenarios (all success, partial failure, all failure)
- Verify response formats match expected schemas
- Confirm error handling works correctly
- Test edge cases (empty lists, invalid IDs)

### Comments:
- Both API endpoints implemented successfully and follow existing FastAPI patterns
- GET /entities/cleanup endpoint tested: returns entities with ≤1 meetings correctly with full type information
- DELETE /entities/bulk endpoint tested: successfully handles both complete success and partial failure scenarios
- Route ordering fixed: bulk endpoints now come before parameterized routes to avoid routing conflicts
- Manual testing confirmed all functionality works as expected:
  - Successful bulk deletion: "Successfully deleted all 2 entities"
  - Partial failure handling: "Deleted 2 of 3 entities, 1 failed" with detailed error messages
- API layer is ready for frontend integration in Phase 3
- Error handling and logging work correctly for both endpoints

## PHASE 3: Frontend Navigation and Routing [Not Started ⏳]

Set up the frontend infrastructure for the cleanup feature including routing and navigation updates.

### Add cleanup route to App.tsx [Not Started ⏳]

Update `frontend/src/App.tsx` to include:
- New route path="/entities/cleanup" with EntityCleanupPage component
- Import statement for EntityCleanupPage component
- Route positioned appropriately within existing Routes structure
- Ensure route follows existing routing patterns

### Update navigation in Layout.tsx [Not Started ⏳]

Modify `frontend/src/components/layout/Layout.tsx` to:
- Add "Cleanup" navigation item to existing navigation array
- Position between "Entities" and "Admin" as specified
- Use Trash2 icon from lucide-react for consistency
- Update navigation array with proper href="/entities/cleanup"
- Ensure active state highlighting works correctly

### Add API methods to api.ts [Not Started ⏳]

Extend `frontend/src/lib/api.ts` with new methods:
- Add getForCleanup method that calls GET /entities/cleanup
- Add bulkDelete method that calls DELETE /entities/bulk with proper data format
- Follow existing API patterns and error handling
- Ensure TypeScript types are properly defined
- Add to existing entityApi object structure

### Comments:
- These tasks can be done in parallel since they're independent frontend infrastructure changes
- Route and navigation changes are foundational for the cleanup page implementation
- API methods should match the backend endpoint specifications exactly

## PHASE 4: Frontend Entity Cleanup Page [Not Started ⏳]

Implement the main cleanup page with entity list display, bulk selection, and confirmation modal functionality.

### Create EntityCleanupPage component [Not Started ⏳]

Develop `frontend/src/pages/EntityCleanupPage.tsx` with:
- Main page container following existing page patterns
- TanStack Query integration for data fetching from getForCleanup API
- State management for bulk selection using Set<number>
- Loading and error state handling
- Integration with existing layout and styling patterns
- Proper TypeScript interfaces for component props and state

### Implement entity list with bulk selection [Not Started ⏳]

Within EntityCleanupPage, create entity list that:
- Displays entities with checkboxes for selection
- Shows entity name, type badge, and meeting count information
- Uses existing Badge component for entity type styling
- Implements "Select All" / "Deselect All" functionality
- Shows count of selected entities
- Follows existing EntitiesPage patterns for consistency
- Handles empty state when no entities need cleanup

### Create bulk delete confirmation modal [Not Started ⏳]

Implement confirmation modal that:
- Uses shadcn/ui Dialog component patterns
- Shows count of selected entities for confirmation
- Displays warning about permanent deletion
- Includes Cancel and Confirm actions
- Triggers bulk deletion API call on confirmation
- Handles success/error responses from bulk delete operation
- Shows detailed feedback for partial failures

### Implement success/error feedback system [Not Started ⏳]

Add user feedback functionality that:
- Shows success message with count of deleted entities
- Displays error details for failed deletions
- Uses existing Alert component patterns
- Refreshes entity list after successful operations
- Handles partial failure scenarios with detailed messaging
- Includes proper loading states during operations

### Comments:
- EntityCleanupPage is the main component and should be implemented first
- Entity list and modal can be developed in parallel once main page structure exists
- Feedback system should be integrated throughout all interactive components
- All components should follow existing design patterns and reuse existing UI components

## PHASE 5: Testing and Polish [Not Started ⏳]

Complete testing of the feature with unit tests and end-to-end verification to ensure all requirements are met.

### Write unit tests for database methods [Not Started ⏳]

Create comprehensive unit tests that verify:
- get_entities_for_cleanup returns correct entities based on meeting count
- bulk_delete_entities handles success cases properly
- bulk_delete_entities handles partial failure scenarios
- Cascading deletes maintain referential integrity
- Edge cases (empty lists, non-existent entities, constraint violations)

### End-to-end user flow testing [Not Started ⏳]

Test complete user journey:
- Navigate to cleanup page via navigation link
- Verify entities with ≤1 meetings are displayed correctly
- Test bulk selection functionality (individual, select all, mixed)
- Confirm modal appears with correct information
- Test successful deletion flow with page refresh
- Verify navigation and state management work correctly

### Error scenario testing [Not Started ⏳]

Test various error conditions:
- Partial failure scenarios (some entities deleted, some failed)
- Network errors during API calls
- Empty state when no entities need cleanup
- Concurrent deletion scenarios (if applicable)
- Invalid entity ID scenarios
- Database constraint violation handling

### Database integrity verification [Not Started ⏳]

Verify data consistency after operations:
- Confirm deleted entities no longer appear in entities list
- Verify action_items with deleted entity assignees are removed
- Check meeting_entities junction table is properly cleaned
- Ensure no orphaned records remain
- Confirm remaining entities maintain proper relationships

### Final requirements verification [Not Started ⏳]

Confirm all acceptance criteria are met:
- GET /entities/cleanup returns entities with ≤1 meetings ✓
- DELETE /entities/bulk performs cascading deletion with partial failure handling ✓
- Frontend displays entity list with multi-select checkboxes ✓
- Modal confirmation shows before permanent deletion ✓
- Database maintains referential integrity after deletion ✓
- Success/error feedback provided with details on partial failures ✓
- Page refreshes to show updated entity list ✓
- Navigation link "Cleanup" added after Entities, before Admin ✓

### Comments:
- Unit tests moved to final phase as requested to focus on implementation first
- Integration testing should be done after all components are implemented
- Error scenario testing is critical due to the permanent nature of deletions
- Database integrity verification ensures no data corruption occurs
- Final verification against original requirements ensures nothing is missed