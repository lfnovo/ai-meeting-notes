# Meeting Minutes App

A FastAPI-based application for processing meeting recordings and transcripts to generate structured meeting minutes.

## Features

- **Meeting Processing**: Upload audio recordings or transcripts to extract summaries, entities, and action items
- **Entity Management**: Track and manage entities (people, companies, projects) across meetings
- **Entity Cleanup**: Identify and bulk delete orphaned entities (those with 0 or 1 meeting associations)
- **Meeting Feed**: Browse meetings chronologically with summaries
- **Entity Relationships**: View all meetings associated with specific entities

## Tech Stack

### Backend
- FastAPI (Python web framework)
- SQLite database with abstraction layer
- OpenAI SDK for transcript processing and summarization
- Pydantic for data validation

### Frontend
- React with TypeScript
- Shadcn UI components
- Tailwind CSS

## Quick Start

1. **Install dependencies**:
   ```bash
   uv sync
   ```

2. **Add your OpenAI API key** to `.env`:
   ```bash
   OPENAI_API_KEY=sk-your-openai-api-key-here
   ```

3. **Initialize database**:
   ```bash
   uv run python init_db.py
   ```

4. **Start backend**:
   ```bash
   uv run python run_backend.py
   ```

5. **Start frontend** (new terminal):
   ```bash
   cd frontend && npm install && npm run dev
   ```

Visit http://localhost:3000 to use the app!

## API Endpoints

### Meetings
- `GET /api/v1/meetings` - List all meetings
- `POST /api/v1/meetings` - Create and process a new meeting
- `GET /api/v1/meetings/{id}` - Get meeting details

### Entities
- `GET /api/v1/entities` - List all entities
- `POST /api/v1/entities` - Create a new entity
- `GET /api/v1/entities/{id}/meetings` - Get meetings for an entity
- `GET /api/v1/entities/orphaned` - Get entities with 0 or 1 meeting associations
- `POST /api/v1/entities/bulk-delete` - Delete multiple entities

## Development

- **Run tests**: `uv run pytest`
- **Format code**: `uv run black .`
- **Type checking**: `uv run mypy .`

## Database Schema

- **meetings**: id, title, date, transcript, summary, created_at
- **entities**: id, name, type, description, created_at
- **action_items**: id, meeting_id, description, assignee, due_date, status
- **meeting_entities**: meeting_id, entity_id (many-to-many relationship)