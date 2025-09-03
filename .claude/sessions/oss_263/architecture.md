# OSS-263: Entity Check-up Feature - Architecture

## High-Level Overview

### Current System
The application currently has:
- **Backend**: FastAPI with SQLite database and dedicated DatabaseManager class
- **Frontend**: React TypeScript with Shadcn UI components and React Router
- **Entity System**: Dynamic entity types with many-to-many relationship to meetings
- **Navigation**: Top bar with Feed, Meetings, Entities, Admin sections

### After Implementation
Adding a new Check-up page that:
- Provides entity maintenance tooling accessible from top navigation
- Lists entities with exactly 1 meeting association for cleanup
- Enables individual and bulk deletion with proper confirmations
- Maintains data integrity through CASCADE deletion patterns

## System Components & Dependencies

### Backend Architecture

#### New API Endpoints
**Location**: `backend/app/api/routes.py`

1. **GET `/api/v1/entities/low-usage`**
   - Returns entities with exactly 1 meeting association
   - Includes meeting context (title, date) for user decision-making
   - Uses JOIN with meeting_entities and GROUP BY pattern

2. **DELETE `/api/v1/entities/{id}` (existing, ensure CASCADE)**
   - Complete entity deletion with CASCADE to meeting_entities
   - Already exists, verify CASCADE behavior is correct

3. **DELETE `/api/v1/entities/batch`**
   - Bulk deletion endpoint (leverages existing EntityBulkDelete model)
   - Processes multiple entity IDs in single transaction
   - Returns detailed success/failure feedback

#### Database Layer Enhancement
**Location**: `backend/app/database.py`

- **New Method**: `get_low_usage_entities()`
  - SQL Query with JOIN and HAVING clause
  - Returns entities with meeting context
  - Follows existing async connection patterns

#### Pydantic Models
**Location**: `backend/app/models.py`

- **New Model**: `EntityLowUsage`
  - Entity data + meeting context (title, date, meeting_id)
  - Used for low-usage endpoint response
- **Existing Model**: `EntityBulkDelete` (reuse for batch deletion)

### Frontend Architecture

#### New Route & Navigation
**Location**: `frontend/src/App.tsx`
- Add new route: `/checkup` → `CheckupPage`

**Location**: `frontend/src/components/layout/Layout.tsx`
- Add "Check-up" navigation item with appropriate icon (Wrench or Settings)
- Position between "Admin" and action buttons

#### New Page Component
**Location**: `frontend/src/pages/CheckupPage.tsx`
- Primary component implementing the check-up interface
- State management for multi-select functionality
- Integration with confirmation modals

#### UI Components Structure
```
CheckupPage
├── Header (title + description)
├── EntityTable (Shadcn Table)
│   ├── HeaderRow (select all, column headers)
│   └── EntityRows[]
│       ├── Checkbox (selection)
│       ├── Entity Info (name, type, description)
│       ├── Meeting Context (title, date, link)
│       └── Delete Button (individual)
├── BulkActions
│   ├── Selected Counter
│   └── Delete Selected Button
└── ConfirmationDialog (delete confirmation)
```

#### State Management Patterns
- **TanStack Query**: Server state for entities and mutations
- **useState**: Local state for multi-select management
- **Custom Hooks**: `useCheckupEntities`, `useDeleteEntity`, `useDeleteEntities`

#### TypeScript Interfaces
**Location**: `frontend/src/types/index.ts`
- **New Interface**: `EntityLowUsage` (mirrors backend Pydantic model)
- **Existing**: `Entity`, `EntityWithType` (reuse where applicable)

## Implementation Patterns & Best Practices

### Backend Patterns
1. **Database Abstraction**: All queries through DatabaseManager methods
2. **Error Handling**: Consistent HTTPException patterns with proper status codes
3. **Logging**: loguru integration for debugging and monitoring
4. **Dependency Injection**: FastAPI Depends pattern for DatabaseManager
5. **Response Models**: Pydantic validation for all responses

### Frontend Patterns
1. **Component Composition**: Shadcn UI components with cn() utility
2. **Data Fetching**: TanStack Query with proper cache invalidation
3. **Type Safety**: Full TypeScript coverage with interface validation
4. **Error Boundaries**: Proper error handling for network failures
5. **Accessibility**: Proper ARIA labels and keyboard navigation

### Database Query Pattern
```sql
SELECT 
    e.*, 
    et.name as type_name,
    et.color_class,
    COUNT(me.meeting_id) as meeting_count,
    m.title as meeting_title,
    m.date as meeting_date,
    m.id as meeting_id
FROM entities e 
JOIN entity_types et ON e.type_slug = et.slug
JOIN meeting_entities me ON e.id = me.entity_id 
JOIN meetings m ON me.meeting_id = m.id
GROUP BY e.id 
HAVING meeting_count = 1
ORDER BY e.created_at DESC
```

## External Dependencies

### No New Dependencies Required
- **Backend**: Uses existing FastAPI, aiosqlite, loguru, pydantic stack
- **Frontend**: Uses existing React, TypeScript, Shadcn UI, TanStack Query stack
- **Database**: Leverages existing SQLite schema and patterns

### Existing Dependencies Leveraged
- **Shadcn UI**: Table, Checkbox, Button, Dialog components
- **Lucide Icons**: For check-up navigation icon (Wrench recommended)
- **TanStack Query**: For server state management and mutations
- **React Router**: For new route registration

## Constraints & Assumptions

### Technical Constraints
- **No Pagination**: Display all results (assumption: manageable dataset size)
- **Single Transaction**: Bulk deletes processed in single operation
- **CASCADE Deletion**: Complete entity removal including junction table records
- **No Undo**: Deletions are permanent (confirmed by user requirements)

### Business Assumptions
- **Low Usage Definition**: Exactly 1 meeting association (not 0 or 2+)
- **No Entity Type Protection**: All entity types can be deleted
- **No Audit Requirements**: No logging of deletion activities
- **User Responsibility**: Users understand deletion consequences

## Trade-offs & Alternatives

### Chosen Approach: Complete Deletion
**Pro**: Simple, clean, removes unused data
**Con**: No recovery mechanism if user deletes incorrectly
**Alternative**: Soft delete with archive flag (rejected for complexity)

### Chosen Approach: Single Page Display
**Pro**: Simple UI, no pagination complexity
**Con**: Potential performance issues with large datasets
**Alternative**: Pagination (rejected per requirements)

### Chosen Approach: Synchronous Bulk Delete
**Pro**: Simple feedback, immediate results
**Con**: Potential timeout with large batches
**Alternative**: Background job processing (overkill for use case)

## Files to be Created/Modified

### Backend Files
1. **Modified**: `backend/app/api/routes.py`
   - Add `GET /entities/low-usage` endpoint
   - Verify `DELETE /entities/batch` exists and works correctly

2. **Modified**: `backend/app/database.py`
   - Add `get_low_usage_entities()` method
   - Verify CASCADE behavior in `delete_entity()`

3. **Modified**: `backend/app/models.py`
   - Add `EntityLowUsage` Pydantic model

### Frontend Files
1. **Created**: `frontend/src/pages/CheckupPage.tsx`
   - Main check-up interface component

2. **Modified**: `frontend/src/App.tsx`
   - Add `/checkup` route

3. **Modified**: `frontend/src/components/layout/Layout.tsx`
   - Add Check-up navigation item

4. **Modified**: `frontend/src/types/index.ts`
   - Add `EntityLowUsage` TypeScript interface

5. **Created**: `frontend/src/hooks/useCheckup.ts` (optional)
   - Custom hooks for check-up functionality

### Test Files
1. **Created**: `backend/tests/test_checkup_endpoints.py`
   - Unit tests for new endpoints
   - Edge cases for low-usage query
   - Bulk deletion scenarios

## Risk Mitigation

### Data Loss Prevention
- **Confirmation Dialogs**: Both individual and bulk deletions require confirmation
- **Clear Context**: Show meeting information so users understand what they're deleting
- **Detailed Feedback**: Return specific success/failure information for bulk operations

### Performance Considerations
- **Query Optimization**: Use appropriate JOINs and indexing
- **Batch Size Limits**: Reuse existing EntityBulkDelete constraints (max 100 items)
- **Connection Management**: Follow existing async connection patterns

### User Experience
- **Loading States**: Show loading indicators during operations
- **Error Handling**: Clear error messages for network/server failures
- **Progress Feedback**: Counter showing selected items and operation results

## Success Metrics
- User can access Check-up page from navigation
- Low-usage entities are correctly identified and displayed with context
- Individual deletion works with proper confirmation
- Bulk selection and deletion works efficiently
- No data integrity issues after deletions
- Unit tests pass with good coverage