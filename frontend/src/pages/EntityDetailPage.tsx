import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { entityApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { formatDateTime, formatRelativeTime, getEntityTypeColor } from '@/lib/utils';
import { 
  ArrowLeft,
  Calendar,
  FileText,
  Users,
  Building,
  FolderOpen,
  MoreHorizontal,
  ExternalLink
} from 'lucide-react';

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>();
  
  const { data: entity, isLoading, error } = useQuery({
    queryKey: ['entity', id],
    queryFn: () => entityApi.getById(Number(id)),
    enabled: !!id,
  });

  const { data: entityMeetings } = useQuery({
    queryKey: ['entity-meetings', id],
    queryFn: () => entityApi.getMeetings(Number(id)),
    enabled: !!id,
  });

  const getEntityIcon = (type: string) => {
    switch (type) {
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

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-muted rounded w-1/2 mb-8"></div>
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="h-64 bg-muted rounded"></div>
            <div className="lg:col-span-2 h-64 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !entity) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-destructive mb-4">Entity not found</h1>
        <p className="text-muted-foreground mb-4">
          The entity you're looking for doesn't exist or has been deleted.
        </p>
        <Button asChild>
          <Link to="/entities">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Entities
          </Link>
        </Button>
      </div>
    );
  }

  const entityData = entity.data;
  const meetings = entityMeetings?.data || [];
  const IconComponent = getEntityIcon(entityData.type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Button variant="ghost" asChild className="mb-4">
          <Link to="/entities">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Entities
          </Link>
        </Button>
        
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0 p-3 bg-muted rounded-lg">
            <IconComponent className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{entityData.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              <Badge 
                variant="outline" 
                className={getEntityTypeColor(entityData.type)}
              >
                {entityData.type}
              </Badge>
              <span className="text-sm text-muted-foreground">
                {meetings.length} meeting{meetings.length !== 1 ? 's' : ''}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Sidebar - Entity Information */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Entity Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-sm font-medium">Name</Label>
                <p className="text-sm text-muted-foreground">
                  {entityData.name}
                </p>
              </div>
              
              <div>
                <Label className="text-sm font-medium">Type</Label>
                <p className="text-sm text-muted-foreground">
                  {entityData.type}
                </p>
              </div>

              {entityData.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {entityData.description}
                  </p>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-medium">Created</Label>
                <p className="text-sm text-muted-foreground">
                  {formatDateTime(entityData.created_at)}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">Total meetings:</span>
                  <span className="text-sm font-medium">{meetings.length}</span>
                </div>
                {meetings.length > 0 && (
                  <>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Latest meeting:</span>
                      <span className="text-sm font-medium">
                        {formatRelativeTime(meetings[0]?.date)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">First mentioned:</span>
                      <span className="text-sm font-medium">
                        {formatRelativeTime(meetings[meetings.length - 1]?.date)}
                      </span>
                    </div>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content - Related Meetings */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Related Meetings
                <Badge variant="secondary">{meetings.length}</Badge>
              </CardTitle>
              <CardDescription>
                All meetings where this entity was mentioned or involved
              </CardDescription>
            </CardHeader>
            <CardContent>
              {meetings.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No meetings yet</h3>
                  <p className="text-muted-foreground mb-4">
                    This entity hasn't been mentioned in any meetings yet.
                  </p>
                  <Button asChild>
                    <Link to="/meetings/new">
                      <Calendar className="w-4 h-4 mr-2" />
                      Create Meeting
                    </Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {meetings.map((meeting) => (
                    <Link
                      key={meeting.id}
                      to={`/meetings/${meeting.id}`}
                      className="block"
                    >
                      <Card className="hover:shadow-md transition-shadow cursor-pointer">
                        <CardHeader className="pb-3">
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-lg mb-1">
                                {meeting.title}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <Calendar className="w-4 h-4" />
                                {formatDateTime(meeting.date)} • {formatRelativeTime(meeting.date)}
                              </CardDescription>
                            </div>
                            <div className="flex items-center gap-2">
                              {meeting.transcript && (
                                <Badge variant="outline" className="text-xs">
                                  <FileText className="w-3 h-3 mr-1" />
                                  Transcript
                                </Badge>
                              )}
                              <ExternalLink className="w-4 h-4 text-muted-foreground" />
                            </div>
                          </div>
                        </CardHeader>
                        {meeting.summary && (
                          <CardContent>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {meeting.summary}
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}