# Meeting Processing Feature

## Overview

The meeting processing feature is the core functionality of the AI Meeting Notes application. It transforms raw meeting data (audio files or transcripts) into structured, actionable information using OpenAI's API services.

## Processing Pipeline

### End-to-End Flow

```
Audio File/Transcript → Transcription → AI Processing → Structured Data → Database Storage
     ↓                      ↓              ↓              ↓               ↓
File Upload         Whisper API    GPT-4o-mini      Extract:        Save to DB:
  (.mp3, .wav)      (if needed)    (3 parallel     • Summary       • Meeting
                                   requests)       • Entities      • Entities
                                                   • Actions       • Action Items
```

### Processing Steps

1. **Input Validation**: Verify file format and size constraints
2. **File Handling**: Save uploaded audio to temporary storage
3. **Transcription**: Convert audio to text using OpenAI Whisper
4. **AI Analysis**: Parallel processing for summary, entities, and action items
5. **Entity Management**: Create or match entities to existing database records
6. **Data Storage**: Save processed results with relationships
7. **Cleanup**: Remove temporary files

## Implementation Details

### MeetingProcessor Service

Located in `backend/app/services/meeting_processor.py`, this service orchestrates the entire AI processing pipeline:

```python
class MeetingProcessor:
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def process_meeting(
        self, 
        transcript: Optional[str] = None,
        audio_file_path: Optional[str] = None,
        meeting_type: Optional[MeetingType] = None
    ) -> ProcessingResult:
        # Get transcript from audio if not provided
        if not transcript and audio_file_path:
            transcript = await self.transcribe_audio(audio_file_path)
        
        # Parallel AI processing
        summary = await self.generate_summary(transcript, meeting_type)
        entities = await self.extract_entities(transcript, meeting_type)
        action_items = await self.extract_action_items(transcript, meeting_type)
        
        return ProcessingResult(
            transcript=transcript,
            summary=summary,
            entities=entities,
            action_items=action_items
        )
```

### Audio Transcription

**OpenAI Whisper Integration**:
```python
async def transcribe_audio(self, audio_file_path: str) -> str:
    with open(audio_file_path, "rb") as audio_file:
        transcript = await self.client.audio.transcriptions.create(
            model="whisper-1",
            file=audio_file,
            response_format="text"
        )
    return transcript
```

**Supported Formats**:
- MP3, MP4, MPEG, MPGA, M4A, WAV, WEBM
- Maximum file size: 25MB (OpenAI limit)
- Automatic format detection

### AI Processing Components

#### 1. Summary Generation

**Model**: GPT-4o-mini for cost-effective, high-quality summaries

**Prompt Strategy**:
```python
def _build_summary_prompt(self, meeting_type: Optional[MeetingType] = None) -> str:
    base_prompt = """You are an expert meeting summarizer. Your task is to create a concise, well-structured summary of the meeting transcript provided.

    The summary should:
    - Be 2-4 paragraphs long
    - Capture the main topics discussed
    - Highlight key decisions made
    - Include important outcomes or conclusions
    - Be written in professional, clear language
    - Focus on the most important information
    
    Do not include action items in the summary (they will be extracted separately)."""
    
    if meeting_type and meeting_type.summary_instructions:
        custom_instructions = f"\n\nCustom instructions for this meeting type:\n{meeting_type.summary_instructions}"
        return base_prompt + custom_instructions
    
    return base_prompt
```

**Configuration**:
- Temperature: 0.3 (slightly creative but focused)
- Max tokens: 700 (2-4 paragraph limit)

#### 2. Entity Extraction

**Purpose**: Identify people, companies, projects, tools, and other important entities

**Output Format**:
```
John Smith|Person
Microsoft|Company
Project Alpha|Project
Slack|Tool
iPhone 15|Product
```

**Prompt Engineering**:
```python
base_prompt = """You are an expert at extracting entities from meeting transcripts. 

Extract and return a list of important entities mentioned in the meeting, including:
- People's names (colleagues, clients, stakeholders)
- Company names
- Project names
- Product names
- Important tools or systems mentioned

Rules:
- Return each entity in the format "EntityName|EntityType"
- Use the exact name as mentioned in the transcript
- Don't include common words or generic terms
- Focus on proper nouns and specific named entities
- If you're unsure of the type, use "Other"
"""
```

#### 3. Action Item Extraction

**Purpose**: Identify tasks, assignments, and follow-up items

**Format**: Clear, actionable statements with assignee and timeline when mentioned

**Example Output**:
```
John will send the project proposal to the client by Friday
Review the budget document and provide feedback
Sarah to schedule follow-up meeting with stakeholders
```

**Prompt Strategy**:
- Focus on actionable items with clear ownership
- Include deadlines when mentioned
- Format as natural language statements

## Meeting Type Customization

### Dynamic AI Instructions

Meeting types can customize AI processing through specialized prompts:

**Example: Daily Standup Meeting Type**:
```python
MeetingType(
    name="Daily Standup",
    slug="standup",
    summary_instructions="Focus on what was accomplished yesterday, what will be done today, and any blockers or impediments.",
    entity_instructions="Extract team member names, projects being worked on, and any tools or systems mentioned.",
    action_item_instructions="Identify blockers, impediments, or action items that need to be addressed by the team or individuals."
)
```

**Benefits**:
- Context-aware processing
- Domain-specific entity extraction
- Meeting-appropriate summarization
- Consistent output quality

## API Integration

### REST Endpoint

```http
POST /api/v1/meetings/process
Content-Type: multipart/form-data

{
  "title": "Weekly Team Sync",
  "date": "2024-01-15",
  "transcript": "Optional text transcript",
  "audio_file": [binary audio data],
  "entity_ids": [1, 2, 3],
  "meeting_type_slug": "standup"
}
```

### Response Format

```json
{
  "id": 123,
  "title": "Weekly Team Sync",
  "date": "2024-01-15T10:00:00",
  "transcript": "Meeting transcript here...",
  "summary": "Team discussed project progress...",
  "meeting_type_slug": "standup",
  "entities": [
    {
      "id": 1,
      "name": "John Smith",
      "type_slug": "person",
      "type_name": "Person",
      "type_color_class": "bg-blue-100 text-blue-800"
    }
  ],
  "action_items": [
    {
      "id": 1,
      "description": "John will send the project proposal by Friday",
      "assignee": "John",
      "status": "pending"
    }
  ]
}
```

## Entity Management Integration

### EntityManager Service

Coordinates entity creation and matching:

```python
class EntityManager:
    async def create_or_get_entities(
        self, 
        entity_strings: List[str], 
        db: DatabaseManager
    ) -> List[EntityWithType]:
        entities = []
        
        for entity_string in entity_strings:
            name, entity_type = self._parse_entity_string(entity_string)
            
            # Try to find existing entity
            existing = await self._find_existing_entity(name, db)
            if existing:
                entities.append(existing)
            else:
                # Create new entity
                new_entity = await db.create_entity(
                    EntityCreate(name=name, type_slug=entity_type)
                )
                entities.append(new_entity)
        
        return entities
```

**Entity Matching Strategy**:
- Exact name match first
- Fuzzy matching for similar names (future enhancement)
- Automatic entity type assignment based on AI extraction

## Error Handling & Resilience

### Failure Modes & Recovery

1. **OpenAI API Failures**:
   - Retry logic with exponential backoff
   - Fallback to transcript-only processing
   - Graceful degradation for partial failures

2. **File Upload Issues**:
   - File size validation
   - Format verification
   - Temporary storage cleanup

3. **Processing Timeouts**:
   - Reasonable timeout limits
   - Progress indicators for long operations
   - Async processing prevents UI blocking

```python
try:
    transcript = await self.transcribe_audio(audio_file_path)
except Exception as e:
    logger.error(f"Transcription failed: {e}")
    if transcript_fallback:
        transcript = transcript_fallback
    else:
        raise Exception("Unable to process meeting without transcript")
```

## Performance Considerations

### Optimization Strategies

1. **Parallel Processing**: Summary, entities, and action items processed concurrently
2. **Token Management**: Optimized prompt lengths and response limits
3. **Caching**: Entity matching results cached during processing
4. **Async Operations**: Non-blocking I/O throughout the pipeline

### Cost Optimization

1. **Model Selection**: GPT-4o-mini for cost-effective processing
2. **Prompt Engineering**: Efficient prompts minimize token usage
3. **Batch Processing**: Future enhancement for multiple meetings
4. **Smart Fallbacks**: Avoid redundant API calls

## Testing Strategy

### Unit Testing

```python
@pytest.mark.asyncio
async def test_process_meeting_with_transcript():
    processor = MeetingProcessor()
    result = await processor.process_meeting(transcript="Test meeting content")
    
    assert result.transcript == "Test meeting content"
    assert len(result.summary) > 0
    assert isinstance(result.entities, list)
    assert isinstance(result.action_items, list)
```

### Integration Testing

```python
@pytest.mark.integration
async def test_full_processing_pipeline():
    # Test with actual audio file
    audio_path = "test_data/sample_meeting.wav"
    result = await processor.process_meeting(audio_file_path=audio_path)
    
    # Verify complete processing
    assert result.transcript is not None
    assert "meeting" in result.summary.lower()
```

This meeting processing feature provides the core AI-powered functionality that transforms raw meeting content into structured, searchable, and actionable information, forming the foundation of the entire application's value proposition.