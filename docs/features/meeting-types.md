# Meeting Types Feature

## Overview

The meeting types feature enables customizable AI processing templates that adapt the summarization, entity extraction, and action item identification to specific meeting contexts. This ensures relevant, contextual output tailored to different types of organizational meetings.

## Architecture

### Meeting Type Data Model

```python
class MeetingType(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=50)  # URL-friendly identifier
    description: Optional[str] = None
    summary_instructions: Optional[str] = None
    entity_instructions: Optional[str] = None
    action_item_instructions: Optional[str] = None
    is_system: bool = False  # System types cannot be deleted
    created_at: Optional[datetime] = None
```

### AI Processing Integration

Meeting types customize AI processing through specialized instructions that are injected into the base prompts:

**Prompt Composition Pattern**:
```python
def _build_summary_prompt(self, meeting_type: Optional[MeetingType] = None) -> str:
    base_prompt = """You are an expert meeting summarizer. Your task is to create a concise, well-structured summary..."""
    
    if meeting_type and meeting_type.summary_instructions:
        custom_instructions = f"\n\nCustom instructions for this meeting type:\n{meeting_type.summary_instructions}"
        return base_prompt + custom_instructions
    
    return base_prompt
```

## Default Meeting Types

The system includes pre-configured meeting types for common organizational contexts:

### 1. General Meeting
```python
MeetingType(
    name="General Meeting",
    slug="general",
    description="Default meeting type for general discussions",
    summary_instructions=None,  # Uses base prompt
    entity_instructions=None,
    action_item_instructions=None,
    is_system=True
)
```

### 2. Daily Standup
```python
MeetingType(
    name="Daily Standup",
    slug="standup",
    description="Daily team standup meetings",
    summary_instructions="Focus on what was accomplished yesterday, what will be done today, and any blockers or impediments.",
    entity_instructions="Extract team member names, projects being worked on, and any tools or systems mentioned.",
    action_item_instructions="Identify blockers, impediments, or action items that need to be addressed by the team or individuals.",
    is_system=True
)
```

### 3. Sprint Planning
```python
MeetingType(
    name="Sprint Planning",
    slug="sprint-planning", 
    description="Sprint planning and story estimation meetings",
    summary_instructions="Summarize the sprint goals, stories planned, capacity discussions, and any major decisions about scope or timeline.",
    entity_instructions="Extract team member names, user stories, epics, and any external stakeholders mentioned.",
    action_item_instructions="Capture story assignments, estimation decisions, and any follow-up tasks for story refinement.",
    is_system=True
)
```

### 4. Retrospective
```python
MeetingType(
    name="Retrospective",
    slug="retrospective",
    description="Team retrospective meetings", 
    summary_instructions="Focus on what went well, what could be improved, and key takeaways from the period being reviewed.",
    entity_instructions="Extract team member names, processes, tools, and any external factors mentioned.",
    action_item_instructions="Identify specific action items for process improvements and who will own them.",
    is_system=True
)
```

### 5. Client Meeting
```python
MeetingType(
    name="Client Meeting",
    slug="client-meeting",
    description="Meetings with external clients or stakeholders",
    summary_instructions="Emphasize client requirements, feedback, decisions made, and next steps in the relationship.",
    entity_instructions="Extract client names, company names, project names, and any deliverables or systems discussed.",
    action_item_instructions="Focus on client requests, commitments made, deliverables promised, and follow-up actions.",
    is_system=True
)
```

## AI Processing Customization

### Summary Instructions

**Purpose**: Tailor the meeting summary to emphasize relevant aspects for different meeting types.

**Example - Client Meeting**:
```
Custom instructions for this meeting type:
Emphasize client requirements, feedback, decisions made, and next steps in the relationship.
```

**Result**: Summaries focus on client-centric outcomes rather than internal process details.

### Entity Instructions

**Purpose**: Guide entity extraction to identify the most relevant entities for specific meeting contexts.

**Example - Sprint Planning**:
```
Custom instructions for this meeting type:
Extract team member names, user stories, epics, and any external stakeholders mentioned.
```

**Result**: Entities include user story names like "User Login Epic" and "Customer Dashboard Story" that might otherwise be missed.

### Action Item Instructions

**Purpose**: Focus action item extraction on the most relevant task types for each meeting context.

**Example - Retrospective**:
```
Custom instructions for this meeting type:
Identify specific action items for process improvements and who will own them.
```

**Result**: Action items focus on process changes rather than general tasks.

## Meeting Type Management

### CRUD Operations

**Create Custom Meeting Type**:
```python
@router.post("/meeting-types", response_model=MeetingType)
async def create_meeting_type(
    meeting_type: MeetingTypeCreate,
    db: DatabaseManager = Depends(get_db)
):
    # Validate slug uniqueness
    existing = await db.get_meeting_type_by_slug(meeting_type.slug)
    if existing:
        raise HTTPException(status_code=400, detail="Meeting type slug already exists")
    
    return await db.create_meeting_type(meeting_type)
```

**Example Custom Type Creation**:
```json
{
  "name": "Sales Call",
  "slug": "sales-call",
  "description": "Meetings with prospective customers",
  "summary_instructions": "Focus on prospect needs, pain points discussed, solution fit, and sales process next steps.",
  "entity_instructions": "Extract prospect names, company names, competitor mentions, and product/service interests.",
  "action_item_instructions": "Identify follow-up actions, proposals to send, demos to schedule, and internal coordination tasks."
}
```

### Update Operations

**Dynamic Update Pattern**:
```python
@router.put("/meeting-types/{type_id}", response_model=MeetingType)
async def update_meeting_type(
    type_id: int,
    meeting_type_update: MeetingTypeUpdate,
    db: DatabaseManager = Depends(get_db)
):
    # Build update query dynamically based on provided fields
    update_fields = []
    update_values = []
    
    if meeting_type_update.summary_instructions is not None:
        update_fields.append("summary_instructions = ?")
        update_values.append(meeting_type_update.summary_instructions)
    # ... handle other fields
    
    if not update_fields:
        return await db.get_meeting_type_by_id(type_id)
    
    # Execute update with dynamic SQL
    await conn.execute(f"""
        UPDATE meeting_types 
        SET {', '.join(update_fields)}
        WHERE id = ?
    """, update_values + [type_id])
```

### Protection Mechanisms

**System Type Protection**:
```python
async def delete_meeting_type(self, type_id: int) -> bool:
    async with self.get_connection() as conn:
        # Check if it's a system type
        cursor = await conn.execute("""
            SELECT is_system FROM meeting_types WHERE id = ?
        """, (type_id,))
        row = await cursor.fetchone()
        
        if not row or row[0]:  # System types cannot be deleted
            return False
        
        # Check if any meetings are using this type
        cursor = await conn.execute("""
            SELECT COUNT(*) FROM meetings WHERE meeting_type_slug = (
                SELECT slug FROM meeting_types WHERE id = ?
            )
        """, (type_id,))
        count = await cursor.fetchone()
        
        if count and count[0] > 0:  # Type is in use
            return False
        
        # Safe to delete
        return True
```

## Integration with Meeting Processing

### Meeting Assignment

**During Meeting Creation**:
```python
@router.post("/meetings/process")
async def process_meeting(
    meeting_type_slug: Optional[str] = Form("general"),
    # ... other parameters
):
    # Get meeting type for AI customization
    meeting_type = None
    if meeting_type_slug:
        meeting_type = await db.get_meeting_type_by_slug(meeting_type_slug)
    
    # Process with custom instructions
    result = await processor.process_meeting(
        transcript=transcript,
        audio_file_path=audio_file_path,
        meeting_type=meeting_type  # Passed to AI processing
    )
```

### AI Processing Flow

```python
async def process_meeting(
    self,
    transcript: str,
    meeting_type: Optional[MeetingType] = None
) -> ProcessingResult:
    # All three AI operations use meeting type instructions
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

## Frontend Integration

### Meeting Type Selection

**Form Component**:
```typescript
function MeetingTypeSelector({ 
  value, 
  onChange 
}: MeetingTypeSelectorProps) {
  const { data: meetingTypes } = useQuery({
    queryKey: ['meeting-types'],
    queryFn: () => meetingTypeApi.getAll().then(res => res.data),
  });

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger>
        <SelectValue placeholder="Select meeting type" />
      </SelectTrigger>
      <SelectContent>
        {meetingTypes?.map(type => (
          <SelectItem key={type.slug} value={type.slug}>
            <div>
              <div className="font-medium">{type.name}</div>
              {type.description && (
                <div className="text-sm text-muted-foreground">
                  {type.description}
                </div>
              )}
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
```

### Admin Interface

**Meeting Type Management**:
```typescript
function MeetingTypeAdmin() {
  const { data: meetingTypes } = useQuery({
    queryKey: ['meeting-types'],
    queryFn: () => meetingTypeApi.getAll().then(res => res.data),
  });

  const createMutation = useMutation({
    mutationFn: meetingTypeApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['meeting-types'] });
    },
  });

  return (
    <div className="space-y-6">
      <div className="grid gap-4">
        {meetingTypes?.map(type => (
          <Card key={type.id}>
            <CardContent className="pt-6">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold">{type.name}</h3>
                  <p className="text-sm text-muted-foreground">
                    {type.description}
                  </p>
                  {type.is_system && (
                    <Badge variant="secondary" className="mt-2">
                      System Type
                    </Badge>
                  )}
                </div>
                <div className="flex space-x-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => openEditDialog(type)}
                  >
                    Edit
                  </Button>
                  {!type.is_system && (
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => deleteMeetingType(type.id)}
                    >
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
```

## Best Practices

### Writing Effective Instructions

**1. Summary Instructions**:
- Be specific about what aspects to emphasize
- Consider the meeting's purpose and outcomes
- Focus on what stakeholders care most about

**Good Example**:
```
Focus on customer feedback, feature requests discussed, usability issues raised, and any product decisions made.
```

**Poor Example**:
```
Make a good summary of the meeting.
```

**2. Entity Instructions**:
- Specify domain-specific entity types
- Include context about what names/terms to look for
- Consider technical vocabulary and jargon

**Good Example**:
```
Extract customer names, competitor names mentioned, feature names discussed, and any technical integration points or APIs referenced.
```

**3. Action Item Instructions**:
- Define what constitutes an action item in this context
- Specify priority or categorization preferences
- Include typical assignee patterns

**Good Example**:
```
Focus on development tasks, bug reports to file, documentation updates needed, and any customer follow-up actions. Prioritize items with specific deadlines or dependencies.
```

### Custom Type Design

**Domain-Specific Types**:
- **Engineering Reviews**: Focus on technical decisions, code quality, architectural choices
- **Marketing Planning**: Emphasize campaigns, metrics, target audiences, channel strategies  
- **Board Meetings**: Highlight strategic decisions, financial updates, governance matters
- **User Research**: Focus on insights, pain points, feature requests, usability findings

**Template Structure**:
```json
{
  "name": "Engineering Review",
  "slug": "eng-review", 
  "description": "Technical code and architecture review meetings",
  "summary_instructions": "Summarize technical decisions made, code quality issues discussed, architectural changes approved, and any performance or security concerns raised.",
  "entity_instructions": "Extract developer names, repository/module names, technology/framework names, and any external service dependencies mentioned.",
  "action_item_instructions": "Focus on code changes needed, documentation updates, testing requirements, and technical debt items to address."
}
```

## Performance Implications

### Token Usage Optimization

Meeting type instructions add tokens to AI requests but improve output quality:

**Token Impact**:
- Base prompt: ~150 tokens
- Custom instructions: +50-100 tokens per instruction type
- Improved relevance reduces need for manual editing

**Cost-Benefit Analysis**:
- Slightly higher per-request cost
- Significantly better output quality
- Reduced manual post-processing time
- Better user satisfaction and adoption

### Caching Strategy

Meeting types are cached for performance:
- Loaded once at application startup
- Updated only when modified through admin interface
- No per-request database queries for type lookup

This meeting types feature transforms generic AI processing into context-aware, domain-specific intelligence that adapts to the varied needs of different organizational meeting patterns.