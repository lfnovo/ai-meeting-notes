import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entityApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Trash2,
  Users,
  Building,
  FolderOpen,
  MoreHorizontal,
} from 'lucide-react';
export default function EntityCleanupPage() {
  const queryClient = useQueryClient();
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set());
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Queries
  const { data: orphanedEntities, isLoading } = useQuery({
    queryKey: ['entities', 'orphaned'],
    queryFn: async () => {
      const response = await entityApi.getOrphaned();
      return response.data;
    },
  });

  // Mutations
  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => entityApi.bulkDelete(ids),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      queryClient.invalidateQueries({ queryKey: ['entities', 'orphaned'] });
      setSelectedEntityIds(new Set());
      setIsConfirmModalOpen(false);
      setError(null);
      setSuccessMessage(`Successfully deleted ${response.data.deleted_count} entities`);
      setTimeout(() => setSuccessMessage(null), 5000);
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

  // Calculate statistics
  const statistics = useMemo(() => {
    if (!orphanedEntities) return { zeroMeetings: 0, oneMeeting: 0, total: 0 };

    const entitiesList = Array.isArray(orphanedEntities) ? orphanedEntities : [];
    const zeroMeetings = entitiesList.filter(e => e.meeting_count === 0).length;
    const oneMeeting = entitiesList.filter(e => e.meeting_count === 1).length;

    return {
      zeroMeetings,
      oneMeeting,
      total: entitiesList.length
    };
  }, [orphanedEntities]);

  // Group entities
  const { entitiesWithZero, entitiesWithOne } = useMemo(() => {
    if (!orphanedEntities) return { entitiesWithZero: [], entitiesWithOne: [] };

    const entitiesList = Array.isArray(orphanedEntities) ? orphanedEntities : [];
    const withZero = entitiesList.filter(e => e.meeting_count === 0);
    const withOne = entitiesList.filter(e => e.meeting_count === 1);

    return {
      entitiesWithZero: withZero,
      entitiesWithOne: withOne
    };
  }, [orphanedEntities]);

  // Selection breakdown for modal
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

  // Handlers
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

  const confirmDelete = () => {
    const idsArray = Array.from(selectedEntityIds);
    bulkDeleteMutation.mutate(idsArray.map(Number));
  };

  // Loading state
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

  // Empty state
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

  // Main render
  return (
    <div className="space-y-6">
      {/* Header */}
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

      {/* Success Message */}
      {successMessage && (
        <Alert className="bg-green-50 border-green-200">
          <AlertDescription className="text-green-800">
            {successMessage}
          </AlertDescription>
        </Alert>
      )}

      {/* Error Message */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Statistics Cards */}
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

      {/* Select All Control */}
      <div className="flex items-center gap-2">
        <Checkbox
          checked={selectedEntityIds.size === (orphanedEntities?.length || 0) &&
                   orphanedEntities && orphanedEntities.length > 0}
          onCheckedChange={toggleSelectAll}
        />
        <span className="text-sm text-muted-foreground">
          Select all ({orphanedEntities?.length || 0} entities)
        </span>
      </div>

      {/* Entity Lists */}
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
              {entitiesWithZero.map((entity) => {
                const IconComponent = getEntityIcon(entity.type_slug);
                return (
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
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {entity.description}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        <span>0 meetings</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
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
              {entitiesWithOne.map((entity) => {
                const IconComponent = getEntityIcon(entity.type_slug);
                return (
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
                        <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                          {entity.description}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground">
                        <span>1 meeting</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Confirmation Modal */}
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
                  onClick={confirmDelete}
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
    </div>
  );
}