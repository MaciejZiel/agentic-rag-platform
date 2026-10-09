# Agentic RAG Platform (Cortex)

**Upload documents, ask questions about them, and get answers that cite the exact chunks they came from.** A multi-tenant FastAPI backend with Qdrant vector search, PostgreSQL, Redis caching and a React dashboard.

[![CI](https://github.com/MaciejZiel/agentic-rag-platform/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/MaciejZiel/agentic-rag-platform/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Python 3.12+](https://img.shields.io/badge/python-3.12%2B-3776AB?logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-009688?logo=fastapi&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)

![Chat with cited sources](docs/chat.png)

<sub>Local run with three sample documents. To capture it without an API key, OpenRouter was swapped for a small OpenAI-compatible stub through `OPENROUTER_BASE_URL`; chunking, embedding storage in Qdrant, retrieval, the streamed response and the source chips are the real pipeline.</sub>

| Documents | Interactive API docs |
|---|---|
| ![Documents page](docs/documents.png) | ![Swagger UI](docs/api-docs.png) |

## What it does

- **Document ingestion**: upload PDF, DOCX, TXT or Markdown, split it into chunks (fixed-size with overlap, sentence or paragraph strategy, counted with `tiktoken`), embed the chunks and store them in Qdrant.
- **Grounded Q&A**: retrieve the top-k chunks for a question, answer with `[Source N]` citations, stream tokens over SSE, keep multi-turn context (last 10 messages) and let the user pick the model per question.
- **Structured extraction**: turn a document into JSON that follows a user-supplied JSON schema.
- **Accounts and tenants**: email + password sign-up with a 6-digit verification code, JWT access/refresh tokens for the UI and `X-API-Key` keys for scripts, both resolving to a tenant.
- **Operations**: rate limits (slowapi), Redis answer cache, HMAC-SHA256-signed webhooks, Prometheus `/metrics`, structured logging (structlog) and security headers.

The API has 60 operations across 46 paths; the full list is in Swagger UI at `/docs`.

## Architecture

```mermaid
flowchart LR
    UI[React + Vite UI] -->|JWT| API[FastAPI]
    Client[Scripts] -->|X-API-Key| API
    API --> PG[(PostgreSQL<br/>users, tenants, documents,<br/>chunks, conversations, usage)]
    API --> QD[(Qdrant<br/>chunk vectors)]
    API --> RD[(Redis<br/>answer cache, Celery broker)]
    API -->|embeddings + chat| OR[OpenRouter<br/>OpenAI-compatible API]
    RD --> W[Celery worker<br/>background jobs]
    W --> PG
    W --> QD
    API -.->|/metrics| PR[Prometheus + Grafana]
```

A question goes through `QAService`: check the Redis cache (only for new conversations), embed the question, search Qdrant (optionally limited to selected documents), load the matching chunks from PostgreSQL, build a prompt with numbered sources plus conversation history, call the model, then store the messages, token usage and estimated cost.

## Tech stack

| Layer | Tools |
|---|---|
| API | Python 3.12+, FastAPI, Pydantic v2, SQLAlchemy 2 (async, asyncpg), Alembic |
| Retrieval | Qdrant, OpenRouter through the `openai` SDK (`text-embedding-3-small`, chat model chosen per request), `tiktoken`, PyMuPDF, python-docx |
| Infrastructure | PostgreSQL 16, Redis 7, Celery, Docker Compose, Kubernetes manifests in `k8s/` |
| Auth & security | PyJWT, bcrypt, API keys, slowapi rate limits, CSP and other security headers |
| Observability | structlog, prometheus-fastapi-instrumentator, Prometheus, Grafana |
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui, Recharts, i18next (EN/PL), Vitest |

## Quick start

Requirements: Docker, Python 3.12+, Node.js 22+, and an [OpenRouter](https://openrouter.ai) API key for indexing and answering (upload, auth and the UI work without it).

```bash
git clone https://github.com/MaciejZiel/agentic-rag-platform.git
cd agentic-rag-platform
cp .env.example .env                    # set OPENROUTER_API_KEY; RESEND_API_KEY is optional

docker compose up -d postgres redis qdrant
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
alembic upgrade head
uvicorn app.main:app --reload --port 8000
```

In a second terminal:

```bash
cd frontend
npm ci
npm run dev                             # http://localhost:3000, proxies /api to :8000
```

Open http://localhost:3000 and register. Without `RESEND_API_KEY` no email is sent; read the verification code from the database:

```bash
docker compose exec postgres psql -U rag_user -d rag_platform \
  -c "SELECT email, email_verification_code FROM users ORDER BY created_at DESC LIMIT 1;"
```

Swagger UI is at http://localhost:8000/docs and a set of ready-made requests is in [`examples/requests.http`](examples/requests.http). `docker compose up -d` without service names also builds the API and Celery worker images and starts Prometheus (:9090) and Grafana (:3001).

## Tests

```bash
pip install aiosqlite                   # the API tests run against SQLite
python -m pytest tests/ --cov=app       # 56 tests
cd frontend && npm test                 # 39 tests (Vitest)
```

The backend tests drive the FastAPI app through `httpx.AsyncClient` with the LLM client and the vector store replaced by mocks, so they need no API keys or running services. Line coverage of `app/` is about 61%; the upload/index/ask flow, auth validation, chunking and text extraction are covered, while the Celery tasks and several admin endpoints are not yet.

CI (GitHub Actions) runs the backend tests, applies every Alembic migration to a real PostgreSQL 16 and runs `alembic check` to fail on drift between models and migrations, then type-checks, builds and tests the frontend.

## Key technical decisions

- **Qdrant next to PostgreSQL instead of pgvector.** PostgreSQL stays the source of truth for documents and chunk text; Qdrant only holds vectors with a `document_id` payload. That keeps similarity search out of the transactional database, at the cost of two stores to keep consistent, so re-indexing first deletes old chunks and vectors, and deleting a document removes both.
- **OpenRouter through the OpenAI SDK.** One `AsyncOpenAI` client with a different `base_url` gives access to OpenAI, Anthropic, Google, Meta and DeepSeek models, and the model is a per-request parameter. The trade-off is one more hop and a provider dependency; embeddings stay fixed to one model because vectors from different models cannot be mixed in one collection.
- **Cache only stateless questions.** The Redis key is a SHA-256 of question, selected document IDs and model, with a 1-hour TTL. Follow-ups inside a conversation skip the cache because the answer depends on history. Cache errors are logged and ignored, so Redis being down slows answers down instead of breaking them.
- **Two auth paths, one tenant.** The UI uses short-lived JWTs with refresh tokens; integrations use API keys. Both resolve to the same `Tenant` dependency, so route handlers do not care which one was used.

## Limitations and next steps

- **Tenant scoping is incomplete on the Q&A path.** Documents, conversation endpoints and query history filter by tenant, but Qdrant search filters only by document IDs, conversations created by `/qa` are stored without a `tenant_id`, and `/stats` aggregates across tenants. Next step: store `tenant_id` in the Qdrant payload, filter on it and pass the tenant through `QAService`.
- Indexing via `POST /documents/{id}/index` runs inside the request; large files should go through the existing Celery job endpoint (`POST /jobs`) by default.
- Cost estimates use a small price table (GPT-4o, GPT-4o mini, the embedding model); other models report a cost of 0.
- The settings page has a 2FA (TOTP) setup UI, but the backend has no enrolment endpoint yet and `pyotp` is not a declared dependency.
- The automated tests use SQLite; only migrations are exercised against PostgreSQL in CI.

## License

Released under the [MIT License](LICENSE).
