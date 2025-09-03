export interface EntityType {
  id: number;
  name: string;
  slug: string;
  color_class: string;
  description?: string;
  is_system: boolean;
  created_at: string;
}

export interface Entity {
  id: number;
  name: string;
  type_slug: string;
  description?: string;
  created_at: string;
  type_name?: string;
  type_color_class?: string;
}

export interface Meeting {
  id: number;
  title: string;
  date: string;
  transcript?: string;
  summary?: string;
  audio_file_path?: string;
  meeting_type_slug?: string;
  created_at: string;
}

export interface ActionItem {
  id: number;
  meeting_id: number;
  description: string;
  assignee?: string;
  due_date?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  created_at: string;
}

export interface MeetingWithEntities extends Meeting {
  entities: Entity[];
  action_items: ActionItem[];
}

export interface EntityWithMeetings extends Entity {
  meetings: Meeting[];
}

export interface EntityLowUsage {
  id: number;
  name: string;
  type_slug: string;
  description?: string;
  created_at: string;
  meeting_id: number;
  meeting_title: string;
  meeting_date: string;
  type_name: string;
  color_class: string;
}

export interface EntityCreate {
  name: string;
  type_slug: string;
  description?: string;
}

export interface EntityTypeCreate {
  name: string;
  slug: string;
  color_class: string;
  description?: string;
}

export interface EntityTypeUpdate {
  name?: string;
  color_class?: string;
  description?: string;
}

export interface MeetingType {
  id: number;
  name: string;
  slug: string;
  description?: string;
  summary_instructions?: string;
  entity_instructions?: string;
  action_item_instructions?: string;
  is_system: boolean;
  created_at: string;
}

export interface MeetingTypeCreate {
  name: string;
  slug: string;
  description?: string;
  summary_instructions?: string;
  entity_instructions?: string;
  action_item_instructions?: string;
}

export interface MeetingTypeUpdate {
  name?: string;
  description?: string;
  summary_instructions?: string;
  entity_instructions?: string;
  action_item_instructions?: string;
}

export interface MeetingCreate {
  title: string;
  date: string;
  transcript?: string;
  entity_ids?: number[];
}

export interface MeetingProcessRequest {
  title: string;
  date: string;
  transcript?: string;
  audio_file?: File;
  entity_ids?: number[];
  meeting_type_slug?: string;
}

export interface ProcessingResult {
  transcript: string;
  summary: string;
  entities: string[];
  action_items: string[];
}