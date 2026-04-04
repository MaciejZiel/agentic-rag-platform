# Agentic RAG Platform

AI-powered document intelligence platform. Upload documents, index them with vector embeddings, ask grounded questions with source citations, and extract structured data — all through a clean REST API.

## Architecture

```
┌─────────────┐     ┌──────────┐     ┌──────────┐
│  FastAPI     │────▶│ Postgres │     │  Qdrant  │
│  API Server  │     │  (data)  │     │ (vectors)│
└──────┬──────┘     └──────────┘     └──────────┘
       │                                   ▲
       │            ┌──────────┐           │
       └───────────▶│  Redis   │───────────┘
                    │ (broker) │
                    └────┬─────┘
                         │
                    ┌────▼─────┐     ┌────────────┐
                    │  Celery  │────▶│ OpenRouter  │
                    │  Worker  │     │   (LLM)    │
                    └──────────┘     └────────────┘
```

**Layers:**
- `app/api/` — FastAPI route handlers
- `app/services/` — Business logic (document, QA, extraction, job)
- `app/repositories/` — Database access (SQLAlchemy async)
- `app/clients/` — External service clients (OpenRouter LLM, Qdrant)
- `app/workers/` — Celery tasks for background processing
- `app/models/` — SQLAlchemy ORM models
- `app/schemas/` — Pydantic request/response schemas
- `app/utils/` — Text extraction, chunking

## Tech Stack

- **Python 3.12**, **FastAPI**, **Pydantic v2**
- **PostgreSQL 16** — document metadata, jobs, queries
- **Qdrant** — vector storage and similarity search
- **Redis** — Celery broker
- **Celery** — async job execution
- **OpenRouter** — LLM API (OpenAI-compatible, any model)
- **Alembic** — database migrations
- **Docker Compose** — local dev environment

## Quick Start

### 1. Clone and configure

```bash
cp .env.example .env
# Edit .env and set OPENROUTER_API_KEY
```

### 2. Start services

```bash
docker compose up -d
```

### 3. Run migrations

```bash
docker compose exec api alembic upgrade head
```

### 4. Use the API

API docs: http://localhost:8000/docs

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/health` | Health check |
| `POST` | `/api/v1/documents/upload` | Upload a document |
| `POST` | `/api/v1/documents/{id}/index` | Start indexing |
| `GET` | `/api/v1/documents` | List documents |
| `GET` | `/api/v1/documents/{id}` | Get document details |
| `POST` | `/api/v1/qa/ask` | Ask a question (RAG) |
| `POST` | `/api/v1/qa/ask/stream` | Ask with SSE streaming |
| `POST` | `/api/v1/extract/json` | Structured extraction |
| `POST` | `/api/v1/jobs` | Create async job |
| `GET` | `/api/v1/jobs/{id}` | Get job status |

## Example Requests

### Upload a document

```bash
curl -X POST http://localhost:8000/api/v1/documents/upload \
  -F "file=@document.pdf"
```

### Index a document

```bash
curl -X POST http://localhost:8000/api/v1/documents/{document_id}/index
```

### Ask a question

```bash
curl -X POST http://localhost:8000/api/v1/qa/ask \
  -H "Content-Type: application/json" \
  -d '{
    "question": "What are the main findings?",
    "document_ids": ["<document-uuid>"],
    "top_k": 5
  }'
```

### Stream an answer

```bash
curl -N http://localhost:8000/api/v1/qa/ask/stream \
  -H "Content-Type: application/json" \
  -d '{
    "question": "Summarize the key points",
    "top_k": 3
  }'
```

### Extract structured data

```bash
curl -X POST http://localhost:8000/api/v1/extract/json \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "<document-uuid>",
    "schema_definition": {
      "type": "object",
      "properties": {
        "title": {"type": "string"},
        "authors": {"type": "array", "items": {"type": "string"}},
        "date": {"type": "string"}
      }
    }
  }'
```

### Create an async job

```bash
curl -X POST http://localhost:8000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "job_type": "index_document",
    "payload": {"document_id": "<document-uuid>"}
  }'
```

## Development

### Run without Docker

```bash
pip install -e ".[dev]"
uvicorn app.main:app --reload
celery -A app.workers.celery_app worker --loglevel=info
```

### Run tests

```bash
pip install aiosqlite  # needed for test SQLite backend
pytest -v
```

### Lint

```bash
ruff check .
mypy app/
```

## Supported File Types

- PDF (`.pdf`)
- DOCX (`.docx`)
- Plain text (`.txt`)
- Markdown (`.md`)

## Future Improvements

- Authentication and multi-tenancy
- Document deletion with vector cleanup
- Conversation history for multi-turn QA
- Configurable chunking strategies
- Webhook notifications for job completion
- Rate limiting and API keys
- Monitoring with Prometheus/Grafana
- Caching frequently asked questions
