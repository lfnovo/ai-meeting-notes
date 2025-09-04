# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a full-stack AI-powered meeting minutes application that processes meeting recordings/transcripts to automatically generate summaries, extract entities, and create action items using OpenAI's API.

**Stack:** FastAPI (Python) backend + React TypeScript frontend with Shadcn UI components.

**Key Features:** Meeting processing, entity extraction and management, entity cleanup tools, and comprehensive search capabilities.

## Development Commands

### Setup and Development
```bash
make install          # Install all dependencies
make init            # Initialize database
make dev             # Start both backend and frontend (recommended)
make backend         # Start FastAPI server only (port 8000)
make frontend        # Start React dev server only (port 3000)
```

### Backend Development
```bash
uv run python run_backend.py      # Start backend server
uv run pytest                     # Run tests
uv run black .                     # Format code
uv run mypy .                      # Type checking
```

### Frontend Development
```bash
cd frontend && npm run dev         # Start dev server
cd frontend && npm run build       # Production build
cd frontend && npm run lint        # ESLint
cd frontend && npm run type-check  # TypeScript checking
```

## Architecture

### Backend Structure
- **Database Layer**: Custom `DatabaseManager` class in `database.py` with async SQLite operations and connection pooling
- **Service Layer**: Business logic separated into dedicated services:
  - `meeting_processor.py`: OpenAI API integration for transcription and content extraction
  - `entity_manager.py`: Entity relationship management
- **API Layer**: Single `routes.py` file contains all FastAPI endpoints with `/api/v1/` prefix
- **Models**: Pydantic v2 models in `models.py` for type-safe API contracts

### Frontend Structure  
- **Modern React**: Uses React 19 with TypeScript, React Router v7, and TanStack Query
- **UI Components**: Shadcn UI components in `components/ui/` with Tailwind CSS
- **Pages**: Route components in `pages/` directory
- **Types**: TypeScript interfaces in `types/index.ts` mirror backend Pydantic models
- **State Management**: TanStack Query for server state, React hooks for local state

### Database Schema
Core tables: `meetings`, `entities`, `entity_types`, `meeting_types`, `action_items`, `meeting_entities` (junction table)

The app uses a dynamic entity type system where entity types can be customized through the admin interface.

## Key Patterns

### Backend
- Use `uv` for all Python package management and script running
- Database operations go through `DatabaseManager` class methods
- OpenAI processing happens in `meeting_processor.py` service
- All API endpoints follow RESTful conventions with proper HTTP status codes

### Frontend  
- Components use Shadcn UI patterns with `cn()` utility for conditional classes
- Server state managed by TanStack Query with proper cache invalidation
- Forms use controlled components with TypeScript interfaces
- API calls centralized in custom hooks

### Environment Configuration
- Backend uses `.env` file with `python-dotenv`
- OpenAI API key required for AI processing features
- Upload directory configurable via environment variables

## Development Notes

- Frontend proxy routes `/api/*` to backend during development
- Database is SQLite with async operations using aiosqlite
- File uploads stored in `uploads/` directory with static file serving
- Both frontend and backend support hot reloading
- Type checking enforced on both ends with matching interfaces/models