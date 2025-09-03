import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { meetingApi } from '@/lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { formatRelativeTime } from '@/lib/utils';
import { Calendar, FileText } from 'lucide-react';
import type { Meeting } from '@/types';

export default function HomePage() {
  const { data: meetings, isLoading, error } = useQuery({
    queryKey: ['meetings'],
    queryFn: () => meetingApi.getAll(10, 0),
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Recent Meetings</h1>
          <div className="h-10 w-32 bg-muted rounded animate-pulse"></div>
        </div>
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
            <div className="space-y-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="relative flex items-start gap-6 animate-pulse">
                  <div className="w-16 h-16 bg-muted rounded-full flex-shrink-0"></div>
                  <div className="flex-1 pb-8">
                    <div className="bg-muted rounded-lg h-32"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
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
        <h1 className="text-3xl font-bold">Recent Meetings</h1>
        <Link 
          to="/meetings" 
          className="text-primary hover:text-primary/80 font-medium"
        >
          View all meetings →
        </Link>
      </div>

      {meetingsList.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No meetings yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Start by creating your first meeting to see it here.
            </p>
            <Link 
              to="/meetings/new" 
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Create your first meeting
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="max-w-4xl mx-auto">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-border"></div>
            
            <div className="space-y-8">
              {meetingsList.map((meeting: Meeting) => (
                <div key={meeting.id} className="relative flex items-start gap-6">
                  {/* Timeline dot */}
                  <div className="relative z-10 flex items-center justify-center w-16 h-16 bg-background border-2 border-primary rounded-full flex-shrink-0">
                    <Calendar className="w-6 h-6 text-primary" />
                  </div>
                  
                  {/* Meeting content */}
                  <div className="flex-1 min-w-0 pb-8">
                    <Link to={`/meetings/${meeting.id}`}>
                      <Card className="hover:shadow-md transition-all duration-200 hover:border-primary/50 cursor-pointer">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <CardTitle className="text-xl mb-1 line-clamp-2">
                                {meeting.title}
                              </CardTitle>
                              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="w-4 h-4" />
                                  {formatRelativeTime(meeting.date)}
                                </span>
                                {meeting.transcript && (
                                  <span className="flex items-center gap-1">
                                    <FileText className="w-4 h-4" />
                                    Transcript
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* Time badge */}
                            <div className="flex-shrink-0">
                              <div className="px-3 py-1 bg-muted rounded-full text-xs font-medium">
                                {new Date(meeting.date).toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric'
                                })}
                              </div>
                            </div>
                          </div>
                        </CardHeader>
                        
                        {meeting.summary && (
                          <CardContent className="pt-0">
                            <p className="text-sm text-muted-foreground line-clamp-3 leading-relaxed">
                              {meeting.summary}
                            </p>
                          </CardContent>
                        )}
                      </Card>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}