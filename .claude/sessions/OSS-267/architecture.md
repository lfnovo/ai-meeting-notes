# OSS-267: Entity Cleanup Interface - Architecture Document

## High-Level System Overview

### Current System State
The application has:
- **Backend**: FastAPI with SQLite database, using `DatabaseManager` abstraction layer
- **Frontend**: React TypeScript with TanStack Query for state management, shadcn/ui components
- **Database Schema**:
  - `entities` table with foreign key to `entity_types.slug`
  - `meeting_entities` junction table for many-to-many relationships
  - `action_items` table with optional `assignee` field (can reference entity names)

### System After Implementation
The system will add:
- **New Backend Endpoint**: `GET /entities/cleanup` - returns entities with ≤1 meetings
- **New Backend Endpoint**: `DELETE /entities/bulk` - bulk deletion with partial failure handling
- **New Frontend Route**: `/entities/cleanup` - dedicated cleanup interface
- **Enhanced Navigation**: "Cleanup" link positioned between Entities and Admin

## Affected Components and Dependencies

### Backend Components

#### 1. Database Layer (`backend/app/database.py`)
**New Methods Required:**
```python
async def get_entities_for_cleanup(self) -> List[EntityWithType]
async def bulk_delete_entities(entity_ids: List[int]) -> Dict[str, Any]
```

**Database Query Pattern:**
```sql
-- Entities with 0 or 1 meetings
SELECT e.*, et.name as type_name, et.color_class as type_color_class
FROM entities e
LEFT JOIN entity_types et ON e.type_slug = et.slug
LEFT JOIN meeting_entities me ON e.id = me.entity_id
GROUP BY e.id
HAVING COUNT(me.meeting_id) <= 1
ORDER BY e.created_at DESC;
```

**Cascading Delete Operations:**
1. `DELETE FROM action_items WHERE assignee IN (entity_names)`
2. `DELETE FROM meeting_entities WHERE entity_id IN (entity_ids)`
3. `DELETE FROM entities WHERE id IN (entity_ids)`

#### 2. API Layer (`backend/app/api/routes.py`)
**New Endpoints:**
```python
@router.get("/entities/cleanup", response_model=List[EntityWithType])
async def get_entities_for_cleanup(db: DatabaseManager = Depends(get_db))

@router.delete("/entities/bulk", response_model=Dict[str, Any])
async def bulk_delete_entities(request: EntityBulkDelete, db: DatabaseManager = Depends(get_db))
```

**Response Pattern for Bulk Delete:**
```json
{
  "message": "Successfully deleted 8 out of 10 entities",
  "deleted_count": 8,
  "failed_ids": [42, 137],
  "errors": ["Entity 42: Foreign key constraint failed", "Entity 137: Not found"]
}
```

#### 3. Models (`backend/app/models.py`)
**Existing Model Usage:**
- Reuse `EntityBulkDelete` model (already exists)
- Reuse `EntityWithType` for response model

### Frontend Components

#### 1. Routing (`frontend/src/App.tsx`)
**New Route Addition:**
```tsx
<Route path="/entities/cleanup" element={<EntityCleanupPage />} />
```

#### 2. Navigation (`frontend/src/components/layout/Layout.tsx`)
**Navigation Update:**
```tsx
const navigation = [
  { name: 'Feed', href: '/', icon: Home },
  { name: 'Meetings', href: '/meetings', icon: Calendar },
  { name: 'Entities', href: '/entities', icon: Users },
  { name: 'Cleanup', href: '/entities/cleanup', icon: Trash2 }, // NEW
  { name: 'Admin', href: '/admin', icon: Settings },
];
```

#### 3. New Components Required

**a) EntityCleanupPage (`frontend/src/pages/EntityCleanupPage.tsx`)**
- Main container component
- Manages bulk selection state
- Handles success/error feedback
- Follows existing page patterns

**b) EntityCleanupList Component**
- Reusable list component with checkboxes
- Similar pattern to existing `EntitiesPage` bulk operations
- Displays entity type badges, names, meeting counts

**c) BulkDeleteModal Component**
- Confirmation dialog component
- Uses existing shadcn/ui Dialog patterns
- Shows count of selected entities
- Displays warning about permanent deletion

#### 4. API Integration (`frontend/src/lib/api.ts`)
**New API Methods:**
```typescript
export const entityApi = {
  // ... existing methods
  getForCleanup: (): Promise<EntityWithType[]> =>
    api.get('/entities/cleanup').then(res => res.data),

  bulkDelete: (ids: number[]): Promise<BulkDeleteResponse> =>
    api.delete('/entities/bulk', { data: { ids } }).then(res => res.data),
};
```

## Patterns and Best Practices

### Backend Patterns (Following Existing Conventions)
1. **Database Abstraction**: All database operations through `DatabaseManager` class
2. **Error Handling**: Try-catch with proper HTTP exceptions and logging
3. **Dependency Injection**: FastAPI `Depends()` for database and service injection
4. **Response Models**: Pydantic models for type-safe API responses
5. **Async Operations**: All database operations are async with proper connection management

### Frontend Patterns (Following Existing Conventions)
1. **Component Structure**: Functional components with TypeScript interfaces
2. **State Management**: TanStack Query for server state, useState for local state
3. **Styling**: Tailwind CSS with shadcn/ui components and `cn()` utility
4. **Error Handling**: User-friendly error messages with Alert components
5. **Loading States**: Proper loading indicators and disabled states
6. **Navigation**: React Router with Link components for navigation

### Bulk Operations Pattern (Existing)
The app already has bulk operations patterns established in:
- `POST /entities/bulk-delete` (existing endpoint we'll enhance)
- `POST /entities/bulk-update-type` (pattern reference)
- Frontend bulk selection with checkboxes (pattern in EntitiesPage)

## External Dependencies

### Backend Dependencies (Already Available)
- `fastapi` - API framework
- `aiosqlite` - Async SQLite operations
- `pydantic` - Data validation and serialization
- `loguru` - Logging

### Frontend Dependencies (Already Available)
- `@tanstack/react-query` - Server state management
- `react-router-dom` - Client-side routing
- `lucide-react` - Icons (will use `Trash2` icon)
- `shadcn/ui` components - UI components (Dialog, Button, Checkbox, etc.)

### No New Dependencies Required
All functionality can be implemented using existing dependencies and patterns.

## Constraints and Assumptions

### Technical Constraints
1. **SQLite Limitations**: No native array operations, must use individual queries for bulk operations
2. **Foreign Key Constraints**: Must handle cascading deletes manually due to SQLite FK behavior
3. **Transaction Scope**: Individual entity deletions to support partial failure handling

### Business Constraints
1. **No Entity Protection**: All entities are eligible for cleanup regardless of type
2. **Hard Delete**: Permanent removal with no audit trail or soft delete
3. **Partial Failure Handling**: Continue with successful deletions, report failures

### Assumptions
1. **Performance**: Bulk operations will typically handle <100 entities at once
2. **Concurrency**: Single user system, no concurrent modification concerns
3. **Data Integrity**: Foreign key relationships properly maintained in application code

## Trade-offs and Alternatives

### Chosen Approach: Individual Delete Operations
**Pros:**
- Granular error handling
- Partial success support
- Matches existing patterns
- Simple to implement and debug

**Cons:**
- Multiple database round trips
- Not atomic across entire bulk operation

### Alternative: Single Transaction Approach
**Pros:**
- Atomic operation
- Better performance for large bulk operations

**Cons:**
- All-or-nothing behavior
- More complex error handling
- Doesn't match requirements (partial success needed)

### Chosen Approach: New Dedicated Route
**Pros:**
- Clear separation of concerns
- Easy to discover and use
- Follows existing URL patterns

**Alternative: Query Parameter on Existing Route**
**Cons:**
- Clutters existing entities API
- Less discoverable for users
- Doesn't align with REST principles for this specific use case

## Negative Consequences

### Minimal Impact Expected
1. **Database Performance**: Additional JOIN query for cleanup endpoint, but limited scope
2. **UI Complexity**: New navigation item, but follows existing patterns
3. **Maintenance**: Additional code to maintain, but straightforward CRUD operations

### Mitigation Strategies
1. **Query Optimization**: Proper indexing on meeting_entities table (already exists)
2. **Error Handling**: Comprehensive error messages for user feedback
3. **Testing**: Unit tests for all new functionality

## Files to be Modified/Created

### Backend Files
1. **Modified**: `backend/app/api/routes.py` - Add 2 new endpoints
2. **Modified**: `backend/app/database.py` - Add 2 new methods

### Frontend Files
1. **Modified**: `frontend/src/App.tsx` - Add new route
2. **Modified**: `frontend/src/components/layout/Layout.tsx` - Add navigation link
3. **Modified**: `frontend/src/lib/api.ts` - Add API methods
4. **Created**: `frontend/src/pages/EntityCleanupPage.tsx` - Main cleanup page
5. **Created**: `frontend/src/components/EntityCleanupList.tsx` - List component (optional, may inline)
6. **Created**: `frontend/src/components/BulkDeleteModal.tsx` - Confirmation modal (optional, may inline)

### Optional Enhancement Files
1. **Created**: `frontend/src/components/ui/dialog.tsx` - If not exists for modal (likely exists)

## Implementation Phases

### Phase 1: Backend Implementation
1. Add database methods for cleanup query and bulk delete
2. Add API endpoints with proper error handling
3. Unit tests for new endpoints

### Phase 2: Frontend Implementation
1. Add new route and navigation link
2. Create EntityCleanupPage with basic list view
3. Add bulk selection and confirmation modal
4. Integrate with backend APIs

### Phase 3: Integration Testing
1. Test full user flow
2. Test error scenarios (partial failures)
3. Verify database integrity after operations

## Architecture Alignment

This feature aligns well with the existing system architecture:
- **Separation of Concerns**: Clean separation between data, API, and UI layers
- **Consistent Patterns**: Follows established patterns for bulk operations and CRUD endpoints
- **Type Safety**: Full TypeScript coverage from database to UI
- **Error Handling**: Consistent error handling patterns throughout the stack
- **User Experience**: Follows existing UI/UX patterns for confirmations and feedback