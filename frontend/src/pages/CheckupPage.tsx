import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entityApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Stethoscope, 
  Trash2, 
  Filter, 
  X, 
  Users,
  AlertTriangle
} from 'lucide-react';

export default function CheckupPage() {
  const queryClient = useQueryClient();
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [error, setError] = useState<string | null>(null);

  const { data: entities, isLoading } = useQuery({
    queryKey: ['entities', 'low-usage'],
    queryFn: () => entityApi.getLowUsage(),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => entityApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', 'low-usage'] });
      setSelectedEntityIds(new Set());
      setError(null);
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
            errorMessage = data.detail.map((err: any) => err.msg || err).join(', ');
          }
        } else if (data.message) {
          errorMessage = data.message;
        }
      }
      
      setError(errorMessage);
    },
  });

  const entitiesList = entities?.data || [];

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
    if (selectedEntityIds.size === filteredEntities.length && filteredEntities.length > 0) {
      setSelectedEntityIds(new Set());
    } else {
      setSelectedEntityIds(new Set(filteredEntities.map(e => e.id).filter(id => id !== undefined) as number[]));
    }
  };

  const clearFilter = () => {
    setFilterType('all');
  };

  const handleBulkDelete = () => {
    const selectedCount = selectedEntityIds.size;
    if (selectedCount === 0) return;
    
    const entityNames = Array.from(selectedEntityIds)
      .map(id => entitiesList.find(e => e.id === id)?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join(', ');
    
    const message = selectedCount <= 3 
      ? `Are you sure you want to delete: ${entityNames}?`
      : `Are you sure you want to delete ${selectedCount} entities (${entityNames} and ${selectedCount - 3} more)?`;
    
    if (window.confirm(message)) {
      const idsArray = Array.from(selectedEntityIds);
      const numericIds = idsArray.map(id => Number(id)).filter(id => !isNaN(id));
      
      if (numericIds.length === 0) {
        setError('No valid entities selected for deletion');
        return;
      }
      
      bulkDeleteMutation.mutate(numericIds);
    }
  };

  const getEntityIcon = (typeSlug: string) => {
    switch (typeSlug) {
      case 'person':
        return Users;
      default:
        return Users;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Entity Check-up</h1>
          <Button disabled>
            <Trash2 className="w-4 h-4 mr-2" />
            Clean Up Selected
          </Button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-muted rounded-lg h-32"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // All entities from the API are already low usage entities
  const filteredEntities = filterType === 'all' 
    ? entitiesList
    : entitiesList.filter(entity => entity.type_slug === filterType);

  const availableTypes = [...new Set(entitiesList.map(entity => entity.type_slug))];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <Stethoscope className="w-8 h-8" />
            Entity Check-up
          </h1>
          <p className="text-muted-foreground mt-1">
            Review and clean up entities with low usage or that haven't been mentioned in recent meetings
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {selectedEntityIds.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={bulkDeleteMutation.isPending}
              className="whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete {selectedEntityIds.size}
            </Button>
          )}
        </div>
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertTriangle className="w-4 h-4" />
        <AlertDescription>
          This page shows entities that have been mentioned in 1 or fewer meetings. 
          Consider cleaning up unused entities to keep your database organized.
        </AlertDescription>
      </Alert>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Label className="text-sm font-medium whitespace-nowrap">Filter by type:</Label>
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="min-w-[160px] px-3 py-1 border rounded-md text-sm"
          >
            <option value="all">All Types ({entitiesList.length})</option>
            {availableTypes.map(type => {
              const count = entitiesList.filter(e => e.type_slug === type).length;
              return (
                <option key={type} value={type}>
                  {type} ({count})
                </option>
              );
            })}
          </select>
          {filterType !== 'all' && (
            <Button variant="ghost" size="sm" onClick={clearFilter} className="flex-shrink-0">
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        {filteredEntities.length > 0 && (
          <div className="flex items-center gap-2 flex-shrink-0">
            <Checkbox
              checked={selectedEntityIds.size === filteredEntities.length && filteredEntities.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <Label className="text-sm text-muted-foreground whitespace-nowrap">
              Select all ({filteredEntities.length})
            </Label>
          </div>
        )}
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Empty States */}
      {entitiesList.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Stethoscope className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All entities look healthy!</h3>
            <p className="text-muted-foreground text-center mb-4">
              All your entities have been mentioned in multiple meetings. No cleanup needed.
            </p>
          </CardContent>
        </Card>
      )}

      {filteredEntities.length === 0 && entitiesList.length > 0 && filterType !== 'all' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entities found</h3>
            <p className="text-muted-foreground text-center mb-4">
              No entities of this type need cleanup. Try selecting a different type or clear the filter.
            </p>
            <Button variant="outline" onClick={clearFilter}>
              Clear Filter
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Entity Cards */}
      {filteredEntities.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((entity) => {
            const IconComponent = getEntityIcon(entity.type_slug);
            
            return (
              <Card key={entity.id} className={`hover:shadow-md transition-shadow ${
                selectedEntityIds.has(entity.id!) ? 'ring-2 ring-primary' : ''
              } border-yellow-200`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedEntityIds.has(entity.id!)}
                        onCheckedChange={() => toggleEntitySelection(entity.id!)}
                      />
                      <div className="flex-shrink-0">
                        <IconComponent className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg line-clamp-1">
                          {entity.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="outline" className={entity.color_class}>
                            {entity.type_name}
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            Low Usage
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Found in:</span>
                      <span className="text-xs font-medium text-blue-600">
                        {entity.meeting_title}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Meeting date:</span>
                      <span className="text-xs">
                        {new Date(entity.meeting_date).toLocaleDateString()}
                      </span>
                    </div>
                    {entity.description && (
                      <div className="text-xs text-muted-foreground mt-2 line-clamp-2">
                        {entity.description}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Placeholder for future modals and additional functionality */}
    </div>
  );
}