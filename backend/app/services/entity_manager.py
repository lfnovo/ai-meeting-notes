import re
from typing import List, Dict, Optional, Tuple
from difflib import SequenceMatcher

from loguru import logger

from ..models import Entity, EntityTypeModel, EntityCreate
from ..database import DatabaseManager


class EntityManager:
    """Service for managing entities and their relationships"""
    
    def __init__(self):
        self.similarity_threshold = 0.8  # Threshold for entity name similarity
    
    async def process_entities(
        self, 
        entity_names: List[str], 
        meeting_id: int, 
        db: DatabaseManager
    ) -> List[Entity]:
        """
        Process a list of entity names (potentially with type information), 
        create new ones if needed, and associate them with the meeting
        """
        processed_entities = []
        
        for entity_line in entity_names:
            if not entity_line or len(entity_line.strip()) < 2:
                continue
                
            entity_line = entity_line.strip()
            
            # Parse structured entity format: "Name|Type" or just "Name"
            if '|' in entity_line:
                parts = entity_line.split('|', 1)
                name = parts[0].strip()
                suggested_type = parts[1].strip().lower()
            else:
                name = entity_line
                suggested_type = None
            
            if not name or len(name) < 2:
                continue
            
            # Try to find existing entity
            existing_entity = await self.find_similar_entity(name, db)
            
            if existing_entity:
                logger.info(f"Found existing entity: {existing_entity.name}")
                processed_entities.append(existing_entity)
                # Associate with meeting
                await db.add_entity_to_meeting(meeting_id, existing_entity.id)
            else:
                # Create new entity with improved type classification
                entity_type_slug = await self.determine_entity_type(name, suggested_type, db)
                
                new_entity = await db.create_entity(EntityCreate(
                    name=name,
                    type_slug=entity_type_slug,
                    description=f"Automatically extracted from meeting"
                ))
                logger.info(f"Created new entity: {new_entity.name} ({new_entity.type_slug})")
                processed_entities.append(new_entity)
                # Associate with meeting
                await db.add_entity_to_meeting(meeting_id, new_entity.id)
        
        return processed_entities
    
    async def find_similar_entity(self, name: str, db: DatabaseManager) -> Optional[Entity]:
        """Find an existing entity with a similar name"""
        try:
            # Get all entities to check for similarity
            all_entities = await db.get_entities(limit=1000)
            
            best_match = None
            best_similarity = 0
            
            for entity in all_entities:
                similarity = self.calculate_similarity(name.lower(), entity.name.lower())
                
                if similarity > best_similarity and similarity >= self.similarity_threshold:
                    best_similarity = similarity
                    best_match = entity
            
            if best_match:
                logger.info(f"Found similar entity: '{name}' -> '{best_match.name}' (similarity: {best_similarity:.2f})")
            
            return best_match
            
        except Exception as e:
            logger.error(f"Error finding similar entity: {e}")
            return None
    
    def calculate_similarity(self, name1: str, name2: str) -> float:
        """Calculate similarity between two entity names"""
        # Exact match
        if name1 == name2:
            return 1.0
        
        # Check if one is contained in the other (for names like "John" vs "John Smith")
        if name1 in name2 or name2 in name1:
            shorter = min(name1, name2, key=len)
            longer = max(name1, name2, key=len)
            if len(shorter) >= 3:  # Minimum length for partial matches
                return len(shorter) / len(longer)
        
        # Use sequence matcher for fuzzy matching
        return SequenceMatcher(None, name1, name2).ratio()
    
    async def determine_entity_type(self, name: str, suggested_type: Optional[str], db: DatabaseManager) -> str:
        """
        Determine the entity type using LLM suggestion and fallback to classification
        """
        # If we have a suggested type from LLM, try to map it to existing entity types
        if suggested_type:
            # Map LLM suggested types to our entity type slugs
            type_mapping = {
                'person': 'person',
                'company': 'company',
                'project': 'project',
                'product': 'project',  # Map product to project for now
                'tool': 'other',  # Map tool to other for now
                'other': 'other'
            }
            
            mapped_type = type_mapping.get(suggested_type, None)
            if mapped_type:
                # Check if the mapped type exists in the database
                entity_type = await db.get_entity_type_by_slug(mapped_type)
                if entity_type:
                    logger.info(f"Using LLM-suggested type '{suggested_type}' -> '{mapped_type}' for entity: {name}")
                    return mapped_type
        
        # Fallback to existing classification logic
        entity_type_slug = self.classify_entity_type(name)
        
        # Check if the classified type exists
        entity_type = await db.get_entity_type_by_slug(entity_type_slug)
        if not entity_type:
            # Default to 'other' if type doesn't exist
            entity_type_slug = 'other'
        
        logger.info(f"Using classified type '{entity_type_slug}' for entity: {name}")
        return entity_type_slug
    
    def classify_entity_type(self, name: str) -> str:
        """Classify an entity type based on its name and return the type slug"""
        name_lower = name.lower()
        
        # Common patterns for different entity types
        person_indicators = [
            # Common first names (partial list)
            'john', 'jane', 'mike', 'sarah', 'david', 'lisa', 'chris', 'amy', 
            'robert', 'jennifer', 'michael', 'jessica', 'william', 'ashley',
            'james', 'emily', 'alex', 'maria', 'daniel', 'anna', 'paul', 'emma',
            'mark', 'stephanie', 'kevin', 'michelle', 'brian', 'laura', 'steve',
            'nicole', 'tom', 'elizabeth', 'joe', 'helen', 'tim', 'rachel'
        ]
        
        company_indicators = [
            'inc', 'llc', 'corp', 'corporation', 'company', 'ltd', 'limited',
            'group', 'enterprises', 'solutions', 'services', 'systems', 'tech',
            'technologies', 'software', 'consulting', 'partners', 'associates'
        ]
        
        project_indicators = [
            'project', 'initiative', 'program', 'campaign', 'launch', 'rollout',
            'implementation', 'migration', 'upgrade', 'deployment', 'phase',
            'sprint', 'release', 'version', 'beta', 'alpha'
        ]
        
        # Check for person indicators
        words = re.findall(r'\b\w+\b', name_lower)
        
        # If it's a single word that matches a common first name
        if len(words) == 1 and words[0] in person_indicators:
            return 'person'
        
        # If it contains typical person name patterns
        if len(words) == 2 and any(word in person_indicators for word in words):
            return 'person'
        
        # Check for company indicators
        if any(indicator in name_lower for indicator in company_indicators):
            return 'company'
        
        # Check for project indicators
        if any(indicator in name_lower for indicator in project_indicators):
            return 'project'
        
        # If name has typical capitalization pattern for person names
        if self.has_person_name_pattern(name):
            return 'person'
        
        # If it's all caps or has Inc/LLC etc, likely a company
        if name.isupper() or any(word in name for word in ['Inc', 'LLC', 'Corp']):
            return 'company'
        
        # Default to OTHER for ambiguous cases
        return 'other'
    
    def has_person_name_pattern(self, name: str) -> bool:
        """Check if a name follows typical person name capitalization patterns"""
        words = name.split()
        
        # Single word names are ambiguous
        if len(words) == 1:
            return False
        
        # Two words, both capitalized (First Last)
        if len(words) == 2:
            return all(word[0].isupper() and word[1:].islower() for word in words if len(word) > 0)
        
        # Three words might be First Middle Last
        if len(words) == 3:
            return all(word[0].isupper() and word[1:].islower() for word in words if len(word) > 1)
        
        return False
    
    async def suggest_entity_merge(self, db: DatabaseManager) -> List[Tuple[Entity, Entity, float]]:
        """Suggest potential entity merges based on similarity"""
        try:
            all_entities = await db.get_entities(limit=1000)
            suggestions = []
            
            for i, entity1 in enumerate(all_entities):
                for entity2 in all_entities[i+1:]:
                    if entity1.type_slug == entity2.type_slug:  # Only suggest merging same types
                        similarity = self.calculate_similarity(
                            entity1.name.lower(), 
                            entity2.name.lower()
                        )
                        
                        # Suggest merges for high similarity but below auto-merge threshold
                        if 0.6 <= similarity < self.similarity_threshold:
                            suggestions.append((entity1, entity2, similarity))
            
            # Sort by similarity descending
            suggestions.sort(key=lambda x: x[2], reverse=True)
            
            return suggestions[:10]  # Return top 10 suggestions
            
        except Exception as e:
            logger.error(f"Error generating merge suggestions: {e}")
            return []
    
    async def merge_entities(
        self, 
        source_entity_id: int, 
        target_entity_id: int, 
        db: DatabaseManager
    ) -> bool:
        """Merge two entities (move all relationships to target, delete source)"""
        try:
            # Get both entities
            source = await db.get_entity_by_id(source_entity_id)
            target = await db.get_entity_by_id(target_entity_id)
            
            if not source or not target:
                return False
            
            # Get all meetings associated with source entity
            source_meetings = await db.get_meetings_by_entity(source_entity_id)
            
            # Associate all source meetings with target entity
            for meeting in source_meetings:
                await db.add_entity_to_meeting(meeting.id, target_entity_id)
                await db.remove_entity_from_meeting(meeting.id, source_entity_id)
            
            # Delete source entity
            await db.delete_entity(source_entity_id)
            
            logger.info(f"Merged entity '{source.name}' into '{target.name}'")
            return True
            
        except Exception as e:
            logger.error(f"Error merging entities: {e}")
            return False