# Meeting Minutes App - Setup Guide

## Quick Start

### 1. Install Dependencies

```bash
cd meeting-minutes-app
uv sync
```

### 2. Configure Environment

Edit the `.env` file and add your OpenAI API key:

```bash
# Replace with your actual OpenAI API key
OPENAI_API_KEY=sk-your-openai-api-key-here
```

### 3. Initialize Database

```bash
uv run python init_db.py
```

### 4. Start Backend

```bash
uv run python run_backend.py
```

The backend will start on http://localhost:8000
- API Documentation: http://localhost:8000/docs
- Health Check: http://localhost:8000/health

### 5. Start Frontend (In a new terminal)

```bash
cd frontend
npm install
npm run dev
```

The frontend will start on http://localhost:3000

## Manual Setup (Alternative)

If you prefer to run without the helper scripts:

### Backend
```bash
cd backend
uv run uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend
```bash
cd frontend
npm run dev
```

## Features

- ✅ Upload audio files for transcription
- ✅ Process meeting transcripts with AI
- ✅ Extract entities (people, companies, projects)
- ✅ Generate summaries and action items
- ✅ Browse meetings in a feed view
- ✅ Manage entities and their relationships

## API Endpoints

- `GET /api/v1/meetings` - List all meetings
- `POST /api/v1/meetings/process` - Process a new meeting
- `GET /api/v1/entities` - List all entities
- `POST /api/v1/entities` - Create a new entity

## Troubleshooting

### Backend Issues
- Make sure you have uv installed: `curl -LsSf https://astral.sh/uv/install.sh | sh`
- Check your OpenAI API key is valid
- Ensure port 8000 is not in use

### Frontend Issues
- Make sure Node.js is installed
- Check port 3000 is not in use
- Verify the backend is running on port 8000

### Database Issues
- Delete `meetings.db` and run `uv run python init_db.py` again
- Check file permissions in the project directory