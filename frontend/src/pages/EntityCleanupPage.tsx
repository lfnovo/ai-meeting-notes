import { useState, useMemo } from 'react';
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
  Users,
  Building,
  FolderOpen,
  MoreHorizontal,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Sparkles
} from 'lucide-react';
import type { Entity, BulkDeleteResponse } from '@/types';

export default function EntityCleanupPage() {
  const queryClient = useQueryClient();
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [deleteResult, setDeleteResult] = useState<BulkDeleteResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: entities, isLoading } = useQuery({
    queryKey: ['entities-cleanup'],
    queryFn: () => entityApi.getForCleanup(),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => entityApi.bulkDelete(ids),
    onSuccess: (response: any) => {
      queryClient.invalidateQueries({ queryKey: ['entities-cleanup'] });
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      setSelectedEntityIds(new Set());
      setIsConfirmModalOpen(false);
      setDeleteResult(response.data);
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

  const handleBulkDelete = () => {
    if (selectedEntityIds.size === 0) return;
    setIsConfirmModalOpen(true);
  };

  const confirmBulkDelete = () => {
    const idsArray = Array.from(selectedEntityIds);
    const numericIds = idsArray.map(id => Number(id)).filter(id => !isNaN(id));
    bulkDeleteMutation.mutate(numericIds);
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
    if (selectedEntityIds.size === entitiesList.length) {
      setSelectedEntityIds(new Set());
    } else {
      setSelectedEntityIds(new Set(entitiesList.map(e => e.id)));
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

  const entitiesList = entities?.data || [];

  const selectedEntitiesNames = useMemo(() => {
    return Array.from(selectedEntityIds)
      .map(id => entitiesList.find(e => e.id === id)?.name)
      .filter(Boolean);
  }, [selectedEntityIds, entitiesList]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Entity Cleanup</h1>
            <p className="text-muted-foreground mt-1">
              Remove entities with low engagement (≤1 meetings)
            </p>
          </div>
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
            Remove entities with low engagement (≤1 meetings) to keep your data clean
          </p>
        </div>
        {selectedEntityIds.size > 0 && (
          <Button
            variant="destructive"
            onClick={handleBulkDelete}
            disabled={bulkDeleteMutation.isPending}
            className="whitespace-nowrap"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete {selectedEntityIds.size} {selectedEntityIds.size === 1 ? 'Entity' : 'Entities'}
          </Button>
        )}
      </div>

      {/* Entity Count and Selection Controls */}
      {entitiesList.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="text-sm text-muted-foreground">
            Found {entitiesList.length} {entitiesList.length === 1 ? 'entity' : 'entities'} with low engagement
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Checkbox
              checked={selectedEntityIds.size === entitiesList.length && entitiesList.length > 0}
              onCheckedChange={toggleSelectAll}
            />
            <Label className="text-sm text-muted-foreground whitespace-nowrap">
              Select all ({entitiesList.length})
            </Label>
          </div>
        </div>
      )}

      {/* Success/Error Messages */}
      {deleteResult && (
        <Alert variant={deleteResult.failed_ids.length > 0 ? "destructive" : "default"}>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="space-y-2">
              <p className="font-medium">{deleteResult.message}</p>
              {deleteResult.deleted_count > 0 && (
                <p className="text-sm">
                  Successfully deleted {deleteResult.deleted_count} {deleteResult.deleted_count === 1 ? 'entity' : 'entities'}
                </p>
              )}
              {deleteResult.failed_ids.length > 0 && (
                <div className="text-sm">
                  <p className="font-medium text-destructive">Failed to delete {deleteResult.failed_ids.length} entities:</p>
                  <ul className="list-disc list-inside mt-1">
                    {deleteResult.errors.map((error, index) => (
                      <li key={index} className="text-destructive">{error}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}

      {error && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Empty State - All Clean */}
      {entitiesList.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Sparkles className="w-12 h-12 text-green-500 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Clean!</h3>
            <p className="text-muted-foreground text-center">
              No entities with low engagement found. Your data is well-organized and all entities are actively used in meetings.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Entity Grid */}
      {entitiesList.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {entitiesList.map((entity) => {
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
                    <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                      {entity.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Created {formatDateTime(entity.created_at)}</span>
                    <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">
                      Low Usage
                    </Badge>
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
                <AlertTriangle className="w-5 h-5 text-destructive" />
                Confirm Deletion
              </CardTitle>
              <CardDescription>
                Are you sure you want to delete {selectedEntityIds.size} {selectedEntityIds.size === 1 ? 'entity' : 'entities'}? This action cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="max-h-32 overflow-y-auto">
                  <p className="text-sm font-medium mb-2">Entities to be deleted:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    {selectedEntitiesNames.slice(0, 5).map((name, index) => (
                      <li key={index} className="flex items-center gap-2">
                        <span className="w-1 h-1 bg-muted-foreground rounded-full"></span>
                        {name}
                      </li>
                    ))}
                    {selectedEntitiesNames.length > 5 && (
                      <li className="text-xs italic">
                        ...and {selectedEntitiesNames.length - 5} more
                      </li>
                    )}
                  </ul>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button
                    variant="destructive"
                    onClick={confirmBulkDelete}
                    disabled={bulkDeleteMutation.isPending}
                    className="flex-1"
                  >
                    {bulkDeleteMutation.isPending ? 'Deleting...' : 'Delete'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setIsConfirmModalOpen(false)}
                    disabled={bulkDeleteMutation.isPending}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}