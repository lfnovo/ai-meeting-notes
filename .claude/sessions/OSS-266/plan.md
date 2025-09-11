# OSS-266: Entity Cleanup - Remove Low-Engagement Entities

If you are working on this feature, make sure to update this plan.md file as you go.

## PHASE 1: Backend Foundation [✅ COMPLETED]

Implement the database layer and API endpoint to retrieve low-engagement entities. This phase establishes the core data retrieval functionality that the frontend will consume.

### Database Layer Implementation [✅ COMPLETED]

✅ **COMPLETED**: Added `get_low_usage_entities()` method to `backend/app/database.py`:
- ✅ Implemented LEFT JOIN query to find entities with ≤1 meeting associations
- ✅ Included entity type information (name and color_class) for frontend display
- ✅ Orders results alphabetically by entity name
- ✅ Handles edge cases (entities with 0 meetings) - found 5 entities with 0 meetings, 158 with 1 meeting
- ✅ Follows existing async/await patterns and error handling
- ✅ **NEW MODEL ADDED**: `EntityWithUsageStats` in `models.py` to include meeting_count field

**Implemented Query:**
```sql
SELECT e.*, et.name as type_name, et.color_class as type_color_class,
       COALESCE(COUNT(me.meeting_id), 0) as meeting_count
FROM entities e
LEFT JOIN entity_types et ON e.type_slug = et.slug
LEFT JOIN meeting_entities me ON e.id = me.entity_id
GROUP BY e.id, e.name, e.type_slug, e.description, e.created_at
HAVING COUNT(me.meeting_id) <= 1
ORDER BY e.name
```

### API Endpoint Implementation [✅ COMPLETED]

✅ **COMPLETED**: Added `GET /entities/low-usage` endpoint to `backend/app/api/routes.py`:
- ✅ Created route handler that calls the database method
- ✅ Uses new `EntityWithUsageStats` response model (includes meeting_count field)
- ✅ Follows existing error handling patterns with proper HTTP status codes
- ✅ Added appropriate logging using existing loguru patterns
- ✅ **ROUTING FIX**: Moved endpoint before `/entities/{entity_id}` to prevent path conflicts
- ✅ **TESTED**: Endpoint returns 163 low-usage entities correctly formatted

**TESTING RESULTS:**
- ✅ **163 total entities found**: 5 with 0 meetings + 158 with 1 meeting
- ✅ **Proper JSON structure**: All entities include id, name, type info, and meeting_count
- ✅ **Alphabetical sorting**: Entities properly sorted by name (.NET, AIES, AI Meeting Notes, etc.)
- ✅ **Type information**: Includes type_name and type_color_class for UI display
- ✅ **Edge cases handled**: Entities with 0 meetings properly included (BE 6, EDIOL, Prime Tech, etc.)

## PHASE 2: Frontend Navigation and Routing [Not Started ⏳]

Implement the navigation changes and basic routing infrastructure. This creates the entry point for users to access the cleanup functionality.

### Navigation Integration [Not Started ⏳]

Modify `frontend/src/components/layout/Layout.tsx`:
- Add "Cleanup" button to navigation array (last position)
- Use `Trash2` icon from lucide-react (already available)
- Follow existing navigation patterns for styling and active state
- Ensure proper TypeScript typing

### Route Setup [Not Started ⏳]

Modify `frontend/src/App.tsx`:
- Add `/cleanup` route pointing to `CleanupPage` component
- Follow existing route patterns for consistency
- Import the new CleanupPage component (will be created in Phase 3)

**Parallel Work**: Navigation and routing can be implemented in parallel once component structure is planned.

## PHASE 3: Core Cleanup Page Implementation [Not Started ⏳]

Create the main cleanup interface following existing patterns from EntitiesPage. This is the largest phase containing the core user interface functionality.

### CleanupPage Component Structure [Not Started ⏳]

Create `frontend/src/pages/CleanupPage.tsx`:
- Set up component skeleton with proper imports
- Implement TanStack Query hooks for data fetching:
  - `useQuery` for fetching low-usage entities
  - `useMutation` for bulk deletion
- Set up React state management:
  - `selectedEntityIds` Set for checkbox selections
  - `error` state for error display
- Follow existing patterns from `EntitiesPage.tsx`

### Entity Display and Selection [Not Started ⏳]

Implement card-based entity display:
- Use existing Card components from shadcn/ui
- Display entity information (name, type badge, description)
- Implement checkbox selection (individual entities)
- Add "Select All" functionality
- Show selection count in UI
- Follow existing styling patterns from EntitiesPage

### Bulk Operations Interface [Not Started ⏳]

Implement bulk deletion functionality:
- "Delete Selected" button (disabled when no selection)
- Simple confirmation modal with count ("Delete X entities?")
- Progress indicators during deletion
- Error handling and display
- Page refresh after successful deletion
- Follow existing modal and error patterns

**Sequential Dependencies**: Component structure must be established before implementing selection and bulk operations.

## PHASE 4: Integration and Testing [Not Started ⏳]

Complete the integration, handle edge cases, and perform comprehensive testing of the feature.

### API Integration Finalization [Not Started ⏳]

Ensure proper integration between frontend and backend:
- Verify `entityApi.getLowUsage()` works with new endpoint
- Test error scenarios (network errors, server errors)
- Ensure proper loading states and error messages
- Test with different data scenarios (0 entities, many entities)

### Edge Case Handling [Not Started ⏳]

Handle various edge cases and improve UX:
- Empty state when no low-usage entities exist
- Loading states during data fetch and deletion
- Proper error messages for different failure scenarios
- Confirmation modal edge cases
- Browser refresh/navigation during operations

### Manual Testing [Not Started ⏳]

Comprehensive testing of the complete feature:
- Test entity filtering logic (entities with 0 and 1 meetings)
- Test multi-select functionality (individual + select all)
- Test bulk deletion with various counts
- Test error scenarios
- Test UI responsiveness
- Verify navigation integration
- Test page refresh behavior

**Sequential Dependencies**: All previous phases must be completed before comprehensive testing.

## Development Notes

### Implementation Order
- **Sequential**: Phase 1 → Phase 2 can overlap → Phase 3 → Phase 4
- **Critical Path**: Database method → API endpoint → Frontend components → Integration
- **Parallel Opportunities**: Navigation and routing (Phase 2) can be done in parallel with API testing

### Key Technical Decisions
- **Database Query**: Single LEFT JOIN query for efficiency
- **UI Pattern**: Follow EntitiesPage card-based layout exactly
- **State Management**: TanStack Query + React hooks (no additional state management)
- **Error Handling**: Use existing Alert components and patterns

### Testing Strategy
- **Database**: Test query with various entity/meeting combinations
- **API**: Test endpoint via FastAPI docs interface
- **Frontend**: Manual testing through browser interface
- **Integration**: End-to-end testing of complete user flow

### Risk Mitigation
- **Data Loss**: Simple confirmation modal with clear messaging
- **Performance**: No pagination needed based on expected entity volumes
- **User Experience**: Follow existing patterns to ensure consistency