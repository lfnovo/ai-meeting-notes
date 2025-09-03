import os
from typing import List, Optional
from pathlib import Path

from openai import AsyncOpenAI
from loguru import logger
from pydantic import BaseModel

from ..models import ProcessingResult, MeetingType


class MeetingProcessor:
    """Service for processing meetings using OpenAI"""
    
    def __init__(self):
        self.client = AsyncOpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    
    async def process_meeting(
        self, 
        transcript: Optional[str] = None,
        audio_file_path: Optional[str] = None,
        meeting_type: Optional[MeetingType] = None
    ) -> ProcessingResult:
        """
        Process a meeting from transcript or audio file
        Returns summary, entities, and action items
        """
        # Get transcript from audio if not provided
        if not transcript and audio_file_path:
            transcript = await self.transcribe_audio(audio_file_path)
        
        if not transcript:
            raise ValueError("Either transcript or audio file must be provided")
        
        # Generate summary, entities, and action items using custom instructions if available
        summary = await self.generate_summary(transcript, meeting_type)
        entities = await self.extract_entities(transcript, meeting_type)
        action_items = await self.extract_action_items(transcript, meeting_type)
        
        return ProcessingResult(
            transcript=transcript,
            summary=summary,
            entities=entities,
            action_items=action_items
        )
    
    async def transcribe_audio(self, audio_file_path: str) -> str:
        """Transcribe audio file using OpenAI Whisper"""
        try:
            logger.info(f"Transcribing audio file: {audio_file_path}")
            
            with open(audio_file_path, "rb") as audio_file:
                transcript = await self.client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            
            logger.success(f"Audio transcribed successfully, length: {len(transcript)} characters")
            return transcript
            
        except Exception as e:
            logger.error(f"Error transcribing audio: {e}")
            raise Exception(f"Failed to transcribe audio: {e}")
    
    async def generate_summary(self, transcript: str, meeting_type: Optional[MeetingType] = None) -> str:
        """Generate a meeting summary using GPT"""
        try:
            logger.info("Generating meeting summary")
            
            # Build system prompt with custom instructions if available
            system_prompt = self._build_summary_prompt(meeting_type)
            
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": f"Please summarize this meeting transcript:\n\n{transcript}"
                    }
                ],
                temperature=0.3,
                max_tokens=700
            )
            
            summary = response.choices[0].message.content.strip()
            logger.success(f"Summary generated, length: {len(summary)} characters")
            return summary
            
        except Exception as e:
            logger.error(f"Error generating summary: {e}")
            raise Exception(f"Failed to generate summary: {e}")
    
    def _build_summary_prompt(self, meeting_type: Optional[MeetingType] = None) -> str:
        """Build the system prompt for summary generation"""
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
    
    async def extract_entities(self, transcript: str, meeting_type: Optional[MeetingType] = None) -> List[str]:
        """Extract entities (people, companies, projects) from the transcript"""
        try:
            logger.info("Extracting entities from transcript")
            
            # Build system prompt with custom instructions if available
            system_prompt = self._build_entity_prompt(meeting_type)
            
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user",
                        "content": f"Extract entities from this meeting transcript:\n\n{transcript}"
                    }
                ],
                temperature=0.1,
                max_tokens=300
            )
            
            entities_text = response.choices[0].message.content.strip()
            entities = [entity.strip() for entity in entities_text.split('\n') if entity.strip()]
            
            logger.success(f"Extracted {len(entities)} entities")
            return entities
            
        except Exception as e:
            logger.error(f"Error extracting entities: {e}")
            raise Exception(f"Failed to extract entities: {e}")
    
    def _build_entity_prompt(self, meeting_type: Optional[MeetingType] = None) -> str:
        """Build the system prompt for entity extraction"""
        base_prompt = """You are an expert at extracting entities from meeting transcripts. 

        Extract and return a list of important entities mentioned in the meeting, including:
        - People's names (colleagues, clients, stakeholders)
        - Company names
        - Project names
        - Product names
        - Important tools or systems mentioned
        
        Rules:
        - Return each entity in the format "EntityName|EntityType" where EntityType is one of: Person, Company, Project, Product, Tool, Other
        - Use the exact name as mentioned in the transcript
        - Don't include common words or generic terms
        - Focus on proper nouns and specific named entities
        - If a person's full name isn't given, use what's provided (e.g., "John|Person" if that's all that's mentioned)
        - If you're unsure of the type, use "Other"
        
        Examples:
        - John Smith|Person
        - Microsoft|Company
        - Project Alpha|Project
        - Slack|Tool
        - iPhone 15|Product
        
        Return only the entity names with types, one per line, no explanations or formatting."""
        
        if meeting_type and meeting_type.entity_instructions:
            custom_instructions = f"\n\nCustom instructions for this meeting type:\n{meeting_type.entity_instructions}"
            return base_prompt + custom_instructions
        
        return base_prompt
    
    async def extract_action_items(self, transcript: str, meeting_type: Optional[MeetingType] = None) -> List[str]:
        """Extract action items from the transcript"""
        try:
            logger.info("Extracting action items from transcript")
            
            # Build system prompt with custom instructions if available
            system_prompt = self._build_action_items_prompt(meeting_type)
            
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": system_prompt
                    },
                    {
                        "role": "user", 
                        "content": f"Extract action items from this meeting transcript:\n\n{transcript}"
                    }
                ],
                temperature=0.1,
                max_tokens=400
            )
            
            action_items_text = response.choices[0].message.content.strip()
            action_items = [item.strip() for item in action_items_text.split('\n') if item.strip()]
            
            logger.success(f"Extracted {len(action_items)} action items")
            return action_items
            
        except Exception as e:
            logger.error(f"Error extracting action items: {e}")
            raise Exception(f"Failed to extract action items: {e}")
    
    def _build_action_items_prompt(self, meeting_type: Optional[MeetingType] = None) -> str:
        """Build the system prompt for action item extraction"""
        base_prompt = """You are an expert at extracting action items from meeting transcripts.

        Extract all action items, tasks, and follow-up items mentioned in the meeting.
        
        For each action item, include:
        - What needs to be done
        - Who is responsible (if mentioned)
        - When it should be done (if mentioned)
        
        Format each action item as a clear, actionable statement.
        
        Examples:
        - "John will send the project proposal to the client by Friday"
        - "Review the budget document and provide feedback"
        - "Sarah to schedule follow-up meeting with stakeholders"
        
        Return only the action items, one per line, no explanations or formatting."""
        
        if meeting_type and meeting_type.action_item_instructions:
            custom_instructions = f"\n\nCustom instructions for this meeting type:\n{meeting_type.action_item_instructions}"
            return base_prompt + custom_instructions
        
        return base_prompt
    
    async def suggest_meeting_title(self, transcript: str) -> str:
        """Suggest a meeting title based on the transcript"""
        try:
            logger.info("Generating meeting title suggestion")
            
            response = await self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=[
                    {
                        "role": "system",
                        "content": """Generate a concise, descriptive title for this meeting based on the transcript.
                        
                        The title should:
                        - Be 3-8 words long
                        - Capture the main purpose or topic
                        - Be professional and clear
                        - Not include dates or meeting-specific words like "Meeting"
                        
                        Examples:
                        - "Q1 Budget Planning Discussion"
                        - "Product Launch Strategy Review"
                        - "Client Onboarding Process"
                        
                        Return only the title, no explanations."""
                    },
                    {
                        "role": "user",
                        "content": f"Generate a title for this meeting:\n\n{transcript[:1000]}..."
                    }
                ],
                temperature=0.3,
                max_tokens=50
            )
            
            title = response.choices[0].message.content.strip().strip('"')
            logger.success(f"Generated title: {title}")
            return title
            
        except Exception as e:
            logger.error(f"Error generating title: {e}")
            return "Meeting Summary"