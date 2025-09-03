.PHONY: install init backend frontend dev help

help:
	@echo "Meeting Minutes App - Available Commands:"
	@echo ""
	@echo "  make install   - Install all dependencies"
	@echo "  make init      - Initialize the database"
	@echo "  make backend   - Start the backend server"
	@echo "  make frontend  - Start the frontend dev server"
	@echo "  make dev       - Start both backend and frontend"
	@echo ""
	@echo "Setup steps:"
	@echo "  1. Add your OpenAI API key to .env file"
	@echo "  2. make install"
	@echo "  3. make init"
	@echo "  4. make dev"

install:
	@echo "📦 Installing backend dependencies..."
	uv sync
	@echo "📦 Installing frontend dependencies..."
	cd frontend && npm install
	@echo "✅ All dependencies installed!"

init:
	@echo "🗃️ Initializing database..."
	uv run python init_db.py

backend:
	@echo "🚀 Starting backend server..."
	uv run python run_backend.py

frontend:
	@echo "🌐 Starting frontend dev server..."
	cd frontend && npm run dev

dev:
	@echo "🚀 Starting both backend and frontend..."
	@echo "Backend will start on http://localhost:8000"
	@echo "Frontend will start on http://localhost:3000"
	@echo ""
	@echo "Press Ctrl+C to stop both servers"
	@(trap 'kill 0' SIGINT; uv run python run_backend.py & cd frontend && npm run dev)