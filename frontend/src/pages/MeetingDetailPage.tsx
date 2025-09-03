import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { meetingApi, actionItemApi, entityApi, entityTypeApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { formatDateTime, getEntityTypeColor, getStatusColor } from '@/lib/utils';
import { 
  Calendar, 
  Users, 
  FileText, 
  CheckSquare, 
  ArrowLeft,
  ExternalLink,
  Plus,
  X,
  Loader2
} from 'lucide-react';

export default function MeetingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  
  const [isAddEntityModalOpen, setIsAddEntityModalOpen] = useState(false);
  const [selectedEntityId, setSelectedEntityId] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [isCreatingEntity, setIsCreatingEntity] = useState(false);
  const [newEntityData, setNewEntityData] = useState({
    name: '',
    type_slug: 'person' as const,
    description: '',
  });
  
  const { data: meeting, isLoading, error: meetingError } = useQuery({
    queryKey: ['meeting', id],
    queryFn: () => meetingApi.getById(Number(id)),
    enabled: !!id,
  });

  const { data: actionItems } = useQuery({
    queryKey: ['action-items', id],
    queryFn: () => actionItemApi.getByMeeting(Number(id)),
    enabled: !!id,
  });

  const { data: allEntities } = useQuery({
    queryKey: ['entities'],
    queryFn: () => entityApi.getAll(100, 0),
  });

  const { data: entityTypes } = useQuery({
    queryKey: ['entity-types'],
    queryFn: () => entityTypeApi.getAll(),
  });

  const addEntityMutation = useMutation({
    mutationFn: ({ meetingId, entityId }: { meetingId: number; entityId: number }) =>
      meetingApi.addEntity(meetingId, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
      resetModal();
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to add entity to meeting');
    },
  });

  const removeEntityMutation = useMutation({
    mutationFn: ({ meetingId, entityId }: { meetingId: number; entityId: number }) =>
      meetingApi.removeEntity(meetingId, entityId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting', id] });
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to remove entity from meeting');
    },
  });

  const createEntityMutation = useMutation({
    mutationFn: (data: any) => entityApi.create(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['entities'] });
      // Automatically add the new entity to the meeting
      addEntityMutation.mutate({
        meetingId: Number(id),
        entityId: response.data.id,
      });
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to create entity');
    },
  });

  const handleAddEntity = () => {
    if (!selectedEntityId) {
      setError('Please select an entity to add');
      return;
    }
    
    addEntityMutation.mutate({
      meetingId: Number(id),
      entityId: Number(selectedEntityId),
    });
  };

  const handleCreateEntity = () => {
    if (!newEntityData.name.trim()) {
      setError('Entity name is required');
      return;
    }
    
    createEntityMutation.mutate(newEntityData);
  };

  const resetModal = () => {
    setIsAddEntityModalOpen(false);
    setSelectedEntityId('');
    setIsCreatingEntity(false);
    setNewEntityData({ name: '', type_slug: 'person', description: '' });
    setError(null);
  };

  const handleRemoveEntity = (entityId: number) => {
    if (window.confirm('Are you sure you want to remove this entity from the meeting?')) {
      removeEntityMutation.mutate({
        meetingId: Number(id),
        entityId,
      });
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
          <div className="grid gap-6 md:grid-cols-2">
            <div className="h-64 bg-muted rounded"></div>
            <div className="h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (meetingError || !meeting) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-destructive mb-4">Meeting not found</h1>
        <p className="text-muted-foreground mb-4">
          The meeting you're looking for doesn't exist or has been deleted.
        </p>
        <Button asChild className="w-fit min-w-0">
          <Link to="/meetings">
            <ArrowLeft className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">Back to Meetings</span>
          </Link>
        </Button>
      </div>
    );
  }

  const meetingData = meeting.data;
  const actionItemsData = actionItems?.data || [];
  const allEntitiesList = allEntities?.data || [];
  
  const isEntityAlreadyAdded = (entityId: number) => {
    return meetingData?.entities?.some(meetingEntity => meetingEntity.id === entityId) || false;
  };

  return (
    <div className="space-y-6">
      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Button variant="ghost" asChild className="mb-4 w-fit min-w-0">
            <Link to="/meetings">
              <ArrowLeft className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">Back to Meetings</span>
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">{meetingData.title}</h1>
          <div className="flex items-center gap-4 mt-2 text-muted-foreground">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDateTime(meetingData.date)}
            </span>
            {meetingData.transcript && (
              <span className="flex items-center gap-1">
                <FileText className="w-4 h-4" />
                Transcript available
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Summary */}
          {meetingData.summary && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none">
                  <p className="whitespace-pre-wrap">{meetingData.summary}</p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckSquare className="w-5 h-5" />
                Action Items
                <Badge variant="secondary">{actionItemsData.length}</Badge>
              </CardTitle>
              <CardDescription>
                Tasks and follow-ups identified in this meeting
              </CardDescription>
            </CardHeader>
            <CardContent>
              {actionItemsData.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No action items found for this meeting
                </p>
              ) : (
                <div className="space-y-4">
                  {actionItemsData.map((item) => (
                    <div
                      key={item.id}
                      className="border rounded-lg p-4 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <p className="flex-1">{item.description}</p>
                        <Badge 
                          variant="outline"
                          className={getStatusColor(item.status)}
                        >
                          {item.status.replace('_', ' ')}
                        </Badge>
                      </div>
                      
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {item.assignee && (
                          <span>Assigned to: {item.assignee}</span>
                        )}
                        {item.due_date && (
                          <span>Due: {formatDateTime(item.due_date)}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Transcript */}
          {meetingData.transcript && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Full Transcript
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="max-h-96 overflow-y-auto">
                  <pre className="whitespace-pre-wrap text-sm font-mono bg-muted p-4 rounded">
                    {meetingData.transcript}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Entities */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="w-5 h-5" />
                    Related Entities
                    <Badge variant="secondary">{meetingData.entities?.length || 0}</Badge>
                  </CardTitle>
                  <CardDescription>
                    People, companies, and projects mentioned
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setIsAddEntityModalOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Add
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {!meetingData.entities || meetingData.entities.length === 0 ? (
                <p className="text-muted-foreground text-center py-4">
                  No entities identified
                </p>
              ) : (
                <div className="space-y-3">
                  {meetingData.entities.map((entity) => (
                    <div
                      key={entity.id}
                      className="p-3 border rounded-lg"
                    >
                      <div className="flex items-center justify-between">
                        <Link
                          to={`/entities/${entity.id}`}
                          className="flex-1 min-w-0 hover:text-primary"
                        >
                          <div>
                            <h4 className="font-medium">{entity.name}</h4>
                            {entity.description && (
                              <p className="text-sm text-muted-foreground line-clamp-2">
                                {entity.description}
                              </p>
                            )}
                          </div>
                        </Link>
                        <div className="flex items-center gap-2 ml-3">
                          <Badge 
                            variant="outline"
                            className={entity.type_color_class || 'bg-gray-100 text-gray-800 border-gray-200'}
                          >
                            {entity.type_name || entity.type_slug}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleRemoveEntity(entity.id)}
                            disabled={removeEntityMutation.isPending}
                            className="text-destructive hover:text-destructive"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Link to={`/entities/${entity.id}`}>
                            <ExternalLink className="w-4 h-4 text-muted-foreground hover:text-foreground" />
                          </Link>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Meeting Info */}
          <Card>
            <CardHeader>
              <CardTitle>Meeting Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-sm font-medium">Date</Label>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(meetingData.date)}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Created</Label>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(meetingData.created_at)}
                </p>
              </div>

              {meetingData.audio_file_path && (
                <div>
                  <Label className="text-sm font-medium">Audio File</Label>
                  <p className="text-sm text-muted-foreground">Available</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Add Entity Modal */}
      {isAddEntityModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Entity to Meeting</CardTitle>
              <CardDescription>
                Select an existing entity or create a new one
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-2 mb-4">
                <Button
                  variant={!isCreatingEntity ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsCreatingEntity(false)}
                  className="flex-1"
                >
                  Select Existing
                </Button>
                <Button
                  variant={isCreatingEntity ? "default" : "outline"}
                  size="sm"
                  onClick={() => setIsCreatingEntity(true)}
                  className="flex-1"
                >
                  Create New
                </Button>
              </div>

              {!isCreatingEntity ? (
                /* Select Existing Entity */
                <>
                  <div className="space-y-2">
                    <Label htmlFor="entity-select">Select Entity</Label>
                    <Select
                      id="entity-select"
                      value={selectedEntityId}
                      onChange={(e) => setSelectedEntityId(e.target.value)}
                    >
                      <option value="">Choose an entity...</option>
                      {allEntitiesList.map((entity) => (
                        <option 
                          key={entity.id} 
                          value={entity.id}
                          disabled={isEntityAlreadyAdded(entity.id)}
                        >
                          {entity.name} ({entity.type_name || entity.type_slug})
                          {isEntityAlreadyAdded(entity.id) ? ' - Already added' : ''}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleAddEntity}
                      disabled={!selectedEntityId || addEntityMutation.isPending || isEntityAlreadyAdded(Number(selectedEntityId))}
                      className="flex-1"
                    >
                      {addEntityMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Add Entity
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={resetModal}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                /* Create New Entity */
                <>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="new-entity-name">Entity Name *</Label>
                      <Input
                        id="new-entity-name"
                        value={newEntityData.name}
                        onChange={(e) => setNewEntityData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="e.g., John Doe, Acme Corp"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="new-entity-type">Type *</Label>
                      <Select
                        id="new-entity-type"
                        value={newEntityData.type_slug}
                        onChange={(e) => setNewEntityData(prev => ({ ...prev, type_slug: e.target.value }))}
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
                      <Label htmlFor="new-entity-description">Description</Label>
                      <Textarea
                        id="new-entity-description"
                        value={newEntityData.description}
                        onChange={(e) => setNewEntityData(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional description..."
                        rows={2}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button
                      onClick={handleCreateEntity}
                      disabled={!newEntityData.name.trim() || createEntityMutation.isPending}
                      className="flex-1"
                    >
                      {createEntityMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="w-4 h-4 mr-2" />
                          Create & Add
                        </>
                      )}
                    </Button>
                    <Button variant="outline" onClick={resetModal}>
                      Cancel
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}