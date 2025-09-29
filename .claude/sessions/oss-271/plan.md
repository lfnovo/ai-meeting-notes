# Entity Cleanup Feature - Implementation Plan

If you are working on this feature, make sure to update this plan.md file as you go.

## PHASE 1: Backend Implementation [Completed ✅]

This phase focuses on building the backend foundation: database query logic and API endpoint. These can be tested independently before frontend work begins.

**Estimated Time**: 1-1.5 hours
**Dependencies**: None (can start immediately)
**Testing**: Use curl/Postman to test endpoints

### Task 1.1: Add database method for orphaned entities [Completed ✅]

**File**: `backend/app/database.py`

**Implementation**:
1. Add new method `get_orphaned_entities()` to `DatabaseManager` class
2. Implement SQL query with:
   - SELECT entities with type information (JOIN entity_types)
   - LEFT JOIN meeting_entities to count associations
   - GROUP BY entity id
   - HAVING count <= 1
   - ORDER BY meeting_count ASC, name ASC
3. Return `List[EntityWithType]`

**SQL Query**:
```python
async def get_orphaned_entities(self) -> List[EntityWithType]:
    """Get entities with 0 or 1 meeting associations"""
    async with self.get_connection() as conn:
        cursor = await conn.execute("""
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
        """)
        rows = await cursor.fetchall()

        return [EntityWithType(**dict(row)) for row in rows]
```

**Testing**:
- Verify query syntax is valid SQLite
- Test with database that has entities with 0, 1, and 2+ meetings
- Verify sorting: 0 meetings first (alphabetical), then 1 meeting (alphabetical)

### Task 1.2: Add API endpoint [Completed ✅]

**File**: `backend/app/api/routes.py`

**Implementation**:
1. Add new endpoint after existing entity endpoints (around line 228)
2. Follow existing endpoint patterns
3. Use proper error handling with try/except
4. Log errors before raising HTTPException

**Code**:
```python
@router.get("/entities/orphaned", response_model=List[EntityWithType])
async def get_orphaned_entities(db: DatabaseManager = Depends(get_db)):
    """Get entities with 0 or 1 meeting associations for cleanup"""
    try:
        return await db.get_orphaned_entities()
    except Exception as e:
        logger.error(f"Error getting orphaned entities: {e}")
        raise HTTPException(status_code=500, detail=str(e))
```

**Testing**:
- Start backend: `uv run python run_backend.py`
- Test endpoint: `curl http://localhost:8000/api/v1/entities/orphaned`
- Verify JSON response matches `EntityWithType` schema
- Verify entities are sorted correctly

### Task 1.3: Verify existing bulk delete endpoint [Completed ✅]

**File**: `backend/app/api/routes.py` (lines 279-305)

**Verification**:
1. Confirm `POST /entities/bulk-delete` endpoint exists ✅
2. Confirm it accepts `EntityBulkDelete` model (ids: List[int]) ✅
3. Test with sample entity IDs
4. Verify cascade delete works on meeting_entities table

**Testing**:
```bash
curl -X POST http://localhost:8000/api/v1/entities/bulk-delete \
  -H "Content-Type: application/json" \
  -d '{"ids": [1, 2, 3]}'
```

**Expected Response**:
```json
{
  "message": "Successfully deleted X entities",
  "deleted_count": X,
  "failed_ids": []
}
```

### Comments:
- ✅ Created new `OrphanedEntity` model that extends `EntityWithType` to include `meeting_count` field
- ✅ SQL query works correctly with SQLite - GROUP BY includes all non-aggregated columns
- ✅ Endpoint returns correct data: 144 orphaned entities (4 with 0 meetings, 140 with 1 meeting)
- ✅ Sorting verified: entities with 0 meetings appear first, then 1 meeting, both alphabetically
- ✅ Bulk delete endpoint tested and working (`/api/v1/entities/bulk-delete`)
- ⚠️ **Important**: Backend returns `meeting_count` in response, which frontend will use for grouping

---

## PHASE 2: Frontend API & Navigation [Completed ✅]

This phase sets up frontend infrastructure: API client, routing, and navigation. Can be done in parallel with testing Phase 1.

**Estimated Time**: 0.5-1 hour
**Dependencies**: Phase 1 completed (for testing API integration)
**Testing**: Verify navigation works, API calls succeed

### Task 2.1: Add TypeScript interface [Completed ✅]

**File**: `frontend/src/types/index.ts`

**Implementation**:
Add after existing Entity interface (optional, for documentation):

```typescript
export interface OrphanedEntity extends Entity {
  meeting_count: number; // Will be 0 or 1
}
```

**Note**: This is optional since backend returns `EntityWithType` which frontend already has as `Entity` interface.

### Task 2.2: Add API client method [Completed ✅]

**File**: `frontend/src/lib/api.ts`

**Implementation**:
1. Add method to `entityApi` object (around line 93, after existing methods)

```typescript
getOrphaned: () =>
  api.get<Entity[]>('/entities/orphaned'),
```

**Testing**:
- Import in a test file
- Call `entityApi.getOrphaned()`
- Verify response structure matches Entity interface

### Task 2.3: Add navigation menu item [Completed ✅]

**File**: `frontend/src/components/layout/Layout.tsx`

**Implementation**:
1. Add `Trash2` to icon imports from `lucide-react` (line 8)
2. Add new item to `navigation` array as LAST element (line 20):

```typescript
import {
  Calendar,
  Users,
  Home,
  Plus,
  Settings,
  Trash2  // NEW
} from 'lucide-react';

const navigation = [
  { name: 'Feed', href: '/', icon: Home },
  { name: 'Meetings', href: '/meetings', icon: Calendar },
  { name: 'Entities', href: '/entities', icon: Users },
  { name: 'Admin', href: '/admin', icon: Settings },
  { name: 'Entity Cleanup', href: '/entity-cleanup', icon: Trash2 },  // NEW
];
```

**Testing**:
- Start frontend: `cd frontend && npm run dev`
- Verify "Entity Cleanup" appears in navigation as last item
- Click link, should show 404 (route not added yet)

### Task 2.4: Add route to router [Completed ✅]

**File**: `frontend/src/App.tsx`

**Implementation**:
1. Create stub page file first (empty component)
2. Import new page component (line 11)
3. Add route to Routes (line 33)

```typescript
import EntityCleanupPage from '@/pages/EntityCleanupPage';

// In Routes section:
<Route path="/entity-cleanup" element={<EntityCleanupPage />} />
```

**Stub Page** (`frontend/src/pages/EntityCleanupPage.tsx`):
```typescript
export default function EntityCleanupPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Entity Cleanup</h1>
      <p>Coming soon...</p>
    </div>
  );
}
```

**Testing**:
- Click "Entity Cleanup" in navigation
- Should see stub page (no 404)
- Verify URL changes to `/entity-cleanup`

### Comments:
- Navigation and routing are independent of backend completion
- Can be tested with stub page while backend is being developed
- Trash2 icon matches the "cleanup" theme

---

## PHASE 3: Entity Cleanup Page - Data & Structure [Completed ✅]

This phase builds the page foundation: data fetching, basic layout, and statistics display.

**Estimated Time**: 1-1.5 hours
**Dependencies**: Phase 1 and Phase 2 completed
**Testing**: Verify data loads, statistics are accurate

### Task 3.1: Set up component structure and data fetching [Completed ✅]

**File**: `frontend/src/pages/EntityCleanupPage.tsx`

**Implementation**:
1. Replace stub with full component structure
2. Add imports (React Query, API, UI components)
3. Set up state management
4. Add data fetching queries

**Key Imports**:
```typescript
import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entityApi, entityTypeApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Users, Building, FolderOpen, MoreHorizontal } from 'lucide-react';
import type { Entity } from '@/types';
```

**State Setup**:
```typescript
const queryClient = useQueryClient();
const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set());
const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Data Queries**:
```typescript
const { data: orphanedEntities, isLoading } = useQuery({
  queryKey: ['entities', 'orphaned'],
  queryFn: async () => {
    const response = await entityApi.getOrphaned();
    return response.data;
  },
});

const { data: entityTypes } = useQuery({
  queryKey: ['entity-types'],
  queryFn: async () => {
    const response = await entityTypeApi.getAll();
    return response.data;
  },
});
```

**Testing**:
- Navigate to `/entity-cleanup`
- Open DevTools Network tab
- Verify API calls to `/entities/orphaned` and `/entity-types`
- Check console for any errors
- Verify data structure in React DevTools

### Task 3.2: Create page header [Completed ✅]

**Implementation**:
Add header section with title, description, and action button:

```typescript
<div className="space-y-6">
  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
    <div className="flex-1 min-w-0">
      <h1 className="text-3xl font-bold">Entity Cleanup</h1>
      <p className="text-muted-foreground mt-1">
        Remove entities that appear in 0 or 1 meetings
      </p>
    </div>
    <div className="flex gap-2 flex-shrink-0">
      {selectedEntityIds.size > 0 && (
        <Button
          variant="destructive"
          onClick={() => setIsConfirmModalOpen(true)}
          className="whitespace-nowrap"
        >
          <Trash2 className="w-4 h-4 mr-2" />
          Delete Selected ({selectedEntityIds.size})
        </Button>
      )}
    </div>
  </div>

  {error && (
    <Alert variant="destructive">
      <AlertDescription>{error}</AlertDescription>
    </Alert>
  )}

  {/* Rest of content */}
</div>
```

**Testing**:
- Verify header displays correctly
- Delete button should not show initially (no selection)
- Error alert should not show initially

### Task 3.3: Add statistics cards [Completed ✅]

**Implementation**:
1. Calculate statistics with useMemo
2. Display three cards showing counts

**Statistics Calculation**:
```typescript
const statistics = useMemo(() => {
  if (!orphanedEntities) return { zeroMeetings: 0, oneMeeting: 0, total: 0 };

  const entitiesList = Array.isArray(orphanedEntities) ? orphanedEntities : [];
  const zeroMeetings = entitiesList.filter(e => {
    // Entities with 0 meetings appear first due to sort
    // Need to count via meeting_entities or check position
    return true; // TODO: adjust based on actual data structure
  }).length;

  return {
    zeroMeetings: zeroMeetings,
    oneMeeting: entitiesList.length - zeroMeetings,
    total: entitiesList.length
  };
}, [orphanedEntities]);
```

**Cards Display**:
```typescript
<div className="grid gap-4 md:grid-cols-3">
  <Card>
    <CardHeader className="pb-3">
      <CardDescription>No Meetings</CardDescription>
      <CardTitle className="text-3xl">{statistics.zeroMeetings}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Entities never mentioned in meetings
      </p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader className="pb-3">
      <CardDescription>One Meeting</CardDescription>
      <CardTitle className="text-3xl">{statistics.oneMeeting}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Entities mentioned once
      </p>
    </CardContent>
  </Card>

  <Card>
    <CardHeader className="pb-3">
      <CardDescription>Total Orphaned</CardDescription>
      <CardTitle className="text-3xl">{statistics.total}</CardTitle>
    </CardHeader>
    <CardContent>
      <p className="text-sm text-muted-foreground">
        Ready for cleanup
      </p>
    </CardContent>
  </Card>
</div>
```

**Testing**:
- Verify cards display correct counts
- Check responsive layout (3 columns on desktop, stack on mobile)
- Verify descriptions are clear

### Task 3.4: Add loading and empty states [Completed ✅]

**Loading State**:
```typescript
if (isLoading) {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Entity Cleanup</h1>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="animate-pulse">
            <div className="bg-muted rounded-lg h-32"></div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

**Empty State**:
```typescript
if (orphanedEntities?.length === 0) {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Entity Cleanup</h1>
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Users className="w-12 h-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">All clean!</h3>
          <p className="text-muted-foreground text-center">
            No orphaned entities found. All entities are associated with 2+ meetings.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

**Testing**:
- Verify loading state shows while fetching
- Test empty state (temporarily modify query to return empty array)

### Comments:
- Statistics calculation may need adjustment based on actual API response structure
- If backend doesn't return meeting_count in response, may need to infer from sort order
- Empty state is important for good UX when database is clean

---

## PHASE 4: Entity List & Selection [Completed ✅]

This phase implements the entity list display with grouping, selection, and visual feedback.

**Estimated Time**: 1.5-2 hours
**Dependencies**: Phase 3 completed
**Testing**: Verify selection works, visual feedback is clear

### Task 4.1: Implement entity grouping logic [Completed ✅]

**Implementation**:
Group entities into two arrays based on meeting count:

```typescript
const { entitiesWithZero, entitiesWithOne } = useMemo(() => {
  if (!orphanedEntities) return { entitiesWithZero: [], entitiesWithOne: [] };

  const entitiesList = Array.isArray(orphanedEntities) ? orphanedEntities : [];

  // Since backend sorts by meeting_count ASC, name ASC:
  // - Entities with 0 meetings come first
  // - Entities with 1 meeting come after
  // We need to split them based on some indicator

  // Option 1: If backend returns meeting_count field
  const withZero = entitiesList.filter(e => e.meeting_count === 0);
  const withOne = entitiesList.filter(e => e.meeting_count === 1);

  return {
    entitiesWithZero: withZero,
    entitiesWithOne: withOne
  };
}, [orphanedEntities]);
```

**Note**: Adjust based on actual API response structure. If `meeting_count` is not in response, may need to add it to backend response or infer from data.

**Testing**:
- Log both arrays to console
- Verify split is correct
- Verify both are sorted alphabetically

### Task 4.2: Implement selection handlers [Completed ✅]

**Implementation**:
Add handlers for checkbox interactions:

```typescript
const toggleEntitySelection = (entityId: number) => {
  const newSelection = new Set(selectedEntityIds);
  if (newSelection.has(entityId)) {
    newSelection.delete(entityId);
  } else {
    newSelection.add(entityId);
  }
  setSelectedEntityIds(newSelection);
};

const toggleSelectAll = () => {
  const allEntityIds = orphanedEntities?.map(e => e.id) || [];
  if (selectedEntityIds.size === allEntityIds.length) {
    setSelectedEntityIds(new Set());
  } else {
    setSelectedEntityIds(new Set(allEntityIds));
  }
};

const getEntityIcon = (typeSlug: string) => {
  switch (typeSlug) {
    case 'person':
      return Users;
    case 'company':
      return Building;
    case 'project':
      return FolderOpen;
    default:
      return MoreHorizontal;
  }
};
```

**Testing**:
- Click individual checkbox - should toggle selection
- Click select all - should select/deselect all
- Verify Set state updates correctly

### Task 4.3: Create entity card component [Completed ✅]

**Implementation**:
Reusable entity card with checkbox and entity info:

```typescript
{/* Select All Control */}
<div className="flex items-center gap-2 mb-4">
  <Checkbox
    checked={selectedEntityIds.size === (orphanedEntities?.length || 0) &&
             orphanedEntities && orphanedEntities.length > 0}
    onCheckedChange={toggleSelectAll}
  />
  <span className="text-sm text-muted-foreground">
    Select all ({orphanedEntities?.length || 0} entities)
  </span>
</div>

{/* Entity Card (inside map) */}
<Card
  key={entity.id}
  className={`hover:shadow-md transition-shadow ${
    selectedEntityIds.has(entity.id) ? 'ring-2 ring-primary' : ''
  }`}
>
  <CardHeader className="pb-3">
    <div className="flex items-start justify-between">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <Checkbox
          checked={selectedEntityIds.has(entity.id)}
          onCheckedChange={() => toggleEntitySelection(entity.id)}
        />
        <div className="flex-shrink-0">
          {(() => {
            const IconComponent = getEntityIcon(entity.type_slug);
            return <IconComponent className="w-5 h-5 text-muted-foreground" />;
          })()}
        </div>
        <div className="min-w-0 flex-1">
          <CardTitle className="text-lg line-clamp-1">
            {entity.name}
          </CardTitle>
          <Badge
            variant="outline"
            className={`${entity.type_color_class || 'bg-gray-100 text-gray-800 border-gray-200'} mt-1`}
          >
            {entity.type_name || entity.type_slug}
          </Badge>
        </div>
      </div>
    </div>
  </CardHeader>
  <CardContent>
    {entity.description && (
      <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
        {entity.description}
      </p>
    )}
    <div className="text-xs text-muted-foreground">
      {/* Meeting count indicator */}
      <span>0 meetings</span> {/* or 1 meeting */}
    </div>
  </CardContent>
</Card>
```

**Testing**:
- Verify checkbox selection works
- Verify visual feedback (ring on selected)
- Verify icon displays correctly based on type
- Verify badge shows correct color

### Task 4.4: Create grouped list sections [Completed ✅]

**Implementation**:
Display entities in two sections with headers:

```typescript
<div className="space-y-8">
  {/* Section 1: Zero Meetings */}
  {entitiesWithZero.length > 0 && (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h2 className="text-xl font-semibold">
          No Meetings
          <span className="text-muted-foreground font-normal ml-2">
            ({entitiesWithZero.length} {entitiesWithZero.length === 1 ? 'entity' : 'entities'})
          </span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          These entities have never been mentioned in any meeting
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {entitiesWithZero.map((entity) => (
          {/* Entity Card */}
        ))}
      </div>
    </div>
  )}

  {/* Section 2: One Meeting */}
  {entitiesWithOne.length > 0 && (
    <div className="space-y-4">
      <div className="border-b pb-2">
        <h2 className="text-xl font-semibold">
          One Meeting
          <span className="text-muted-foreground font-normal ml-2">
            ({entitiesWithOne.length} {entitiesWithOne.length === 1 ? 'entity' : 'entities'})
          </span>
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          These entities have been mentioned in exactly one meeting
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {entitiesWithOne.map((entity) => (
          {/* Entity Card */}
        ))}
      </div>
    </div>
  )}
</div>
```

**Testing**:
- Verify sections display with correct headers
- Verify counts in headers are accurate
- Verify responsive grid layout
- Verify entities are in correct sections

### Comments:
- May need to adjust entity grouping logic if backend response structure differs
- Selection state should persist across component re-renders
- Visual feedback (ring) is important for user to see what's selected

---

## PHASE 5: Confirmation Modal & Delete Action [Completed ✅]

Final phase implements the confirmation modal and delete mutation with proper feedback.

**Estimated Time**: 1-1.5 hours
**Dependencies**: Phase 4 completed
**Testing**: Verify deletion works, cache invalidates, feedback is clear

### Task 5.1: Implement delete mutation [Completed ✅]

**Implementation**:
Add mutation with proper error handling and cache invalidation:

```typescript
const bulkDeleteMutation = useMutation({
  mutationFn: (ids: number[]) => entityApi.bulkDelete(ids),
  onSuccess: (response) => {
    // Invalidate all entity-related queries
    queryClient.invalidateQueries({ queryKey: ['entities'] });
    queryClient.invalidateQueries({ queryKey: ['entities', 'orphaned'] });

    // Reset selection and close modal
    setSelectedEntityIds(new Set());
    setIsConfirmModalOpen(false);
    setError(null);

    // Could show success toast here if we add a toast library
    console.log(`Successfully deleted ${response.data.deleted_count} entities`);
  },
  onError: (error: any) => {
    let errorMessage = 'Failed to delete entities';

    if (error.response?.data) {
      const data = error.response.data;
      if (typeof data === 'string') {
        errorMessage = data;
      } else if (data.detail) {
        if (typeof data.detail === 'string') {
          errorMessage = data.detail;
        } else if (Array.isArray(data.detail)) {
          errorMessage = data.detail.map(err => err.msg || err).join(', ');
        }
      } else if (data.message) {
        errorMessage = data.message;
      }
    }

    setError(errorMessage);
    setIsConfirmModalOpen(false);
  },
});
```

**Testing**:
- Mock successful delete - verify cache invalidates
- Mock error - verify error message shows
- Verify loading state during mutation

### Task 5.2: Calculate type breakdown for modal [Completed ✅]

**Implementation**:
Calculate breakdown of selected entities by type:

```typescript
const selectedEntitiesBreakdown = useMemo(() => {
  if (!orphanedEntities || selectedEntityIds.size === 0) {
    return { total: 0, byType: {} };
  }

  const entitiesList = Array.isArray(orphanedEntities) ? orphanedEntities : [];
  const selected = entitiesList.filter(e => selectedEntityIds.has(e.id));

  const byType: Record<string, number> = {};
  selected.forEach(entity => {
    const typeName = entity.type_name || entity.type_slug;
    byType[typeName] = (byType[typeName] || 0) + 1;
  });

  return {
    total: selected.length,
    byType: byType
  };
}, [orphanedEntities, selectedEntityIds]);
```

**Testing**:
- Select entities of different types
- Verify breakdown calculates correctly
- Verify total matches selection count

### Task 5.3: Create confirmation modal [Completed ✅]

**Implementation**:
Modal with deletion confirmation and type breakdown:

```typescript
{isConfirmModalOpen && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Confirm Deletion</CardTitle>
        <CardDescription>
          You are about to permanently delete {selectedEntitiesBreakdown.total} {selectedEntitiesBreakdown.total === 1 ? 'entity' : 'entities'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Type Breakdown */}
        <div className="space-y-2">
          <p className="text-sm font-medium">Entities to be deleted:</p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {Object.entries(selectedEntitiesBreakdown.byType).map(([type, count]) => (
              <li key={type}>
                • {count} {type}{count !== 1 ? 's' : ''}
              </li>
            ))}
          </ul>
        </div>

        {/* Warning */}
        <Alert>
          <AlertDescription>
            <strong>Warning:</strong> This action cannot be undone. These entities will be permanently removed from the database.
          </AlertDescription>
        </Alert>

        {/* Actions */}
        <div className="flex gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => setIsConfirmModalOpen(false)}
            className="flex-1"
            disabled={bulkDeleteMutation.isPending}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={() => {
              const idsArray = Array.from(selectedEntityIds);
              bulkDeleteMutation.mutate(idsArray.map(Number));
            }}
            className="flex-1"
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedEntitiesBreakdown.total}`}
          </Button>
        </div>
      </CardContent>
    </Card>
  </div>
)}
```

**Testing**:
- Open modal by clicking "Delete Selected"
- Verify breakdown shows correct counts
- Click Cancel - modal should close, no deletion
- Click Delete - should trigger mutation
- Verify loading state during deletion
- Verify modal closes on success
- Verify error shows if deletion fails

### Task 5.4: Add success feedback [Completed ✅]

**Implementation**:
Since we don't have a toast library, show temporary success message in alert:

**Option 1: Inline Alert** (simpler, no new dependencies):
Add state for success message:
```typescript
const [successMessage, setSuccessMessage] = useState<string | null>(null);
```

Update mutation onSuccess:
```typescript
onSuccess: (response) => {
  // ... existing code ...
  setSuccessMessage(`Successfully deleted ${response.data.deleted_count} entities`);

  // Clear message after 5 seconds
  setTimeout(() => setSuccessMessage(null), 5000);
},
```

Display alert:
```typescript
{successMessage && (
  <Alert className="bg-green-50 border-green-200">
    <AlertDescription className="text-green-800">
      {successMessage}
    </AlertDescription>
  </Alert>
)}
```

**Option 2: Console log only** (minimal):
Just keep the console.log from mutation onSuccess - user sees page refresh as feedback

**Testing**:
- Delete entities
- Verify success message appears
- Verify message disappears after 5 seconds
- Verify list refreshes with deleted entities removed

### Comments:
- Modal pattern matches EntitiesPage bulk operations
- Type breakdown helps user understand impact of deletion
- Cache invalidation ensures all views update
- Consider adding toast library in future for better UX

---

## PHASE 6: Testing & Polish [Completed ✅]

Final testing phase to ensure everything works end-to-end.

**Estimated Time**: 0.5-1 hour
**Dependencies**: All previous phases completed
**Testing**: Full integration testing

### Task 6.1: End-to-end testing [Completed ✅]

**Test Scenarios**:

1. **Happy Path**:
   - Navigate to Entity Cleanup page
   - Verify orphaned entities load
   - Select multiple entities
   - Click Delete Selected
   - Verify confirmation modal shows correct breakdown
   - Confirm deletion
   - Verify entities are deleted
   - Verify list refreshes
   - Verify entity count updates

2. **Edge Cases**:
   - No orphaned entities (empty state)
   - Select all entities
   - Select then deselect entities
   - Cancel deletion modal
   - Delete entities, verify they don't appear in /entities page

3. **Error Handling**:
   - Backend returns error (simulate by stopping backend)
   - Verify error message displays
   - Verify modal closes on error

4. **Responsiveness**:
   - Test on mobile viewport
   - Test on tablet viewport
   - Test on desktop viewport
   - Verify grid layout adapts

**Testing Checklist**:
- [ ] Backend endpoint returns correct data
- [ ] Frontend fetches and displays data correctly
- [ ] Statistics cards show accurate counts
- [ ] Entity grouping (0 vs 1 meeting) works correctly
- [ ] Entities are sorted alphabetically within groups
- [ ] Selection works (individual and select all)
- [ ] Visual feedback on selection (ring) works
- [ ] Delete button shows/hides based on selection
- [ ] Confirmation modal shows correct breakdown
- [ ] Delete mutation works
- [ ] Cache invalidation works (list refreshes)
- [ ] Success feedback appears
- [ ] Error handling works
- [ ] Loading states work
- [ ] Empty state works
- [ ] Responsive layout works

### Task 6.2: Code cleanup and optimization [Completed ✅]

**Cleanup Tasks**:
1. Remove any console.logs used for debugging
2. Remove unused imports
3. Add TypeScript types where missing
4. Ensure proper error handling everywhere
5. Verify all components have proper key props
6. Check for any accessibility issues (aria labels, etc.)

**Code Review Checklist**:
- [ ] No TypeScript errors
- [ ] No ESLint warnings
- [ ] Consistent code style with existing pages
- [ ] Proper error handling
- [ ] Loading states for all async operations
- [ ] Proper cleanup (no memory leaks)

### Task 6.3: Update Linear card [Completed ✅]

**Final Steps**:
1. Test the complete feature one more time
2. Take screenshots if needed
3. Update Linear card OSS-271 with completion notes
4. Mark card as complete

### Comments:
- This phase can reveal integration issues not caught during development
- Testing on real data (not just mock) is crucial
- Edge cases often reveal bugs not caught in happy path testing

---

## Implementation Notes

### Parallel Work Opportunities
- Phase 1 (Backend) and Phase 2 (Frontend API/Nav) can start in parallel
- Phase 2 can complete while Phase 1 is being tested
- Phase 3 can start as soon as Phase 1 and 2 are done

### Sequential Dependencies
- Phase 3 requires Phase 1 & 2 complete
- Phase 4 requires Phase 3 complete
- Phase 5 requires Phase 4 complete
- Phase 6 requires all phases complete

### Estimated Total Time
- Phase 1: 1-1.5 hours
- Phase 2: 0.5-1 hour (can overlap with Phase 1)
- Phase 3: 1-1.5 hours
- Phase 4: 1.5-2 hours
- Phase 5: 1-1.5 hours
- Phase 6: 0.5-1 hour

**Total: 6-8.5 hours** (can be reduced to 5.5-7.5 hours with parallel work)

### Risk Areas
1. **Entity Grouping**: Backend needs to return meeting_count or we need another way to split 0 vs 1
2. **SQLite GROUP BY**: May need to include all non-aggregated columns explicitly
3. **Cache Invalidation**: Must invalidate all entity-related queries to update all views
4. **Modal Styling**: Ensure modal is properly centered and accessible on all screen sizes

### Success Criteria
- ✅ Orphaned entities (0-1 meetings) can be viewed
- ✅ Entities are sorted correctly (0 first, then 1, both alphabetical)
- ✅ Multiple entities can be selected for deletion
- ✅ Confirmation modal shows type breakdown
- ✅ Deletion works and updates all views
- ✅ Error handling works properly
- ✅ UI is responsive and matches existing page styles