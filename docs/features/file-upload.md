# File Upload Feature

## Overview

The file upload feature enables users to process meeting recordings by uploading audio files that are automatically transcribed and processed through the AI pipeline. The system handles multiple audio formats, file validation, temporary storage, and cleanup.

## Architecture

### Upload Flow

```
Client Upload → Validation → Temporary Storage → Processing → Cleanup
     ↓              ↓            ↓                ↓           ↓
File Selection   Format/Size   Save to uploads/  Whisper    Delete temp
(Frontend)       Check         directory         API        file
                 (Backend)     (Backend)         (OpenAI)   (Backend)
```

### File Processing Pipeline

1. **Frontend File Selection**: User selects audio file through HTML file input
2. **Multipart Form Submit**: File uploaded via FormData with meeting metadata
3. **Backend Validation**: File format, size, and type validation
4. **Temporary Storage**: Save file to uploads directory with unique filename
5. **OpenAI Processing**: Pass file to Whisper API for transcription
6. **AI Pipeline**: Continue with summary, entities, and action items
7. **Cleanup**: Remove temporary file after processing
8. **Response**: Return processed meeting data

## Backend Implementation

### Multipart Form Handling

**FastAPI Endpoint**:
```python
@router.post("/meetings/process", response_model=MeetingWithEntities)
async def process_meeting(
    title: str = Form(...),
    date: str = Form(...),
    transcript: Optional[str] = Form(None),
    audio_file: Optional[UploadFile] = File(None),
    entity_ids: Optional[str] = Form(None),
    meeting_type_slug: Optional[str] = Form("general"),
    db: DatabaseManager = Depends(get_db),
    processor: MeetingProcessor = Depends(get_meeting_processor),
    entity_manager: EntityManager = Depends(get_entity_manager)
):
```

**Form Parameter Handling**:
- **title**: Required meeting title (form field)
- **date**: Meeting date in ISO format (form field)
- **transcript**: Optional text transcript (form field)
- **audio_file**: Optional audio file upload (file field)
- **entity_ids**: Optional JSON string of entity IDs (form field)
- **meeting_type_slug**: Meeting type identifier (form field, defaults to "general")

### File Validation

**Supported Formats**:
```python
SUPPORTED_AUDIO_FORMATS = {
    'audio/mpeg',      # .mp3
    'audio/mp4',       # .m4a
    'audio/wav',       # .wav
    'audio/webm',      # .webm
    'audio/ogg',       # .ogg
    'video/mp4',       # .mp4 (audio track)
    'video/mpeg',      # .mpg, .mpeg
    'video/webm'       # .webm (audio track)
}
```

**Validation Logic**:
```python
async def validate_audio_file(file: UploadFile) -> None:
    # File size validation (25MB OpenAI limit)
    if file.size and file.size > 25 * 1024 * 1024:
        raise HTTPException(
            status_code=413, 
            detail="Audio file too large. Maximum size is 25MB."
        )
    
    # Content type validation
    if file.content_type not in SUPPORTED_AUDIO_FORMATS:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported audio format: {file.content_type}. "
                   f"Supported formats: {', '.join(SUPPORTED_AUDIO_FORMATS)}"
        )
    
    # File extension validation
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        if ext not in ['.mp3', '.wav', '.m4a', '.mp4', '.webm', '.ogg', '.mpeg', '.mpga']:
            raise HTTPException(
                status_code=415,
                detail=f"Unsupported file extension: {ext}"
            )
```

### File Storage Management

**Temporary File Handling**:
```python
async def save_uploaded_file(file: UploadFile) -> str:
    # Create uploads directory if it doesn't exist
    upload_dir = Path("uploads")
    upload_dir.mkdir(exist_ok=True)
    
    # Generate unique filename to prevent conflicts
    file_extension = Path(file.filename).suffix if file.filename else ""
    unique_filename = f"{uuid.uuid4()}{file_extension}"
    file_path = upload_dir / unique_filename
    
    # Save file contents
    try:
        with open(file_path, "wb") as buffer:
            content = await file.read()
            buffer.write(content)
        
        logger.info(f"Uploaded file saved: {file_path}")
        return str(file_path)
    
    except Exception as e:
        # Cleanup on error
        if file_path.exists():
            file_path.unlink()
        raise HTTPException(
            status_code=500,
            detail=f"Failed to save uploaded file: {str(e)}"
        )
```

**Cleanup Strategy**:
```python
async def cleanup_temp_file(file_path: str) -> None:
    try:
        if os.path.exists(file_path):
            os.remove(file_path)
            logger.info(f"Cleaned up temporary file: {file_path}")
    except Exception as e:
        logger.error(f"Failed to cleanup file {file_path}: {e}")
        # Don't raise exception - cleanup failure shouldn't break processing
```

### OpenAI Whisper Integration

**Transcription Process**:
```python
async def transcribe_audio(self, audio_file_path: str) -> str:
    try:
        logger.info(f"Transcribing audio file: {audio_file_path}")
        
        with open(audio_file_path, "rb") as audio_file:
            transcript = await self.client.audio.transcriptions.create(
                model="whisper-1",
                file=audio_file,
                response_format="text",
                language="en"  # Optional: can auto-detect or specify
            )
        
        logger.success(f"Audio transcribed successfully, length: {len(transcript)} characters")
        return transcript
        
    except Exception as e:
        logger.error(f"Error transcribing audio: {e}")
        raise Exception(f"Failed to transcribe audio: {e}")
```

**Whisper API Configuration**:
- **Model**: whisper-1 (OpenAI's production model)
- **Response Format**: text (plain text, not JSON)
- **Language**: Auto-detect (or specify if known)
- **File Size Limit**: 25MB (OpenAI constraint)

## Frontend Implementation

### File Input Component

**React File Upload**:
```typescript
interface FileUploadProps {
  onFileSelect: (file: File | null) => void;
  accept?: string;
  maxSize?: number;
}

function FileUpload({ onFileSelect, accept, maxSize }: FileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && maxSize && file.size > maxSize) {
      toast.error(`File too large. Maximum size is ${maxSize / (1024 * 1024)}MB`);
      return;
    }
    onFileSelect(file);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    
    const file = event.dataTransfer.files[0];
    if (file) {
      handleFileChange({ target: { files: [file] } } as any);
    }
  };

  return (
    <div
      className={cn(
        "border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors",
        dragOver ? "border-primary bg-primary/10" : "border-muted-foreground/25",
        "hover:border-primary hover:bg-primary/5"
      )}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileChange}
        className="hidden"
      />
      
      <Upload className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
      <p className="text-lg font-medium">Choose audio file or drag and drop</p>
      <p className="text-sm text-muted-foreground">
        Supports MP3, WAV, M4A, MP4 (max 25MB)
      </p>
    </div>
  );
}
```

### Form Submission

**Meeting Processing Form**:
```typescript
function NewMeetingForm() {
  const [formData, setFormData] = useState<MeetingProcessRequest>({
    title: '',
    date: new Date().toISOString().split('T')[0],
    transcript: '',
    entity_ids: [],
    meeting_type_slug: 'general',
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);

  const processMutation = useMutation({
    mutationFn: (data: MeetingProcessRequest) => 
      meetingApi.process(data).then(res => res.data),
    onSuccess: (meeting) => {
      toast.success('Meeting processed successfully!');
      navigate(`/meetings/${meeting.id}`);
    },
    onError: (error) => {
      toast.error(`Processing failed: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.transcript && !audioFile) {
      toast.error('Please provide either a transcript or audio file');
      return;
    }

    processMutation.mutate({
      ...formData,
      audio_file: audioFile,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <Label htmlFor="title">Meeting Title</Label>
        <Input
          id="title"
          value={formData.title}
          onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
          required
        />
      </div>

      <div>
        <Label htmlFor="audio">Audio File</Label>
        <FileUpload
          onFileSelect={setAudioFile}
          accept="audio/*,video/*"
          maxSize={25 * 1024 * 1024} // 25MB
        />
        {audioFile && (
          <p className="mt-2 text-sm text-muted-foreground">
            Selected: {audioFile.name} ({(audioFile.size / (1024 * 1024)).toFixed(2)} MB)
          </p>
        )}
      </div>

      <div>
        <Label htmlFor="transcript">Or Paste Transcript</Label>
        <Textarea
          id="transcript"
          placeholder="Paste meeting transcript here..."
          value={formData.transcript}
          onChange={(e) => setFormData(prev => ({ ...prev, transcript: e.target.value }))}
          rows={6}
        />
      </div>

      <Button 
        type="submit" 
        disabled={processMutation.isPending || (!formData.transcript && !audioFile)}
        className="w-full"
      >
        {processMutation.isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing Meeting...
          </>
        ) : (
          'Process Meeting'
        )}
      </Button>
    </form>
  );
}
```

### API Client Integration

**FormData Construction**:
```typescript
// lib/api.ts
export const meetingApi = {
  process: (data: MeetingProcessRequest) => {
    const formData = new FormData();
    formData.append('title', data.title);
    formData.append('date', data.date);
    
    if (data.transcript) {
      formData.append('transcript', data.transcript);
    }
    
    if (data.audio_file) {
      formData.append('audio_file', data.audio_file);
    }
    
    if (data.entity_ids && data.entity_ids.length > 0) {
      formData.append('entity_ids', JSON.stringify(data.entity_ids));
    }
    
    if (data.meeting_type_slug) {
      formData.append('meeting_type_slug', data.meeting_type_slug);
    }
    
    return api.post<MeetingWithEntities>('/meetings/process', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      timeout: 300000, // 5 minutes for large file processing
    });
  },
};
```

## Error Handling

### Backend Error Scenarios

**File Size Validation**:
```python
if file.size and file.size > 25 * 1024 * 1024:
    raise HTTPException(
        status_code=413, 
        detail="Audio file too large. Maximum size is 25MB."
    )
```

**Format Validation**:
```python
if file.content_type not in SUPPORTED_AUDIO_FORMATS:
    raise HTTPException(
        status_code=415,
        detail=f"Unsupported audio format: {file.content_type}"
    )
```

**Storage Errors**:
```python
try:
    with open(file_path, "wb") as buffer:
        content = await file.read()
        buffer.write(content)
except Exception as e:
    # Cleanup partial file
    if file_path.exists():
        file_path.unlink()
    raise HTTPException(
        status_code=500,
        detail=f"Failed to save uploaded file: {str(e)}"
    )
```

**Transcription Errors**:
```python
try:
    transcript = await self.client.audio.transcriptions.create(...)
except Exception as e:
    logger.error(f"Transcription failed: {e}")
    # Cleanup temp file before raising
    await cleanup_temp_file(audio_file_path)
    raise Exception(f"Failed to transcribe audio: {e}")
```

### Frontend Error Handling

**File Validation**:
```typescript
const validateFile = (file: File): string | null => {
  const maxSize = 25 * 1024 * 1024; // 25MB
  const allowedTypes = [
    'audio/mpeg', 'audio/wav', 'audio/m4a', 
    'audio/mp4', 'video/mp4', 'audio/webm'
  ];

  if (file.size > maxSize) {
    return 'File size must be less than 25MB';
  }

  if (!allowedTypes.includes(file.type)) {
    return 'Unsupported file format. Please use MP3, WAV, M4A, or MP4';
  }

  return null;
};
```

**Upload Progress**:
```typescript
const processMutation = useMutation({
  mutationFn: (data: MeetingProcessRequest) => 
    meetingApi.process(data),
  onError: (error: any) => {
    if (error.response?.status === 413) {
      toast.error('File too large. Maximum size is 25MB.');
    } else if (error.response?.status === 415) {
      toast.error('Unsupported file format.');
    } else {
      toast.error(`Upload failed: ${error.message}`);
    }
  },
});
```

## Security Considerations

### File Upload Security

1. **File Type Validation**: Both MIME type and extension checking
2. **Size Limits**: Enforce OpenAI's 25MB limit
3. **Filename Sanitization**: Use UUID-based names to prevent path traversal
4. **Temporary Storage**: Files stored outside web root
5. **Cleanup**: Automatic removal after processing

### Input Sanitization

```python
# Sanitize filename to prevent path traversal
def sanitize_filename(filename: str) -> str:
    # Remove path components
    filename = os.path.basename(filename)
    # Remove potentially dangerous characters
    filename = re.sub(r'[^\w\-_\.]', '', filename)
    return filename
```

## Performance Optimization

### Upload Performance

1. **Streaming**: Large files streamed to disk rather than loaded into memory
2. **Concurrent Processing**: File save and AI processing can be parallelized
3. **Cleanup**: Background cleanup tasks don't block response

### Storage Efficiency

1. **Temporary Storage**: Files deleted immediately after processing
2. **No Permanent Storage**: Audio files not stored long-term
3. **Disk Space Monitoring**: Could add cleanup jobs for orphaned files

## Future Enhancements

### Planned Features

1. **Upload Progress**: Real-time upload progress indicators
2. **Batch Upload**: Multiple file processing in single request
3. **Cloud Storage**: S3/GCS integration for scalable storage
4. **Format Conversion**: Server-side audio format conversion
5. **Resume Upload**: Chunked upload with resume capability

### Integration Opportunities

1. **Direct Recording**: Browser-based audio recording
2. **Cloud Import**: Import from Google Drive, Dropbox, etc.
3. **Calendar Integration**: Auto-upload from calendar meeting recordings
4. **Webhook Processing**: Process files uploaded via webhook

The file upload feature provides a robust, secure, and user-friendly way to transform audio recordings into structured meeting insights, handling the complexities of file validation, temporary storage, and cleanup while maintaining excellent error handling and user experience.