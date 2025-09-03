import { useState } from 'react';
import { useMutation, useQueryClient, useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { meetingApi, meetingTypeApi } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, FileText, Calendar, Loader2, MessageSquare } from 'lucide-react';
import type { MeetingProcessRequest } from '@/types';

export default function NewMeetingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [formData, setFormData] = useState({
    title: '',
    date: new Date().toISOString().slice(0, 16), // Format: YYYY-MM-DDTHH:mm
    transcript: '',
    audio_file: null as File | null,
    meeting_type_slug: 'general',
  });
  
  const [error, setError] = useState<string | null>(null);
  const [uploadMethod, setUploadMethod] = useState<'transcript' | 'audio'>('transcript');

  // Fetch meeting types
  const { data: meetingTypes, isLoading: meetingTypesLoading } = useQuery({
    queryKey: ['meeting-types'],
    queryFn: () => meetingTypeApi.getAll(),
  });

  const createMeetingMutation = useMutation({
    mutationFn: (data: MeetingProcessRequest) => meetingApi.process(data),
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['meetings'] });
      navigate(`/meetings/${response.data.id}`);
    },
    onError: (error: any) => {
      setError(error.response?.data?.detail || 'Failed to create meeting');
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type.startsWith('audio/') || file.name.endsWith('.mp3') || file.name.endsWith('.wav')) {
        setFormData(prev => ({ ...prev, audio_file: file }));
        setError(null);
      } else {
        setError('Please select a valid audio file (.mp3, .wav, etc.)');
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Meeting title is required');
      return;
    }

    if (uploadMethod === 'transcript' && !formData.transcript.trim()) {
      setError('Transcript is required when using text input');
      return;
    }

    if (uploadMethod === 'audio' && !formData.audio_file) {
      setError('Audio file is required when using file upload');
      return;
    }

    const requestData: MeetingProcessRequest = {
      title: formData.title,
      date: new Date(formData.date).toISOString(),
      meeting_type_slug: formData.meeting_type_slug,
    };

    if (uploadMethod === 'transcript') {
      requestData.transcript = formData.transcript;
    } else {
      requestData.audio_file = formData.audio_file || undefined;
    }

    createMeetingMutation.mutate(requestData);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Create New Meeting</h1>
        <p className="text-muted-foreground mt-2">
          Upload an audio file or paste a transcript to generate meeting minutes
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Meeting Information</CardTitle>
          <CardDescription>
            Provide basic details about your meeting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Meeting Title *</Label>
              <Input
                id="title"
                type="text"
                placeholder="e.g., Weekly Team Standup"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Meeting Date & Time</Label>
              <Input
                id="date"
                type="datetime-local"
                value={formData.date}
                onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                className="w-full"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="meeting-type">Meeting Type</Label>
              <Select
                value={formData.meeting_type_slug}
                onValueChange={(value) => setFormData(prev => ({ ...prev, meeting_type_slug: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select meeting type" />
                </SelectTrigger>
                <SelectContent>
                  {meetingTypesLoading ? (
                    <SelectItem value="general" disabled>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading meeting types...
                    </SelectItem>
                  ) : (
                    meetingTypes?.data?.map((type) => (
                      <SelectItem key={type.id} value={type.slug}>
                        <div className="flex items-center gap-2">
                          <MessageSquare className="w-4 h-4" />
                          <span>{type.name}</span>
                          {type.is_system && (
                            <span className="text-xs text-muted-foreground">(System)</span>
                          )}
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Meeting type affects how the AI processes and extracts information
              </p>
            </div>

            <div className="space-y-4">
              <Label>Content Source</Label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setUploadMethod('transcript')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    uploadMethod === 'transcript'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <FileText className="w-6 h-6 mb-2" />
                  <h3 className="font-medium">Text Transcript</h3>
                  <p className="text-sm text-muted-foreground">
                    Paste the meeting transcript directly
                  </p>
                </button>
                
                <button
                  type="button"
                  onClick={() => setUploadMethod('audio')}
                  className={`p-4 border rounded-lg text-left transition-colors ${
                    uploadMethod === 'audio'
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                >
                  <Upload className="w-6 h-6 mb-2" />
                  <h3 className="font-medium">Audio File</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload an audio recording
                  </p>
                </button>
              </div>
            </div>

            {uploadMethod === 'transcript' && (
              <div className="space-y-2">
                <Label htmlFor="transcript">Meeting Transcript *</Label>
                <Textarea
                  id="transcript"
                  placeholder="Paste your meeting transcript here..."
                  value={formData.transcript}
                  onChange={(e) => setFormData(prev => ({ ...prev, transcript: e.target.value }))}
                  className="min-h-[200px]"
                />
              </div>
            )}

            {uploadMethod === 'audio' && (
              <div className="space-y-2">
                <Label htmlFor="audio">Audio File *</Label>
                <div className="flex items-center space-x-2">
                  <Input
                    id="audio"
                    type="file"
                    accept="audio/*,.mp3,.wav,.m4a"
                    onChange={handleFileChange}
                    className="file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                  />
                </div>
                {formData.audio_file && (
                  <p className="text-sm text-muted-foreground">
                    Selected: {formData.audio_file.name}
                  </p>
                )}
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <Button 
                type="submit" 
                disabled={createMeetingMutation.isPending}
                className="flex-1"
              >
                {createMeetingMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Calendar className="w-4 h-4 mr-2" />
                    Create Meeting
                  </>
                )}
              </Button>
              
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => navigate('/meetings')}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}