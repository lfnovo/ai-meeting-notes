import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { entityApi, entityTypeApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import { formatDateTime, getEntityTypeColor } from '@/lib/utils';
import { 
  Plus, 
  Users, 
  Building, 
  FolderOpen, 
  MoreHorizontal,
  Edit,
  Trash2,
  ExternalLink,
  Filter,
  X
} from 'lucide-react';
import type { Entity, EntityCreate } from '@/types';

export default function EntitiesPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingEntity, setEditingEntity] = useState<Entity | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntityIds, setSelectedEntityIds] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');
  const [isBulkTypeModalOpen, setIsBulkTypeModalOpen] = useState(false);
  const [bulkNewType, setBulkNewType] = useState<string>('person');
  
  const [formData, setFormData] = useState<EntityCreate>({
    name: '',
    type_slug: 'person',
    description: '',
  });

  const { data: entities, isLoading } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entityApi.getAll(100, 0),
  });

  const { data: entityTypes } = useQuery({
    queryKey: ['entity-types'],
    queryFn: () => entityTypeApi.getAll(),
  });

  const createEntityMutation = useMutation({
    mutationFn: (data: EntityCreate) => entityApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      resetForm();
      setError(null);
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to create entity');
    },
  });

  const updateEntityMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<EntityCreate> }) =>
      entityApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      resetForm();
      setError(null);
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to update entity');
    },
  });

  const deleteEntityMutation = useMutation({
    mutationFn: (id: number) => entityApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      setSelectedEntityIds(new Set());
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to delete entity');
    },
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: number[]) => entityApi.bulkDelete(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
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
            errorMessage = data.detail.map(err => err.msg || err).join(', ');
          }
        } else if (data.message) {
          errorMessage = data.message;
        }
      }
      
      setError(errorMessage);
    },
  });

  const bulkUpdateTypeMutation = useMutation({
    mutationFn: ({ ids, type_slug }: { ids: number[]; type_slug: string }) => 
      entityApi.bulkUpdateType(ids, type_slug),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      setSelectedEntityIds(new Set());
      setIsBulkTypeModalOpen(false);
      setError(null);
    },
    onError: (error: any) => {
      let errorMessage = 'Failed to update entity types';
      
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
    },
  });

  const resetForm = () => {
    setFormData({ name: '', type_slug: 'person', description: '' });
    setIsCreateModalOpen(false);
    setEditingEntity(null);
    setError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError('Entity name is required');
      return;
    }

    if (editingEntity) {
      updateEntityMutation.mutate({
        id: editingEntity.id,
        data: formData,
      });
    } else {
      createEntityMutation.mutate(formData);
    }
  };

  const startEdit = (entity: Entity) => {
    setEditingEntity(entity);
    setFormData({
      name: entity.name,
      type_slug: entity.type_slug,
      description: entity.description || '',
    });
    setIsCreateModalOpen(true);
  };

  const handleDelete = (entity: Entity) => {
    if (window.confirm(`Are you sure you want to delete "${entity.name}"?`)) {
      deleteEntityMutation.mutate(entity.id);
    }
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
      // Ensure IDs are numbers
      const numericIds = idsArray.map(id => Number(id)).filter(id => !isNaN(id));
      bulkDeleteMutation.mutate(numericIds);
    }
  };

  const handleBulkTypeChange = () => {
    const selectedCount = selectedEntityIds.size;
    if (selectedCount === 0) return;
    
    // Set initial type to the most common type among selected entities
    const selectedEntities = entitiesList.filter(e => selectedEntityIds.has(e.id));
    const typeCounts = selectedEntities.reduce((acc, entity) => {
      acc[entity.type_slug] = (acc[entity.type_slug] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const mostCommonType = Object.entries(typeCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'person';
    
    setBulkNewType(mostCommonType);
    setIsBulkTypeModalOpen(true);
  };

  const confirmBulkTypeChange = () => {
    const idsArray = Array.from(selectedEntityIds);
    const numericIds = idsArray.map(id => Number(id)).filter(id => !isNaN(id));
    bulkUpdateTypeMutation.mutate({ ids: numericIds, type_slug: bulkNewType });
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
    if (selectedEntityIds.size === filteredEntities.length) {
      setSelectedEntityIds(new Set());
    } else {
      setSelectedEntityIds(new Set(filteredEntities.map(e => e.id)));
    }
  };

  const clearFilter = () => {
    setFilterType('all');
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
  
  const filteredEntities = useMemo(() => {
    if (filterType === 'all') {
      return entitiesList;
    }
    return entitiesList.filter(entity => entity.type_slug === filterType);
  }, [entitiesList, filterType]);
  
  const availableTypes = useMemo(() => {
    const types = new Set(entitiesList.map(entity => entity.type_slug));
    return Array.from(types);
  }, [entitiesList]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Entities</h1>
          <Button disabled>
            <Plus className="w-4 h-4 mr-2" />
            New Entity
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-3xl font-bold">Entities</h1>
          <p className="text-muted-foreground mt-1">
            Manage people, companies, and projects mentioned in meetings
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          {selectedEntityIds.size > 0 && (
            <>
              <Button 
                variant="outline" 
                onClick={handleBulkTypeChange}
                disabled={bulkUpdateTypeMutation.isPending}
                className="whitespace-nowrap"
              >
                <Edit className="w-4 h-4 mr-2" />
                Change Type ({selectedEntityIds.size})
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleBulkDelete}
                disabled={bulkDeleteMutation.isPending}
                className="whitespace-nowrap"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete {selectedEntityIds.size}
              </Button>
            </>
          )}
          <Button onClick={() => setIsCreateModalOpen(true)} className="whitespace-nowrap">
            <Plus className="w-4 h-4 mr-2" />
            New Entity
          </Button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <Label className="text-sm font-medium whitespace-nowrap">Filter by type:</Label>
          <Select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value)}
            className="min-w-[160px]"
          >
            <option value="all">All Types ({entitiesList.length})</option>
            {availableTypes.map(type => {
              const count = entitiesList.filter(e => e.type_slug === type).length;
              const typeDisplay = entityTypes?.data?.find(et => et.slug === type)?.name || type;
              return (
                <option key={type} value={type}>
                  {typeDisplay} ({count})
                </option>
              );
            })}
          </Select>
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

      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {filteredEntities.length === 0 && filterType !== 'all' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Filter className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entities found</h3>
            <p className="text-muted-foreground text-center mb-4">
              No entities match the selected filter. Try selecting a different type or clear the filter.
            </p>
            <Button variant="outline" onClick={clearFilter}>
              Clear Filter
            </Button>
          </CardContent>
        </Card>
      )}

      {entitiesList.length === 0 && filterType === 'all' && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No entities yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create entities to track people, companies, and projects mentioned in your meetings.
            </p>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create your first entity
            </Button>
          </CardContent>
        </Card>
      )}

      {filteredEntities.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredEntities.map((entity) => {
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
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(entity)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(entity)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
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
                    <Link 
                      to={`/entities/${entity.id}`}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      View <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {editingEntity ? 'Edit Entity' : 'Create New Entity'}
              </CardTitle>
              <CardDescription>
                {editingEntity 
                  ? 'Update the entity information'
                  : 'Add a new person, company, or project to track'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g., John Doe, Acme Corp, Project Alpha"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="type">Type *</Label>
                  <Select
                    id="type"
                    value={formData.type_slug}
                    onChange={(e) => setFormData(prev => ({ ...prev, type_slug: e.target.value }))}
                  >
                    {entityTypes?.data?.map((type) => (
                      <option key={type.slug} value={type.slug}>
                        {type.name}
                      </option>
                    )) || (
                      <>
                        <option value="person">Person</option>
                        <option value="company">Company</option>
                        <option value="project">Project</option>
                        <option value="other">Other</option>
                      </>
                    )}
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    disabled={createEntityMutation.isPending || updateEntityMutation.isPending}
                    className="flex-1"
                  >
                    {editingEntity ? 'Update' : 'Create'} Entity
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={resetForm}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Bulk Type Change Modal */}
      {isBulkTypeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Change Entity Type</CardTitle>
              <CardDescription>
                Change the type for {selectedEntityIds.size} selected {selectedEntityIds.size === 1 ? 'entity' : 'entities'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={(e) => { e.preventDefault(); confirmBulkTypeChange(); }} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="bulk-type">New Type</Label>
                  <Select
                    id="bulk-type"
                    value={bulkNewType}
                    onChange={(e) => setBulkNewType(e.target.value)}
                    className="w-full"
                  >
                    {entityTypes?.data?.map((type) => (
                      <option key={type.slug} value={type.slug}>
                        {type.name}
                      </option>
                    )) || (
                      <>
                        <option value="person">Person</option>
                        <option value="company">Company</option>
                        <option value="project">Project</option>
                        <option value="other">Other</option>
                      </>
                    )}
                  </Select>
                </div>

                <div className="text-sm text-muted-foreground">
                  <p>This will change the type for all selected entities to "{entityTypes?.data?.find(t => t.slug === bulkNewType)?.name || bulkNewType}".</p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    disabled={bulkUpdateTypeMutation.isPending}
                    className="flex-1"
                  >
                    {bulkUpdateTypeMutation.isPending ? 'Updating...' : 'Change Type'}
                  </Button>
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setIsBulkTypeModalOpen(false)}
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}