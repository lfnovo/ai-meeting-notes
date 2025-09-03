import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { meetingApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatDateTime } from '@/lib/utils';
import { Calendar, Plus, FileText } from 'lucide-react';
import type { Meeting } from '@/types';

export default function MeetingsPage() {
  const { data: meetings, isLoading, error } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => meetingApi.getAll(50, 0),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">All Meetings</h1>
          <Button asChild className="w-fit min-w-0">
            <Link to="/meetings/new">
              <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
              <span className="truncate">New Meeting</span>
            </Link>
          </Button>
        </div>
        <div className="space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="bg-muted rounded-lg h-24"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-destructive mb-4">Error loading meetings</h1>
        <p className="text-muted-foreground">Please try again later.</p>
      </div>
    );
  }

  const meetingsList = meetings?.data || [];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">All Meetings</h1>
        <Button asChild className="w-fit min-w-0">
          <Link to="/meetings/new">
            <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
            <span className="truncate">New Meeting</span>
          </Link>
        </Button>
      </div>

      {meetingsList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No meetings yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start by creating your first meeting to see it here.
            </p>
            <Button asChild className="w-fit min-w-0">
              <Link to="/meetings/new">
                <Plus className="w-4 h-4 mr-2 flex-shrink-0" />
                <span className="truncate">Create your first meeting</span>
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {meetingsList.map((meeting: Meeting) => (
            <Link key={meeting.id} to={`/meetings/${meeting.id}`}>
              <Card className="hover:shadow-md transition-shadow cursor-pointer">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <CardTitle className="text-xl mb-1">
                        {meeting.title}
                      </CardTitle>
                      <CardDescription className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {formatDateTime(meeting.date)}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {meeting.transcript && (
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          Transcript
                        </span>
                      )}
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
    </div>
  );
}