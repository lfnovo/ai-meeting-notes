import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entityApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { formatDateTime } from '@/lib/utils';
import { 
  Trash2, 
  Users, 
  Building, 
  FolderOpen, 
  MoreHorizontal,
  AlertTriangle,
  CheckSquare
} from 'lucide-react';

export default function CleanupPage() {
  const queryClient = useQueryClient();
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);

  // Fetch low-usage entities
  const { data: entitiesData, isLoading, error: queryError } = useQuery({
    queryKey: ['entities', 'low-usage'],
    queryFn: () => entityApi.getLowUsage(),
  });

  // Bulk delete mutation
  const deleteEntitiesMutation = useMutation({
    mutationFn: (ids: number[]) => entityApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities', 'low-usage'] });
      queryClient.invalidateQueries({ queryKey: ['entities'] }); // Refresh main entities list too
      setSelectedEntityIds(new Set());
      setError(null);
      setIsConfirmModalOpen(false);
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
      setIsConfirmModalOpen(false);
    },
  });

  const entities = entitiesData?.data || [];

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
    if (selectedEntityIds.size === entities.length) {
      setSelectedEntityIds(new Set());
    } else {
      setSelectedEntityIds(new Set(entities.map(e => e.id)));
    }
  };

  const handleBulkDelete = () => {
    if (selectedEntityIds.size === 0) return;
    setError(null);
    setIsConfirmModalOpen(true);
  };

  const confirmBulkDelete = () => {
    const idsArray = Array.from(selectedEntityIds);
    const numericIds = idsArray.map(id => Number(id)).filter(id => !isNaN(id));
    deleteEntitiesMutation.mutate(numericIds);
  };

  // Display current error from query or mutation
  const displayError = error || queryError?.message;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Entity Cleanup</h1>
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold">Entity Cleanup</h1>
          <p className="text-muted-foreground mt-1">
            Remove entities with low engagement (0 or 1 meeting associations)
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {selectedEntityIds.size > 0 && (
            <Button 
              variant="destructive" 
              onClick={handleBulkDelete}
              disabled={deleteEntitiesMutation.isPending}
              className="whitespace-nowrap"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Selected ({selectedEntityIds.size})
            </Button>
          )}
        </div>
      </div>

      {/* Selection Controls */}
      {entities.length > 0 && (
        <div className="flex items-center gap-2">
          <Checkbox
            checked={selectedEntityIds.size === entities.length && entities.length > 0}
            onCheckedChange={toggleSelectAll}
          />
          <Label className="text-sm text-muted-foreground">
            Select all ({entities.length}) entities
          </Label>
        </div>
      )}

      {displayError && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{displayError}</AlertDescription>
        </Alert>
      )}

      {/* Empty state */}
      {entities.length === 0 && !isLoading && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CheckSquare className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All clean!</h3>
            <p className="text-muted-foreground text-center">
              No low-usage entities found. All your entities are actively used in meetings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Entity Cards */}
      {entities.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entities.map((entity) => {
            const IconComponent = getEntityIcon(entity.type_slug);
            return (
              <Card key={entity.id} className={`hover:shadow-md transition-shadow ${
                selectedEntityIds.has(entity.id) ? 'ring-2 ring-primary' : ''
              }`}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Checkbox
                        checked={selectedEntityIds.has(entity.id)}
                        onCheckedChange={() => toggleEntitySelection(entity.id)}
                      />
                      <div className="flex-shrink-0">
                        <IconComponent className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <CardTitle className="text-lg line-clamp-1">
                          {entity.name}
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge 
                            variant="outline" 
                            className={`${entity.type_color_class || 'bg-gray-100 text-gray-800 border-gray-200'}`}
                          >
                            {entity.type_name || entity.type_slug}
                          </Badge>
                          <Badge 
                            variant="secondary"
                            className={entity.meeting_count === 0 ? 'bg-red-100 text-red-800 border-red-200' : ''}
                          >
                            {entity.meeting_count === 0 ? 'Never used' : `Used in ${entity.meeting_count} meeting`}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {entity.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {entity.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created {formatDateTime(entity.created_at)}</span>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Confirmation Modal */}
      {isConfirmModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
                Confirm Deletion
              </CardTitle>
              <CardDescription>
                This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-6">
                Are you sure you want to delete <strong>{selectedEntityIds.size}</strong> {selectedEntityIds.size === 1 ? 'entity' : 'entities'}?
              </p>
              <div className="flex gap-3">
                <Button 
                  variant="destructive" 
                  onClick={confirmBulkDelete}
                  disabled={deleteEntitiesMutation.isPending}
                  className="flex-1"
                >
                  {deleteEntitiesMutation.isPending ? 'Deleting...' : 'Delete'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => setIsConfirmModalOpen(false)}
                  disabled={deleteEntitiesMutation.isPending}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}