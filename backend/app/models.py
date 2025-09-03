from datetime import datetime
from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


# Dynamic Entity Types (replaced hardcoded enum with database table)
class EntityTypeModel(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=50)
    slug: str = Field(..., min_length=1, max_length=50)  # URL-friendly identifier
    color_class: str = Field(..., min_length=1, max_length=100)  # CSS classes for styling
    description: Optional[str] = None
    is_system: bool = False  # System types cannot be deleted
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActionItemStatus(str, Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


# Database Models
class Entity(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=255)
    type_slug: str = Field(..., min_length=1, max_length=50)  # References entity_types.slug
    description: Optional[str] = None
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class Meeting(BaseModel):
    id: Optional[int] = None
    title: str = Field(..., min_length=1, max_length=255)
    date: datetime
    transcript: Optional[str] = None
    summary: Optional[str] = None
    audio_file_path: Optional[str] = None
    meeting_type_slug: Optional[str] = Field(default='general', max_length=50)
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class ActionItem(BaseModel):
    id: Optional[int] = None
    meeting_id: int
    description: str = Field(..., min_length=1)
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    status: ActionItemStatus = ActionItemStatus.PENDING
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingEntity(BaseModel):
    meeting_id: int
    entity_id: int

    class Config:
        from_attributes = True


# Request/Response Models
class EntityCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    type_slug: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None


class EntityUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    type_slug: Optional[str] = Field(None, min_length=1, max_length=50)
    description: Optional[str] = None


class EntityBulkDelete(BaseModel):
    ids: List[int] = Field(..., min_items=1, max_items=100)


class EntityBulkUpdateType(BaseModel):
    ids: List[int] = Field(..., min_items=1, max_items=100)
    type_slug: str = Field(..., min_length=1, max_length=50)


# Meeting Type Models
class MeetingType(BaseModel):
    id: Optional[int] = None
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    summary_instructions: Optional[str] = None
    entity_instructions: Optional[str] = None
    action_item_instructions: Optional[str] = None
    is_system: bool = False
    created_at: Optional[datetime] = None

    class Config:
        from_attributes = True


class MeetingTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = Field(..., min_length=1, max_length=50)
    description: Optional[str] = None
    summary_instructions: Optional[str] = None
    entity_instructions: Optional[str] = None
    action_item_instructions: Optional[str] = None


class MeetingTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None
    summary_instructions: Optional[str] = None
    entity_instructions: Optional[str] = None
    action_item_instructions: Optional[str] = None


# Entity Type CRUD Models
class EntityTypeCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)
    slug: str = Field(..., min_length=1, max_length=50)
    color_class: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = None


class EntityTypeUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=50)
    color_class: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = None


class MeetingCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    date: datetime
    transcript: Optional[str] = None
    meeting_type_slug: Optional[str] = Field(default='general', max_length=50)
    entity_ids: Optional[List[int]] = Field(default_factory=list)


class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=1, max_length=255)
    date: Optional[datetime] = None
    transcript: Optional[str] = None
    summary: Optional[str] = None
    meeting_type_slug: Optional[str] = Field(None, max_length=50)


class ActionItemCreate(BaseModel):
    description: str = Field(..., min_length=1)
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    status: ActionItemStatus = ActionItemStatus.PENDING


class ActionItemUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=1)
    assignee: Optional[str] = None
    due_date: Optional[datetime] = None
    status: Optional[ActionItemStatus] = None


# Enhanced Entity with Type Information
class EntityWithType(Entity):
    type_name: Optional[str] = None
    type_color_class: Optional[str] = None

    class Config:
        from_attributes = True


# Response Models with relationships
class MeetingWithEntities(Meeting):
    entities: List[EntityWithType] = Field(default_factory=list)
    action_items: List[ActionItem] = Field(default_factory=list)


class EntityWithMeetings(EntityWithType):
    meetings: List[Meeting] = Field(default_factory=list)


# Processing Response Models
class ProcessingResult(BaseModel):
    transcript: str
    summary: str
    entities: List[str]
    action_items: List[str]


class MeetingProcessRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=255)
    date: datetime
    transcript: Optional[str] = None
    audio_file: Optional[str] = None  # Will be file upload in actual implementation
    meeting_type_slug: Optional[str] = Field(default='general', max_length=50)