# State Management Implementation

## Overview

The frontend uses TanStack Query (formerly React Query) for comprehensive server state management, combined with React's built-in hooks for local UI state. This architecture provides automatic caching, background refetching, optimistic updates, and excellent error handling.

## TanStack Query Architecture

### Core Concepts

**Query Client Configuration**:
```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,        // 5 minutes before data is considered stale
      gcTime: 10 * 60 * 1000,          // 10 minutes before unused data is garbage collected
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error?.response?.status >= 400 && error?.response?.status < 500) {
          return false;
        }
        return failureCount < 3;
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    },
    mutations: {
      retry: 1,
      onError: (error) => {
        toast.error(`Operation failed: ${error.message}`);
      },
    },
  },
});
```

### Query Key Strategy

**Hierarchical Query Keys**:
```typescript
// Query key patterns for consistent cache management
export const queryKeys = {
  // Meetings
  meetings: ['meetings'] as const,
  meetingsList: (limit: number, offset: number) => 
    ['meetings', 'list', { limit, offset }] as const,
  meetingDetail: (id: number) => 
    ['meetings', 'detail', id] as const,
  
  // Entities
  entities: ['entities'] as const,
  entitiesList: (limit: number, offset: number) =>
    ['entities', 'list', { limit, offset }] as const,
  entityDetail: (id: number) =>
    ['entities', 'detail', id] as const,
  entityMeetings: (id: number) =>
    ['entities', 'meetings', id] as const,
    
  // Entity Types
  entityTypes: ['entity-types'] as const,
  
  // Meeting Types  
  meetingTypes: ['meeting-types'] as const,
} as const;
```

**Benefits**:
- **Consistent Invalidation**: Easy to invalidate related queries
- **Partial Matching**: Can invalidate all meetings queries or specific subsets
- **Type Safety**: TypeScript ensures query key consistency

## Data Fetching Patterns

### Custom Query Hooks

**Meeting Data Management**:
```typescript
// Custom hook for meetings list with pagination
export function useMeetings(limit = 50, offset = 0) {
  return useQuery({
    queryKey: queryKeys.meetingsList(limit, offset),
    queryFn: () => meetingApi.getAll(limit, offset).then(res => res.data),
    staleTime: 5 * 60 * 1000,
  });
}

// Meeting detail with related data
export function useMeetingDetail(id: number) {
  return useQuery({
    queryKey: queryKeys.meetingDetail(id),
    queryFn: () => meetingApi.getById(id).then(res => res.data),
    staleTime: 10 * 60 * 1000, // Longer stale time for detailed views
  });
}

// Entity list with type information
export function useEntities(limit = 100, offset = 0) {
  return useQuery({
    queryKey: queryKeys.entitiesList(limit, offset),
    queryFn: () => entityApi.getAll(limit, offset).then(res => res.data),
    staleTime: 15 * 60 * 1000, // Entities change less frequently
  });
}
```

### Infinite Queries for Large Datasets

**Meeting Feed with Infinite Scroll**:
```typescript
export function useInfiniteMeetings(limit = 20) {
  return useInfiniteQuery({
    queryKey: ['meetings', 'infinite', limit],
    queryFn: ({ pageParam = 0 }) =>
      meetingApi.getAll(limit, pageParam).then(res => res.data),
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < limit) return undefined;
      return allPages.length * limit;
    },
    initialPageParam: 0,
    staleTime: 5 * 60 * 1000,
  });
}

// Usage in component
function MeetingFeed() {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteMeetings();

  const meetings = data?.pages.flat() ?? [];

  return (
    <div>
      {meetings.map(meeting => (
        <MeetingCard key={meeting.id} meeting={meeting} />
      ))}
      
      {hasNextPage && (
        <Button 
          onClick={() => fetchNextPage()}
          disabled={isFetchingNextPage}
        >
          {isFetchingNextPage ? 'Loading...' : 'Load More'}
        </Button>
      )}
    </div>
  );
}
```

## Mutation Patterns

### Basic Mutations with Cache Updates

**Create Meeting with Optimistic Updates**:
```typescript
export function useCreateMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: (data: MeetingProcessRequest) => 
      meetingApi.process(data).then(res => res.data),
    onMutate: async (newMeetingData) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.meetings });
      
      // Snapshot the previous value
      const previousMeetings = queryClient.getQueryData(queryKeys.meetings);
      
      // Optimistically add the new meeting
      const optimisticMeeting = {
        id: Date.now(), // Temporary ID
        title: newMeetingData.title,
        date: newMeetingData.date,
        summary: 'Processing...',
        entities: [],
        action_items: [],
        created_at: new Date().toISOString(),
      };
      
      queryClient.setQueryData(queryKeys.meetings, (old: Meeting[]) => 
        [optimisticMeeting, ...(old || [])]
      );
      
      return { previousMeetings };
    },
    onError: (err, newMeeting, context) => {
      // Rollback on error
      queryClient.setQueryData(queryKeys.meetings, context?.previousMeetings);
    },
    onSuccess: (newMeeting) => {
      // Replace optimistic data with real data
      queryClient.setQueryData(queryKeys.meetings, (old: Meeting[]) => 
        old ? [newMeeting, ...old.slice(1)] : [newMeeting]
      );
      
      // Invalidate and refetch related queries
      queryClient.invalidateQueries({ queryKey: queryKeys.entities });
    },
    onSettled: () => {
      // Always refetch after success or error
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
    },
  });
}
```

### Complex Mutations with Multiple Cache Updates

**Delete Entity with Relationship Cleanup**:
```typescript
export function useDeleteEntity() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: entityApi.delete,
    onMutate: async (entityId) => {
      // Cancel related queries
      await queryClient.cancelQueries({ queryKey: queryKeys.entities });
      await queryClient.cancelQueries({ queryKey: queryKeys.meetings });
      
      // Snapshot current data
      const previousEntities = queryClient.getQueryData(queryKeys.entities);
      const previousMeetings = queryClient.getQueriesData({ 
        queryKey: queryKeys.meetings 
      });
      
      // Optimistically remove entity
      queryClient.setQueryData(queryKeys.entities, (old: Entity[]) =>
        old ? old.filter(entity => entity.id !== entityId) : []
      );
      
      // Update meetings that contained this entity
      queryClient.setQueriesData(
        { queryKey: queryKeys.meetings },
        (old: MeetingWithEntities | undefined) => {
          if (!old) return old;
          return {
            ...old,
            entities: old.entities.filter(entity => entity.id !== entityId)
          };
        }
      );
      
      return { previousEntities, previousMeetings };
    },
    onError: (err, entityId, context) => {
      // Restore previous data
      if (context?.previousEntities) {
        queryClient.setQueryData(queryKeys.entities, context.previousEntities);
      }
      
      if (context?.previousMeetings) {
        context.previousMeetings.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: queryKeys.entities });
      queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
    },
  });
}
```

### Bulk Operations

**Bulk Entity Updates**:
```typescript
export function useBulkUpdateEntityType() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ ids, type_slug }: { ids: number[], type_slug: string }) =>
      entityApi.bulkUpdateType(ids, type_slug),
    onMutate: async ({ ids, type_slug }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.entities });
      
      const previousEntities = queryClient.getQueryData(queryKeys.entities);
      
      // Optimistically update entities
      queryClient.setQueryData(queryKeys.entities, (old: Entity[]) => {
        if (!old) return old;
        
        return old.map(entity => {
          if (ids.includes(entity.id)) {
            return {
              ...entity,
              type_slug,
              // Note: type_name and type_color_class would need to be updated
              // with actual type data - this is simplified for example
            };
          }
          return entity;
        });
      });
      
      return { previousEntities };
    },
    onError: (err, variables, context) => {
      queryClient.setQueryData(queryKeys.entities, context?.previousEntities);
    },
    onSuccess: () => {
      toast.success(`Updated ${ids.length} entities successfully`);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.entities });
    },
  });
}
```

## Local State Management

### Form State with React Hook Form

**Meeting Form with Validation**:
```typescript
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const meetingSchema = z.object({
  title: z.string().min(1, 'Title is required').max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format'),
  transcript: z.string().optional(),
  meeting_type_slug: z.string().default('general'),
  entity_ids: z.array(z.number()).default([]),
});

type MeetingFormData = z.infer<typeof meetingSchema>;

export function NewMeetingForm() {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isValid },
  } = useForm<MeetingFormData>({
    resolver: zodResolver(meetingSchema),
    defaultValues: {
      title: '',
      date: new Date().toISOString().split('T')[0],
      transcript: '',
      meeting_type_slug: 'general',
      entity_ids: [],
    },
  });

  const createMutation = useCreateMeeting();
  
  const onSubmit = (data: MeetingFormData) => {
    createMutation.mutate({
      ...data,
      audio_file: audioFile, // From separate file state
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Input
        {...register('title')}
        error={errors.title?.message}
      />
      
      <Input
        type="date"
        {...register('date')}
        error={errors.date?.message}
      />
      
      <EntitySelector
        value={watch('entity_ids')}
        onChange={(ids) => setValue('entity_ids', ids)}
      />
      
      <Button type="submit" disabled={!isValid || createMutation.isPending}>
        {createMutation.isPending ? 'Processing...' : 'Create Meeting'}
      </Button>
    </form>
  );
}
```

### UI State with Custom Hooks

**Multi-Select Entity Management**:
```typescript
export function useEntitySelection(initialIds: number[] = []) {
  const [selectedIds, setSelectedIds] = useState<Set<number>>(
    new Set(initialIds)
  );

  const toggleEntity = useCallback((entityId: number) => {
    setSelectedIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(entityId)) {
        newSet.delete(entityId);
      } else {
        newSet.add(entityId);
      }
      return newSet;
    });
  }, []);

  const selectAll = useCallback((entityIds: number[]) => {
    setSelectedIds(new Set(entityIds));
  }, []);

  const clearAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((entityId: number) => {
    return selectedIds.has(entityId);
  }, [selectedIds]);

  return {
    selectedIds: Array.from(selectedIds),
    toggleEntity,
    selectAll,
    clearAll,
    isSelected,
    selectedCount: selectedIds.size,
  };
}

// Usage in component
function EntityBulkActions() {
  const { data: entities } = useEntities();
  const bulkDelete = useBulkDeleteEntities();
  const {
    selectedIds,
    toggleEntity,
    selectAll,
    clearAll,
    isSelected,
    selectedCount,
  } = useEntitySelection();

  return (
    <div>
      <div className="flex justify-between items-center">
        <span>{selectedCount} selected</span>
        <div className="space-x-2">
          <Button onClick={() => selectAll(entities?.map(e => e.id) || [])}>
            Select All
          </Button>
          <Button onClick={clearAll}>Clear</Button>
          <Button 
            variant="destructive"
            disabled={selectedCount === 0}
            onClick={() => bulkDelete.mutate(selectedIds)}
          >
            Delete Selected
          </Button>
        </div>
      </div>
      
      <div>
        {entities?.map(entity => (
          <EntityCard
            key={entity.id}
            entity={entity}
            selected={isSelected(entity.id)}
            onToggle={() => toggleEntity(entity.id)}
          />
        ))}
      </div>
    </div>
  );
}
```

## Cache Management Strategies

### Selective Cache Invalidation

**Meeting Updates Affecting Multiple Queries**:
```typescript
export function useUpdateMeeting() {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: ({ id, updates }: { id: number, updates: MeetingUpdate }) =>
      meetingApi.update(id, updates),
    onSuccess: (updatedMeeting, { id }) => {
      // Update specific meeting in cache
      queryClient.setQueryData(
        queryKeys.meetingDetail(id),
        updatedMeeting
      );
      
      // Update meeting in lists
      queryClient.setQueriesData(
        { queryKey: queryKeys.meetings },
        (old: Meeting[]) => {
          if (!old) return old;
          return old.map(meeting => 
            meeting.id === id ? { ...meeting, ...updatedMeeting } : meeting
          );
        }
      );
      
      // If entities were changed, update entity-related queries
      if (updatedMeeting.entities) {
        updatedMeeting.entities.forEach(entity => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.entityMeetings(entity.id)
          });
        });
      }
    },
  });
}
```

### Background Refetching

**Stale-While-Revalidate Pattern**:
```typescript
export function useMeetingsWithRefresh() {
  const queryClient = useQueryClient();
  
  // Main query with background refetching
  const query = useQuery({
    queryKey: queryKeys.meetings,
    queryFn: () => meetingApi.getAll().then(res => res.data),
    staleTime: 5 * 60 * 1000,    // 5 minutes
    refetchInterval: 10 * 60 * 1000, // Background refetch every 10 minutes
    refetchIntervalInBackground: true,
  });

  // Manual refresh function
  const refresh = useCallback(() => {
    return queryClient.invalidateQueries({ queryKey: queryKeys.meetings });
  }, [queryClient]);

  return {
    ...query,
    refresh,
  };
}
```

### Cache Persistence

**Persistent Cache with React Query Persist**:
```typescript
import { persistQueryClient } from '@tanstack/react-query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

const localStoragePersister = createSyncStoragePersister({
  storage: window.localStorage,
  key: 'meeting-notes-cache',
  serialize: JSON.stringify,
  deserialize: JSON.parse,
});

// Persist cache to localStorage
persistQueryClient({
  queryClient,
  persister: localStoragePersister,
  maxAge: 24 * 60 * 60 * 1000, // 24 hours
  buster: 'v1', // Increment to clear cache on app updates
});
```

## Error Handling & Loading States

### Global Error Handling

**Query Error Boundaries**:
```typescript
// Error boundary for React Query errors
function QueryErrorBoundary({ children }: { children: React.ReactNode }) {
  return (
    <ErrorBoundary
      FallbackComponent={({ error, resetError }) => (
        <div className="text-center p-6">
          <h2 className="text-lg font-semibold text-red-600">
            Something went wrong
          </h2>
          <p className="text-gray-600 mt-2">{error.message}</p>
          <Button onClick={resetError} className="mt-4">
            Try again
          </Button>
        </div>
      )}
      onError={(error) => {
        console.error('Query error:', error);
        // Optional: Send to error reporting service
      }}
    >
      {children}
    </ErrorBoundary>
  );
}
```

### Loading State Management

**Coordinated Loading States**:
```typescript
export function MeetingDetailPage({ id }: { id: number }) {
  const meetingQuery = useMeetingDetail(id);
  const entitiesQuery = useEntities();
  
  // Coordinated loading state
  const isLoading = meetingQuery.isLoading || entitiesQuery.isLoading;
  const hasError = meetingQuery.error || entitiesQuery.error;
  
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  }
  
  if (hasError) {
    return (
      <ErrorMessage 
        error={meetingQuery.error || entitiesQuery.error}
        onRetry={() => {
          meetingQuery.refetch();
          entitiesQuery.refetch();
        }}
      />
    );
  }
  
  return (
    <MeetingDetail 
      meeting={meetingQuery.data!}
      entities={entitiesQuery.data!}
    />
  );
}
```

This state management architecture provides a robust, performant, and maintainable foundation for handling all client-side data needs, from server state synchronization to complex UI interactions, while maintaining excellent user experience through optimistic updates and intelligent caching strategies.