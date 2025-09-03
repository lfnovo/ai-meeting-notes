# Type Safety Implementation

## Overview

The AI Meeting Notes application maintains end-to-end type safety from the database through the API to the frontend UI. This comprehensive type system prevents runtime errors, improves developer experience, and ensures data consistency across the entire stack.

## Backend Type Safety with Pydantic

### Core Data Models

**Pydantic Model Definitions**:
```python
from datetime import datetime
from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field

class EntityTypeModel(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=50)
    slug: str = Field(..., min_length=1, max_length=50)
    color_class: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None
    is_system: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True  # Enable ORM mode for SQLite row objects
```

**Enum Types for Constrained Values**:
```python
class ActionItemStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress" 
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class ActionItem(BaseModel):
    id: Optional[int] = None
    meeting_id: int
    description: str = Field(..., min_length=1)
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    status: ActionItemStatus = ActionItemStatus.PENDING  # Type-safe enum
    created_at: Optional[datetime] = None
```

### Request/Response Model Patterns

**Separate Models for Different Operations**:
```python
# Base entity model
class Entity(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    type_slug: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    created_at: Optional[datetime] = None

# Creation request model (no ID, required fields only)
class EntityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type_slug: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None

# Update request model (all optional except validation)
class EntityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type_slug: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None

# Enhanced response model with joined data
class EntityWithType(Entity):
    type_name: Optional[str] = None
    type_color_class: Optional[str] = None
```

### Validation Features

**Field Validation with Pydantic**:
```python
from pydantic import validator, root_validator

class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    date: datetime
    transcript: Optional[str] = None
    entity_ids: Optional[List[int]] = Field(default_factory=list)
    meeting_type_slug: Optional[str] = Field(default='general', max_length=50)
    
    @validator('date')
    def validate_date_not_future(cls, v):
        if v > datetime.now():
            raise ValueError('Meeting date cannot be in the future')
        return v
    
    @validator('entity_ids')
    def validate_entity_ids_not_empty(cls, v):
        if v is not None and len(v) > 100:
            raise ValueError('Cannot associate more than 100 entities')
        return v
    
    @root_validator
    def validate_content_provided(cls, values):
        transcript = values.get('transcript')
        if not transcript or len(transcript.strip()) == 0:
            raise ValueError('Transcript cannot be empty')
        return values
```

### FastAPI Integration

**Type-Safe API Endpoints**:
```python
from fastapi import APIRouter, HTTPException, Depends
from typing import List

@router.post("/entities", response_model=EntityWithType)
async def create_entity(
    entity: EntityCreate,  # Input validation
    db: DatabaseManager = Depends(get_db)
) -> EntityWithType:  # Output type specification
    try:
        return await db.create_entity(entity)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/entities", response_model=List[EntityWithType])
async def list_entities(
    limit: int = Query(100, ge=1, le=500),  # Query parameter validation
    offset: int = Query(0, ge=0),
    db: DatabaseManager = Depends(get_db)
) -> List[EntityWithType]:
    return await db.get_entities(limit=limit, offset=offset)
```

**Automatic OpenAPI Schema Generation**:
```python
# FastAPI automatically generates OpenAPI schema from Pydantic models
# This provides:
# - API documentation with request/response examples
# - Client code generation
# - Runtime validation
# - IDE autocompletion
```

## Frontend Type Safety with TypeScript

### Mirror Backend Models

**TypeScript Interface Definitions**:
```typescript
// Mirror Pydantic models exactly
export interface EntityType {
  id: number;
  name: string;
  slug: string;
  color_class: string;
  description?: string;
  is_system: boolean;
  created_at: string; // ISO string representation of datetime
}

export interface Entity {
  id: number;
  name: string;
  type_slug: string;
  description?: string;
  created_at: string;
  // Extended fields from EntityWithType
  type_name?: string;
  type_color_class?: string;
}

// Enum matching backend
export type ActionItemStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface ActionItem {
  id: number;
  meeting_id: number;
  description: string;
  assignee?: string;
  due_date?: string; // ISO date string
  status: ActionItemStatus;
  created_at: string;
}
```

### Request/Response Types

**API Contract Types**:
```typescript
// Create request types (matching Pydantic models)
export interface EntityCreate {
  name: string;
  type_slug: string;
  description?: string;
}

export interface EntityUpdate {
  name?: string;
  type_slug?: string;
  description?: string;
}

// Bulk operation types
export interface EntityBulkDelete {
  ids: number[];
}

export interface EntityBulkUpdateType {
  ids: number[];
  type_slug: string;
}

// Complex response types with relationships
export interface MeetingWithEntities extends Meeting {
  entities: Entity[];
  action_items: ActionItem[];
}

export interface EntityWithMeetings extends Entity {
  meetings: Meeting[];
}
```

### API Client Type Safety

**Typed Axios Client**:
```typescript
import axios, { AxiosResponse } from 'axios';

// Generic API response wrapper
type ApiResponse<T> = Promise<AxiosResponse<T>>;

// Typed API client
const api = axios.create({
  baseURL: '/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Entity API with full type safety
export const entityApi = {
  // GET /entities -> Entity[]
  getAll: (limit = 100, offset = 0): ApiResponse<Entity[]> =>
    api.get(`/entities?limit=${limit}&offset=${offset}`),
  
  // GET /entities/:id -> Entity
  getById: (id: number): ApiResponse<Entity> =>
    api.get(`/entities/${id}`),
  
  // POST /entities -> Entity (created)
  create: (data: EntityCreate): ApiResponse<Entity> =>
    api.post('/entities', data),
  
  // PUT /entities/:id -> Entity (updated)
  update: (id: number, data: EntityUpdate): ApiResponse<Entity> =>
    api.put(`/entities/${id}`, data),
  
  // DELETE /entities/:id -> void
  delete: (id: number): ApiResponse<void> =>
    api.delete(`/entities/${id}`),
  
  // POST /entities/bulk-delete -> { deleted: number }
  bulkDelete: (data: EntityBulkDelete): ApiResponse<{ deleted: number }> =>
    api.post('/entities/bulk-delete', data),
};
```

### Form Validation with Zod

**Runtime Type Validation**:
```typescript
import { z } from 'zod';

// Zod schema matching Pydantic validation
export const entityCreateSchema = z.object({
  name: z.string()
    .min(1, 'Name is required')
    .max(255, 'Name must be less than 255 characters'),
  type_slug: z.string()
    .min(1, 'Type is required')
    .max(50, 'Type slug must be less than 50 characters'),
  description: z.string().optional(),
});

export const meetingCreateSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(255, 'Title must be less than 255 characters'),
  date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  transcript: z.string().optional(),
  entity_ids: z.array(z.number()).default([]),
  meeting_type_slug: z.string().default('general'),
}).refine(
  (data) => data.transcript && data.transcript.trim().length > 0,
  { message: 'Transcript cannot be empty', path: ['transcript'] }
);

// Infer TypeScript types from Zod schemas
export type EntityCreateForm = z.infer<typeof entityCreateSchema>;
export type MeetingCreateForm = z.infer<typeof meetingCreateSchema>;
```

### React Hook Form Integration

**Type-Safe Form Handling**:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

export function EntityCreateForm({ onSubmit }: { onSubmit: (data: EntityCreate) => void }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<EntityCreateForm>({
    resolver: zodResolver(entityCreateSchema),
    defaultValues: {
      name: '',
      type_slug: '',
      description: '',
    },
  });

  // TypeScript ensures onSubmit receives correct type
  const handleFormSubmit = (data: EntityCreateForm) => {
    onSubmit(data); // data is guaranteed to match EntityCreate interface
  };

  return (
    <form onSubmit={handleSubmit(handleFormSubmit)}>
      <Input
        {...register('name')}
        error={errors.name?.message}
        placeholder="Entity name"
      />
      
      <Select
        {...register('type_slug')}
        error={errors.type_slug?.message}
      >
        <option value="">Select type...</option>
        <option value="person">Person</option>
        <option value="company">Company</option>
        <option value="project">Project</option>
      </Select>
      
      <Button type="submit" disabled={!isValid}>
        Create Entity
      </Button>
    </form>
  );
}
```

## Component Type Safety

### Generic Components

**Reusable Typed Components**:
```typescript
interface DataTableProps<T> {
  data: T[];
  columns: Array<{
    key: keyof T;
    label: string;
    render?: (value: T[keyof T], item: T) => React.ReactNode;
  }>;
  onRowClick?: (item: T) => void;
  loading?: boolean;
}

export function DataTable<T extends { id: number }>({ 
  data, 
  columns, 
  onRowClick,
  loading 
}: DataTableProps<T>) {
  if (loading) {
    return <TableSkeleton />;
  }

  return (
    <table className="w-full">
      <thead>
        <tr>
          {columns.map(column => (
            <th key={String(column.key)}>{column.label}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {data.map(item => (
          <tr 
            key={item.id}
            onClick={() => onRowClick?.(item)}
            className="cursor-pointer hover:bg-gray-50"
          >
            {columns.map(column => (
              <td key={String(column.key)}>
                {column.render 
                  ? column.render(item[column.key], item)
                  : String(item[column.key])
                }
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// Usage with full type safety
function EntityList() {
  const { data: entities, isLoading } = useEntities();

  return (
    <DataTable
      data={entities || []}
      loading={isLoading}
      columns={[
        { key: 'name', label: 'Name' },
        { key: 'type_name', label: 'Type' },
        { 
          key: 'created_at', 
          label: 'Created',
          render: (date) => new Date(date as string).toLocaleDateString()
        },
      ]}
      onRowClick={(entity) => {
        // entity is fully typed as Entity
        navigate(`/entities/${entity.id}`);
      }}
    />
  );
}
```

### Prop Validation with TypeScript

**Strict Component Props**:
```typescript
interface EntityBadgeProps {
  entity: Entity;
  size?: 'sm' | 'md' | 'lg';
  onClick?: (entity: Entity) => void;
  className?: string;
}

export function EntityBadge({ 
  entity, 
  size = 'md', 
  onClick, 
  className 
}: EntityBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md px-2 py-1 text-xs font-medium border',
        entity.type_color_class, // TypeScript ensures this property exists
        {
          'text-xs px-1.5 py-0.5': size === 'sm',
          'text-sm px-3 py-1.5': size === 'lg',
        },
        className
      )}
      onClick={() => onClick?.(entity)}
    >
      {entity.name}
    </span>
  );
}

// Usage with compile-time type checking
function MeetingDetail({ meeting }: { meeting: MeetingWithEntities }) {
  return (
    <div>
      <h1>{meeting.title}</h1>
      <div className="flex flex-wrap gap-2">
        {meeting.entities.map(entity => (
          <EntityBadge
            key={entity.id}
            entity={entity} // TypeScript ensures compatibility
            onClick={(clickedEntity) => {
              // clickedEntity is fully typed
              console.log(`Clicked entity: ${clickedEntity.name}`);
            }}
          />
        ))}
      </div>
    </div>
  );
}
```

## State Management Type Safety

### TanStack Query with TypeScript

**Typed Query Hooks**:
```typescript
// Custom hooks with return type inference
export function useEntities(limit = 100, offset = 0) {
  return useQuery({
    queryKey: ['entities', limit, offset],
    queryFn: async (): Promise<Entity[]> => {
      const response = await entityApi.getAll(limit, offset);
      return response.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useEntityDetail(id: number) {
  return useQuery({
    queryKey: ['entities', 'detail', id],
    queryFn: async (): Promise<Entity> => {
      const response = await entityApi.getById(id);
      return response.data;
    },
    enabled: !!id, // Only run query if id is truthy
  });
}

// Typed mutation hooks
export function useCreateEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async (data: EntityCreate): Promise<Entity> => {
      const response = await entityApi.create(data);
      return response.data;
    },
    onSuccess: (newEntity: Entity) => {
      // TypeScript infers newEntity type
      queryClient.setQueryData(
        ['entities', 'detail', newEntity.id],
        newEntity
      );
      
      queryClient.invalidateQueries({ queryKey: ['entities'] });
    },
  });
}
```

### Context API Type Safety

**Typed Context Providers**:
```typescript
interface AppContextValue {
  user: User | null;
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  entityTypes: EntityType[];
  meetingTypes: MeetingType[];
}

const AppContext = React.createContext<AppContextValue | undefined>(undefined);

export function useAppContext(): AppContextValue {
  const context = React.useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const { data: entityTypes = [] } = useEntityTypes();
  const { data: meetingTypes = [] } = useMeetingTypes();
  
  const toggleTheme = useCallback(() => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  }, []);
  
  const value: AppContextValue = {
    user: null, // TODO: Implement authentication
    theme,
    toggleTheme,
    entityTypes,
    meetingTypes,
  };
  
  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
```

## Error Handling Type Safety

### Typed Error Responses

**API Error Types**:
```typescript
interface ApiError {
  message: string;
  code: string;
  details?: Record<string, any>;
}

interface ValidationError extends ApiError {
  field_errors: Record<string, string[]>;
}

// Type guards for error handling
function isValidationError(error: unknown): error is ValidationError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'field_errors' in error
  );
}

// Typed error handling in components
export function EntityForm() {
  const createMutation = useCreateEntity();
  
  const handleSubmit = (data: EntityCreate) => {
    createMutation.mutate(data, {
      onError: (error) => {
        if (isValidationError(error)) {
          // TypeScript knows error has field_errors property
          Object.entries(error.field_errors).forEach(([field, messages]) => {
            setError(field as keyof EntityCreate, {
              message: messages.join(', ')
            });
          });
        } else {
          // Handle general errors
          toast.error(error.message || 'An error occurred');
        }
      },
    });
  };
}
```

### Result Types for Error Handling

**Union Types for Results**:
```typescript
type Result<T, E = Error> = 
  | { success: true; data: T }
  | { success: false; error: E };

async function safeApiCall<T>(
  apiCall: () => Promise<T>
): Promise<Result<T, ApiError>> {
  try {
    const data = await apiCall();
    return { success: true, data };
  } catch (error) {
    return { 
      success: false, 
      error: error as ApiError 
    };
  }
}

// Usage with type narrowing
export function useEntityWithErrorHandling(id: number) {
  const [result, setResult] = useState<Result<Entity, ApiError> | null>(null);
  
  useEffect(() => {
    async function fetchEntity() {
      const result = await safeApiCall(() => 
        entityApi.getById(id).then(res => res.data)
      );
      setResult(result);
    }
    
    fetchEntity();
  }, [id]);
  
  if (!result) return { loading: true };
  
  if (result.success) {
    // TypeScript knows result.data is Entity
    return { entity: result.data, loading: false };
  } else {
    // TypeScript knows result.error is ApiError
    return { error: result.error, loading: false };
  }
}
```

## Build-Time Type Checking

### TypeScript Configuration

**Strict TypeScript Config**:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUncheckedIndexedAccess": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### Pre-Commit Type Checking

**GitHub Actions Type Checking**:
```yaml
name: Type Check
on: [push, pull_request]

jobs:
  typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm run type-check
      - run: npm run lint
```

This comprehensive type safety implementation ensures data consistency and prevents runtime errors throughout the entire application stack, from database queries through API responses to UI components, providing excellent developer experience and application reliability.