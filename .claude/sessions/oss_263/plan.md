# Entity Check-up Feature Implementation Plan

If you are working on this feature, make sure to update this plan.md file as you go.

## PHASE 1: Backend Foundation [Completed ✅]

**Goal**: Establish backend infrastructure for entity check-up functionality
**Estimated Time**: 2 hours
**Dependencies**: None (can start immediately)

### Create EntityLowUsage Pydantic model [Completed ✅]

**Location**: `backend/app/models.py`
- Added `EntityLowUsage` model with entity data + meeting context
- Includes fields: id, name, type_slug, description, created_at, meeting_id, meeting_title, meeting_date, type_name, color_class
- Follows existing model patterns with proper Pydantic Field validation
- Added Config class with from_attributes = True

### Implement get_low_usage_entities database method [Completed ✅]

**Location**: `backend/app/database.py`
- Added `get_low_usage_entities()` method to DatabaseManager class
- Implemented complex SQL JOIN query with GROUP BY and HAVING clauses
- Returns entities that appear in exactly 1 meeting with meeting context
- Follows existing async connection patterns and error handling
- Added proper EntityLowUsage import

### Verify delete_entity CASCADE behavior [Completed ✅]

**Location**: `backend/app/database.py`
- Reviewed existing `delete_entity()` method - found critical issue!
- **IMPORTANT FIX**: Original method didn't handle CASCADE deletion properly
- Enhanced method to manually delete from meeting_entities table first
- Added foreign key constraint enabling (PRAGMA foreign_keys = ON)
- Added transaction handling with rollback on errors
- Added existence check and proper error handling

### Add GET /entities/low-usage endpoint [Completed ✅]

**Location**: `backend/app/api/routes.py`
- Created new endpoint `/entities/low-usage` that calls `get_low_usage_entities()`
- Follows existing patterns for error handling and logging
- Returns `List[EntityLowUsage]` response model
- Added proper documentation and status codes
- Uses get_db() dependency injection pattern

### Comments:
- **Critical Fix**: Discovered and fixed a data integrity issue in existing delete_entity method
- The original implementation was leaving orphaned records in meeting_entities table
- Enhanced CASCADE deletion now prevents data corruption
- All new code follows existing project patterns and conventions
- Backend foundation is now solid and ready for frontend integration

## PHASE 2: Backend API Completion & Testing [Partially Complete ✅]

**Goal**: Complete backend API and ensure reliability with tests
**Estimated Time**: 2 hours
**Dependencies**: Must complete Phase 1 first

### Verify bulk delete endpoint functionality [Completed ✅]

**Location**: `backend/app/api/routes.py`
- Reviewed existing `POST /entities/bulk-delete` endpoint - working perfectly
- Uses EntityBulkDelete model correctly with proper validation (1-100 IDs)
- Handles multiple entity deletions with our enhanced CASCADE delete_entity() method
- Proper error handling and detailed response format
- Handles partial failures gracefully with success/failure feedback
- Tested with various scenarios - all working correctly

### Create comprehensive backend tests [Deferred 📋]

**Location**: `backend/tests/test_checkup_endpoints.py` (new file)
- **DECISION**: Deferred to focus on implementation first
- Will be implemented after frontend is complete
- Backend functionality verified manually and working correctly

### Backend integration validation [Completed ✅]

- Verified complete backend flow: query → API → delete works correctly
- Confirmed data integrity with CASCADE deletion improvements
- Tested with sample data - no orphaned records
- Logging works properly throughout all operations

### Comments:
- **Backend API is 100% functional**: All endpoints work correctly
- **Bulk delete verified**: Existing endpoint handles our use case perfectly
- **CASCADE deletion fixed**: Critical data integrity issue resolved in Phase 1
- **Tests deferred**: Focus on implementation first, tests later
- **Ready for frontend**: Backend provides solid foundation

## PHASE 3: Frontend Foundation & Navigation [Completed ✅]

**Goal**: Set up frontend infrastructure and navigation
**Estimated Time**: 2 hours  
**Dependencies**: Can start in parallel with Phase 1

### Add TypeScript interface [Completed ✅]

**Location**: `frontend/src/types/index.ts`
- Created `EntityLowUsage` interface matching backend Pydantic model exactly
- Includes all fields: id, name, type_slug, description, created_at, meeting_id, meeting_title, meeting_date, type_name, color_class
- Follows existing TypeScript patterns and conventions
- Proper optional fields with `?` modifier

### Update navigation component [Completed ✅]

**Location**: `frontend/src/components/layout/Layout.tsx`
- Added "Check-up" navigation item with Wrench icon from Lucide
- Positioned between "Admin" and action buttons as requested
- Active state styling works correctly with existing logic
- Follows exact same pattern as other navigation items

### Add routing configuration [Completed ✅]

**Location**: `frontend/src/App.tsx`
- Added new route: `/checkup` pointing to `CheckupPage`
- Imported CheckupPage component following existing patterns
- Route positioned logically after `/admin` route
- Works within existing Layout structure

### Create basic CheckupPage component structure [Completed ✅]

**Location**: `frontend/src/pages/CheckupPage.tsx` (new file)
- Created comprehensive component with proper TypeScript
- Added page header with title and clear description
- Built robust structure with placeholder for table, actions, and modals
- Includes entity cards structure, bulk selection, and confirmation dialogs
- Follows all existing page component patterns (similar to EntitiesPage/AdminPage)
- Ready for data integration in Phase 4

### Comments:
- **Navigation fully functional**: Users can navigate to Check-up page from top bar
- **Component structure robust**: CheckupPage has comprehensive placeholder structure
- **TypeScript integration complete**: Full type safety for EntityLowUsage data
- **Ready for backend integration**: All foundation pieces in place for Phase 4
- **Follows all project patterns**: Maintains consistency with existing codebase

## PHASE 4: Frontend Core Implementation [In Progress ⏰]

**Goal**: Implement main check-up functionality with data fetching
**Estimated Time**: 2 hours
**Dependencies**: Must complete Phase 1 and Phase 3

### Implement data fetching with TanStack Query [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx`
- Create custom hook or direct query for fetching low-usage entities
- Implement proper loading states and error handling
- Follow existing patterns for API calls
- Set up cache invalidation strategy

### Build entity table with Shadcn components [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx`
- Implement table using Shadcn UI Table components
- Create columns for: selection checkbox, entity info, type badge, meeting context, actions
- Display entity name, type, and description
- Show meeting title, date with proper formatting
- Include link to meeting detail page

### Implement individual delete functionality [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx`
- Add delete button for each row
- Implement confirmation dialog using Shadcn Dialog
- Create delete mutation with TanStack Query
- Handle success/error states and cache invalidation
- Show loading states during deletion

## PHASE 5: Multi-Select & Bulk Operations [Not Started ⏳]

**Goal**: Complete multi-selection and bulk deletion functionality
**Estimated Time**: 2 hours
**Dependencies**: Must complete Phase 4

### Implement multi-select functionality [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx`
- Add "select all" checkbox in table header
- Implement individual row selection state management
- Create selected items counter
- Handle select all/none functionality
- Show selected count dynamically

### Build bulk actions interface [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx`
- Create bulk actions section with selected counter
- Add "Delete Selected" button with appropriate styling
- Show/hide bulk actions based on selection state
- Implement proper disabled states when no items selected

### Implement bulk delete functionality [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx`
- Create bulk delete confirmation dialog
- Show list of entities to be deleted in confirmation
- Implement bulk delete mutation using existing backend endpoint
- Handle success/error feedback with detailed results
- Update table and clear selections after successful delete
- Handle partial failures gracefully

## PHASE 6: Polish & Final Testing [Not Started ⏳]

**Goal**: Polish UX, error handling, and final validation
**Estimated Time**: 2 hours
**Dependencies**: Must complete Phase 5

### Enhance user experience [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx`
- Improve loading states throughout the interface
- Add skeleton loading for table rows
- Implement proper empty state when no entities found
- Add tooltips and better accessibility labels
- Ensure proper keyboard navigation

### Implement comprehensive error handling [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx`
- Handle network errors gracefully
- Show meaningful error messages to users
- Implement retry functionality where appropriate
- Handle edge cases (server errors, validation failures)
- Ensure errors don't break the interface

### Final integration testing [Not Started ⏳]

- Test complete end-to-end user flow
- Verify navigation works from all entry points
- Test with various data scenarios (empty, single, multiple entities)
- Verify confirmation dialogs work correctly
- Test bulk operations with different selection patterns
- Ensure no data integrity issues
- Validate responsive design on different screen sizes

### Comments:
- Backend and frontend phases 1-3 can be developed in parallel
- Phase 4 requires both backend (Phase 1) and frontend foundation (Phase 3) to be complete
- Phases 4-6 must be sequential as each builds on the previous
- Testing should be done incrementally throughout each phase
- Each phase should end with working functionality that can be demonstrated