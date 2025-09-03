import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { entityTypeApi, meetingTypeApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Plus, 
  Edit,
  Trash2,
  Save,
  X,
  Loader2,
  MessageSquare,
  FileText
} from 'lucide-react';
import type { EntityType, EntityTypeCreate, EntityTypeUpdate, MeetingType, MeetingTypeCreate, MeetingTypeUpdate } from '@/types';

export default function AdminPage() {
  const queryClient = useQueryClient();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingType, setEditingType] = useState<EntityType | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<EntityTypeCreate>({
    name: '',
    slug: '',
    color_class: 'bg-blue-100 text-blue-800 border-blue-200',
    description: '',
  });

  // Meeting Type Management State
  const [isMeetingTypeModalOpen, setIsMeetingTypeModalOpen] = useState(false);
  const [editingMeetingType, setEditingMeetingType] = useState<MeetingType | null>(null);
  const [meetingTypeError, setMeetingTypeError] = useState<string | null>(null);
  const [meetingTypeFormData, setMeetingTypeFormData] = useState<MeetingTypeCreate>({
    name: '',
    slug: '',
    description: '',
    summary_instructions: '',
    entity_instructions: '',
    action_item_instructions: '',
  });

  // Fetch entity types from API
  const { data: entityTypes, isLoading } = useQuery({
    queryKey: ['entity-types'],
    queryFn: () => entityTypeApi.getAll(),
  });

  // Fetch meeting types from API
  const { data: meetingTypes, isLoading: meetingTypesLoading } = useQuery({
    queryKey: ['meeting-types'],
    queryFn: () => meetingTypeApi.getAll(),
  });

  // Create entity type mutation
  const createMutation = useMutation({
    mutationFn: (data: EntityTypeCreate) => entityTypeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-types'] });
      resetForm();
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to create entity type');
    },
  });

  // Update entity type mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EntityTypeUpdate }) =>
      entityTypeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-types'] });
      resetForm();
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to update entity type');
    },
  });

  // Delete entity type mutation
  const deleteMutation = useMutation({
    mutationFn: (id: number) => entityTypeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['entity-types'] });
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to delete entity type');
    },
  });

  // Meeting Type Mutations
  const createMeetingTypeMutation = useMutation({
    mutationFn: (data: MeetingTypeCreate) => meetingTypeApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-types'] });
      resetMeetingTypeForm();
    },
    onError: (error: any) => {
      setMeetingTypeError(error.response?.data?.detail || 'Failed to create meeting type');
    },
  });

  const updateMeetingTypeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: MeetingTypeUpdate }) =>
      meetingTypeApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-types'] });
      resetMeetingTypeForm();
    },
    onError: (error: any) => {
      setMeetingTypeError(error.response?.data?.detail || 'Failed to update meeting type');
    },
  });

  const deleteMeetingTypeMutation = useMutation({
    mutationFn: (id: number) => meetingTypeApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-types'] });
    },
    onError: (error: any) => {
      setMeetingTypeError(error.response?.data?.detail || 'Failed to delete meeting type');
    },
  });

  const colorOptions = [
    'bg-blue-100 text-blue-800 border-blue-200',
    'bg-green-100 text-green-800 border-green-200',
    'bg-purple-100 text-purple-800 border-purple-200',
    'bg-red-100 text-red-800 border-red-200',
    'bg-yellow-100 text-yellow-800 border-yellow-200',
    'bg-orange-100 text-orange-800 border-orange-200',
    'bg-pink-100 text-pink-800 border-pink-200',
    'bg-gray-100 text-gray-800 border-gray-200',
  ];

  const resetForm = () => {
    setFormData({ 
      name: '', 
      slug: '',
      color_class: 'bg-blue-100 text-blue-800 border-blue-200', 
      description: '' 
    });
    setIsCreateModalOpen(false);
    setEditingType(null);
    setError(null);
  };

  // Meeting Type Helper Functions
  const resetMeetingTypeForm = () => {
    setMeetingTypeFormData({
      name: '',
      slug: '',
      description: '',
      summary_instructions: '',
      entity_instructions: '',
      action_item_instructions: '',
    });
    setIsMeetingTypeModalOpen(false);
    setEditingMeetingType(null);
    setMeetingTypeError(null);
  };

  const generateSlug = (name: string) => {
    return name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    
    if (!formData.name.trim()) {
      setError('Entity type name is required');
      return;
    }

    if (editingType) {
      // Update existing type
      const updateData: EntityTypeUpdate = {
        name: formData.name,
        color_class: formData.color_class,
        description: formData.description || undefined,
      };
      updateMutation.mutate({ id: editingType.id, data: updateData });
    } else {
      // Create new type
      const slug = formData.slug || generateSlug(formData.name);
      const createData: EntityTypeCreate = {
        ...formData,
        slug,
      };
      createMutation.mutate(createData);
    }
  };

  const startEdit = (type: EntityType) => {
    setEditingType(type);
    setFormData({
      name: type.name,
      slug: type.slug,
      color_class: type.color_class,
      description: type.description || '',
    });
    setIsCreateModalOpen(true);
  };

  const handleDelete = (type: EntityType) => {
    if (type.is_system) {
      setError('Cannot delete system entity types');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete the "${type.name}" entity type?`)) {
      deleteMutation.mutate(type.id);
    }
  };

  // Meeting Type Event Handlers
  const handleMeetingTypeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setMeetingTypeError(null);
    
    if (!meetingTypeFormData.name.trim()) {
      setMeetingTypeError('Meeting type name is required');
      return;
    }

    if (editingMeetingType) {
      const updateData: MeetingTypeUpdate = {
        name: meetingTypeFormData.name,
        description: meetingTypeFormData.description || undefined,
        summary_instructions: meetingTypeFormData.summary_instructions || undefined,
        entity_instructions: meetingTypeFormData.entity_instructions || undefined,
        action_item_instructions: meetingTypeFormData.action_item_instructions || undefined,
      };
      updateMeetingTypeMutation.mutate({ id: editingMeetingType.id, data: updateData });
    } else {
      const slug = meetingTypeFormData.slug || generateSlug(meetingTypeFormData.name);
      const createData: MeetingTypeCreate = {
        ...meetingTypeFormData,
        slug,
      };
      createMeetingTypeMutation.mutate(createData);
    }
  };

  const startEditMeetingType = (type: MeetingType) => {
    setEditingMeetingType(type);
    setMeetingTypeFormData({
      name: type.name,
      slug: type.slug,
      description: type.description || '',
      summary_instructions: type.summary_instructions || '',
      entity_instructions: type.entity_instructions || '',
      action_item_instructions: type.action_item_instructions || '',
    });
    setIsMeetingTypeModalOpen(true);
  };

  const handleDeleteMeetingType = (type: MeetingType) => {
    if (type.is_system) {
      setMeetingTypeError('Cannot delete system meeting types');
      return;
    }
    
    if (window.confirm(`Are you sure you want to delete the "${type.name}" meeting type?`)) {
      deleteMeetingTypeMutation.mutate(type.id);
    }
  };

  const getColorPreview = (colorClass: string) => {
    return colorClass.split(' ')[0]; // Extract just the background color class
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-3">
          <Settings className="w-8 h-8" />
          Administration
        </h1>
        <p className="text-muted-foreground mt-2">
          Manage system settings and configurations
        </p>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Entity Types Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Entity Types</CardTitle>
              <CardDescription>
                Manage the types of entities that can be created and tracked in meetings
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-muted rounded-lg h-24"></div>
                </div>
              ))}
            </div>
          ) : entityTypes?.data?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No entity types found</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {entityTypes?.data?.map((type) => (
                <div
                  key={type.id}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{type.name}</h3>
                        <Badge variant="outline" className={type.color_class}>
                          {type.name}
                        </Badge>
                        {type.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                      {type.description && (
                        <p className="text-sm text-muted-foreground">
                          {type.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Slug: {type.slug}
                      </p>
                    </div>
                    <div className="flex gap-1 ml-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEdit(type)}
                        disabled={updateMutation.isPending}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(type)}
                        disabled={type.is_system || deleteMutation.isPending}
                        className="text-destructive hover:text-destructive disabled:text-muted-foreground"
                      >
                        {deleteMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Meeting Types Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Meeting Types
              </CardTitle>
              <CardDescription>
                Manage meeting types with custom AI processing instructions
              </CardDescription>
            </div>
            <Button onClick={() => setIsMeetingTypeModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Meeting Type
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {meetingTypeError && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{meetingTypeError}</AlertDescription>
            </Alert>
          )}
          
          {meetingTypesLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="animate-pulse">
                  <div className="bg-muted rounded-lg h-32"></div>
                </div>
              ))}
            </div>
          ) : meetingTypes?.data?.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">No meeting types found</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {meetingTypes?.data?.map((type) => (
                <div
                  key={type.id}
                  className="p-4 border rounded-lg"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-medium">{type.name}</h3>
                        <Badge variant="outline">
                          {type.slug}
                        </Badge>
                        {type.is_system && (
                          <Badge variant="secondary" className="text-xs">
                            System
                          </Badge>
                        )}
                      </div>
                      {type.description && (
                        <p className="text-sm text-muted-foreground mb-2">
                          {type.description}
                        </p>
                      )}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {type.summary_instructions && (
                          <Badge variant="outline" className="text-xs">
                            <FileText className="w-3 h-3 mr-1" />
                            Summary
                          </Badge>
                        )}
                        {type.entity_instructions && (
                          <Badge variant="outline" className="text-xs">
                            <MessageSquare className="w-3 h-3 mr-1" />
                            Entities
                          </Badge>
                        )}
                        {type.action_item_instructions && (
                          <Badge variant="outline" className="text-xs">
                            <Settings className="w-3 h-3 mr-1" />
                            Actions
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 ml-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => startEditMeetingType(type)}
                        disabled={updateMeetingTypeMutation.isPending}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteMeetingType(type)}
                        disabled={type.is_system || deleteMeetingTypeMutation.isPending}
                        className="text-destructive hover:text-destructive disabled:text-muted-foreground"
                      >
                        {deleteMeetingTypeMutation.isPending ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Modal */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>
                {editingType ? 'Edit Entity Type' : 'Create New Entity Type'}
              </CardTitle>
              <CardDescription>
                {editingType 
                  ? 'Update the entity type information'
                  : 'Define a new type of entity for your meetings'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Type Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setFormData(prev => ({ 
                        ...prev, 
                        name,
                        slug: editingType ? prev.slug : generateSlug(name)
                      }));
                    }}
                    placeholder="e.g., Department, Tool, Location"
                    required
                  />
                </div>

                {!editingType && (
                  <div className="space-y-2">
                    <Label htmlFor="slug">Slug *</Label>
                    <Input
                      id="slug"
                      value={formData.slug}
                      onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="e.g., department, tool, location"
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      URL-friendly identifier (automatically generated from name)
                    </p>
                  </div>
                )}

                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Input
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Optional description..."
                  />
                </div>

                <div className="space-y-2">
                  <Label>Color Theme</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {colorOptions.map((colorClass) => (
                      <button
                        key={colorClass}
                        type="button"
                        onClick={() => setFormData(prev => ({ ...prev, color_class: colorClass }))}
                        className={`h-10 rounded border-2 transition-all ${
                          formData.color_class === colorClass 
                            ? 'ring-2 ring-primary ring-offset-2' 
                            : 'hover:scale-105'
                        } ${getColorPreview(colorClass)}`}
                      />
                    ))}
                  </div>
                  <div className="mt-2">
                    <Badge variant="outline" className={formData.color_class}>
                      Preview: {formData.name || 'Type Name'}
                    </Badge>
                  </div>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createMutation.isPending || updateMutation.isPending}
                  >
                    {createMutation.isPending || updateMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editingType ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingType ? 'Update' : 'Create'} Type
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetForm}>
                    <X className="w-4 h-4 mr-2" />
                    Cancel
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Meeting Type Create/Edit Modal */}
      {isMeetingTypeModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>
                {editingMeetingType ? 'Edit Meeting Type' : 'Create New Meeting Type'}
              </CardTitle>
              <CardDescription>
                {editingMeetingType 
                  ? 'Update the meeting type and its AI processing instructions'
                  : 'Define a new meeting type with custom AI processing instructions'
                }
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleMeetingTypeSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="meeting-type-name">Name *</Label>
                    <Input
                      id="meeting-type-name"
                      value={meetingTypeFormData.name}
                      onChange={(e) => {
                        const name = e.target.value;
                        setMeetingTypeFormData(prev => ({ 
                          ...prev, 
                          name,
                          slug: editingMeetingType ? prev.slug : generateSlug(name)
                        }));
                      }}
                      placeholder="e.g., Daily Standup, Client Meeting"
                      required
                    />
                  </div>

                  {!editingMeetingType && (
                    <div className="space-y-2">
                      <Label htmlFor="meeting-type-slug">Slug *</Label>
                      <Input
                        id="meeting-type-slug"
                        value={meetingTypeFormData.slug}
                        onChange={(e) => setMeetingTypeFormData(prev => ({ ...prev, slug: e.target.value }))}
                        placeholder="e.g., daily-standup, client-meeting"
                        required
                      />
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="meeting-type-description">Description</Label>
                  <Input
                    id="meeting-type-description"
                    value={meetingTypeFormData.description}
                    onChange={(e) => setMeetingTypeFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Brief description of this meeting type..."
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="summary-instructions">Summary Instructions</Label>
                  <Textarea
                    id="summary-instructions"
                    value={meetingTypeFormData.summary_instructions}
                    onChange={(e) => setMeetingTypeFormData(prev => ({ ...prev, summary_instructions: e.target.value }))}
                    placeholder="Custom instructions for AI to generate summaries for this meeting type..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Instructions for how the AI should summarize this type of meeting
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entity-instructions">Entity Extraction Instructions</Label>
                  <Textarea
                    id="entity-instructions"
                    value={meetingTypeFormData.entity_instructions}
                    onChange={(e) => setMeetingTypeFormData(prev => ({ ...prev, entity_instructions: e.target.value }))}
                    placeholder="Custom instructions for AI to extract entities for this meeting type..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Instructions for what entities the AI should focus on extracting
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="action-item-instructions">Action Item Instructions</Label>
                  <Textarea
                    id="action-item-instructions"
                    value={meetingTypeFormData.action_item_instructions}
                    onChange={(e) => setMeetingTypeFormData(prev => ({ ...prev, action_item_instructions: e.target.value }))}
                    placeholder="Custom instructions for AI to extract action items for this meeting type..."
                    rows={3}
                  />
                  <p className="text-xs text-muted-foreground">
                    Instructions for what action items the AI should look for
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <Button 
                    type="submit" 
                    className="flex-1"
                    disabled={createMeetingTypeMutation.isPending || updateMeetingTypeMutation.isPending}
                  >
                    {createMeetingTypeMutation.isPending || updateMeetingTypeMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {editingMeetingType ? 'Updating...' : 'Creating...'}
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4 mr-2" />
                        {editingMeetingType ? 'Update' : 'Create'} Meeting Type
                      </>
                    )}
                  </Button>
                  <Button type="button" variant="outline" onClick={resetMeetingTypeForm}>
                    <X className="w-4 h-4 mr-2" />
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