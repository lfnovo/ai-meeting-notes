# Entity Check-up Feature Implementation Plan

If you are working on this feature, make sure to update this plan.md file as you go.

## PHASE 1: Backend Foundation [In Progress ⏰]

**Goal**: Establish backend infrastructure for entity check-up functionality
**Estimated Time**: 2 hours
**Dependencies**: None (can start immediately)

### Create EntityLowUsage Pydantic model [Not Started ⏳]

**Location**: `backend/app/models.py`
- Add `EntityLowUsage` model with entity data + meeting context
- Include fields: id, name, type_slug, description, created_at, meeting_id, meeting_title, meeting_date, type_name, color_class
- Follow existing model patterns with proper validation

### Implement get_low_usage_entities database method [Not Started ⏳]

**Location**: `backend/app/database.py`
- Add `get_low_usage_entities()` method to DatabaseManager class
- Implement the complex SQL JOIN query with GROUP BY and HAVING clauses
- Return entities that appear in exactly 1 meeting with meeting context
- Follow existing async connection patterns and error handling

### Verify delete_entity CASCADE behavior [Not Started ⏳]

**Location**: `backend/app/database.py`
- Review existing `delete_entity()` method
- Ensure CASCADE delete properly removes from meeting_entities table
- Test with sample data to confirm no orphaned records

### Add GET /entities/low-usage endpoint [Not Started ⏳]

**Location**: `backend/app/api/routes.py`
- Create new endpoint that calls `get_low_usage_entities()`
- Follow existing patterns for error handling and logging
- Return `List[EntityLowUsage]` response model
- Add proper documentation and status codes

## PHASE 2: Backend API Completion & Testing [Not Started ⏳]

**Goal**: Complete backend API and ensure reliability with tests
**Estimated Time**: 2 hours
**Dependencies**: Must complete Phase 1 first

### Verify bulk delete endpoint functionality [Not Started ⏳]

**Location**: `backend/app/api/routes.py`
- Review existing `POST /entities/bulk-delete` endpoint
- Ensure it works correctly with EntityBulkDelete model
- Test bulk deletion functionality
- Verify proper error handling and response format

### Create comprehensive backend tests [Not Started ⏳]

**Location**: `backend/tests/test_checkup_endpoints.py` (new file)
- Unit tests for `get_low_usage_entities()` method
- Test edge cases: no entities, multiple entities, database errors
- Tests for low-usage endpoint with various scenarios
- Test bulk deletion scenarios and error cases
- Ensure all tests pass and provide good coverage

### Backend integration validation [Not Started ⏳]

- Test complete backend flow: query → display → delete
- Verify data integrity after deletions
- Test performance with larger datasets
- Ensure logging works properly throughout

## PHASE 3: Frontend Foundation & Navigation [Not Started ⏳]

**Goal**: Set up frontend infrastructure and navigation
**Estimated Time**: 2 hours  
**Dependencies**: Can start in parallel with Phase 1

### Add TypeScript interface [Not Started ⏳]

**Location**: `frontend/src/types/index.ts`
- Create `EntityLowUsage` interface matching backend Pydantic model
- Include all fields for entity data and meeting context
- Ensure type safety alignment

### Update navigation component [Not Started ⏳]

**Location**: `frontend/src/components/layout/Layout.tsx`
- Add "Check-up" navigation item to the navigation array
- Import appropriate icon from Lucide (Wrench recommended)
- Position between "Admin" and action buttons
- Ensure active state styling works correctly

### Add routing configuration [Not Started ⏳]

**Location**: `frontend/src/App.tsx`
- Add new route: `/checkup` pointing to `CheckupPage`
- Import the CheckupPage component
- Ensure routing works within existing layout structure

### Create basic CheckupPage component structure [Not Started ⏳]

**Location**: `frontend/src/pages/CheckupPage.tsx` (new file)
- Create basic component with proper TypeScript
- Add page header with title and description
- Set up basic structure for table and actions
- Include placeholder content to verify routing works

## PHASE 4: Frontend Core Implementation [Not Started ⏳]

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