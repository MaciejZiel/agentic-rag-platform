# Agentic RAG Platform

[![CI](https://github.com/MaciejZiel/agentic-rag-platform/actions/workflows/ci.yml/badge.svg?branch=master)](https://github.com/MaciejZiel/agentic-rag-platform/actions/workflows/ci.yml)

AI-powered document intelligence platform with a full-featured React frontend. Upload documents, index them with vector embeddings, ask grounded questions with source citations, extract structured data, and manage everything through a modern web UI.

## Architecture

```
┌──────────────────┐
│   React Frontend  │  (Vite + shadcn/ui + Tailwind)
│   Cloudflare Pages│
└────────┬─────────┘
         │ JWT / API Key
┌────────▼─────────┐     ┌──────────┐     ┌──────────┐
│     FastAPI       │────▶│ Postgres │     │  Qdrant  │
│     API Server    │     │  (data)  │     │ (vectors)│
└──┬─────┬─────┬──┘     └──────────┘     └──────────┘
   │     │     │
   │     │     │         ┌──────────┐     ┌────────────┐
   │     │     └────────▶│  Redis   │     │ OpenRouter  │
   │     │               │ (cache)  │     │   (LLM)    │
   │     └──────────────────────────────▶└────────────┘
   │
   │  ┌──────────┐     ┌──────────┐
   └─▶│  Resend  │     │Prometheus│
      │ (emails) │     │+ Grafana │
      └──────────┘     └──────────┘
```

## Tech Stack

### Backend
- **Python 3.12**, **FastAPI**, **Pydantic v2**
- **PostgreSQL 16** — users, tenants, documents, conversations, queries
- **Qdrant** — vector storage and similarity search
- **Redis** — QA response caching (1h TTL)
- **OpenRouter** — LLM API (OpenAI-compatible, 8 models available)
- **Alembic** — database migrations
- **JWT + bcrypt** — authentication with access/refresh tokens
- **Resend** — transactional email (verification codes)
- **Prometheus + Grafana** — monitoring and metrics

### Frontend
- **React 19** + **TypeScript** + **Vite**
- **shadcn/ui** — component library (30+ components)
- **Tailwind CSS v4** — styling with dark/light/system themes
- **React Router** — client-side routing (7 pages)

## Features

### Implemented
- **Authentication** — email + password registration, email verification (6-digit code), JWT access/refresh tokens, dual auth (JWT + API key)
- **Multi-tenancy** — data isolation per tenant, API key scoping
- **Document management** — upload (PDF, DOCX, TXT, MD), index, delete with vector cleanup
- **RAG Q&A** — question answering with source citations, SSE streaming, model selection
- **Conversation history** — multi-turn Q&A with last 10 messages as context
- **Structured extraction** — extract JSON from documents using custom schemas
- **Configurable chunking** — fixed size, sentence-based, paragraph-based strategies
- **Webhooks** — POST notifications for indexing events with HMAC-SHA256 signatures
- **Rate limiting** — 30/min QA, 20/min extraction via slowapi
- **QA caching** — Redis cache with SHA256-based keys, skipped for conversations
- **Email verification** — real email delivery via Resend with HTML templates
- **2FA support** — TOTP (authenticator app) + email verification + backup codes (UI ready)
- **Dark mode** — light/dark/system theme toggle with localStorage persistence
- **Monitoring** — Prometheus metrics endpoint + Grafana dashboard

### Frontend Pages
| Page | Description |
|------|-------------|
| **Login/Register** | Email+password auth, personal/org accounts, email verification, 2FA |
| **Dashboard** | Stats cards, recent queries, platform overview |
| **Documents** | Upload, index, delete, detail view with chunk browser |
| **Chat** | Multi-turn Q&A with model selection, SSE streaming, citations |
| **Extract** | JSON schema editor, document selector, model picker |
| **Usage** | Token stats, costs, query history by model |
| **Plans** | Free/Pro/Enterprise tier comparison |
| **Settings** | Profile, 2FA setup, API keys, model defaults, chunking config, webhooks |

## Quick Start

### Prerequisites

- Docker & Docker Compose (for PostgreSQL, Qdrant, Redis)
- Python 3.12+
- Node.js 18+
- OpenRouter API key ([openrouter.ai](https://openrouter.ai))

### 1. Clone and configure

```bash
git clone https://github.com/MaciejZiel/agentic-rag-platform.git
cd agentic-rag-platform
cp .env.example .env
```

Edit `.env` and set at minimum:
```env
OPENROUTER_API_KEY=sk-or-v1-your-key-here

# Optional: email verification via Resend (https://resend.com)
RESEND_API_KEY=re_your-key-here

# Optional: change JWT secret for production
JWT_SECRET_KEY=your-secret-key-here
```

### 2. Start infrastructure

```bash
docker compose up -d  # PostgreSQL, Qdrant, Redis, Prometheus, Grafana
```

### 3. Install dependencies and run migrations

```bash
pip install -e ".[dev]"
alembic upgrade head
```

### 4. Start the backend

```bash
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. Start the frontend

```bash
cd frontend
npm install
npm run dev
```

### 6. Open the app

- **Frontend**: http://localhost:3000
- **API docs**: http://localhost:8000/docs
- **Prometheus**: http://localhost:9090
- **Grafana**: http://localhost:3001

## API Endpoints

### Authentication
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/auth/register` | Register (email + password) |
| `POST` | `/api/v1/auth/verify-email` | Verify email with 6-digit code |
| `POST` | `/api/v1/auth/login` | Login (returns JWT tokens) |
| `POST` | `/api/v1/auth/refresh` | Refresh access token |
| `GET` | `/api/v1/auth/me` | Get current user profile |
| `POST` | `/api/v1/auth/resend-code` | Resend verification code |

### Documents
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/documents/upload` | Upload a document |
| `POST` | `/api/v1/documents/{id}/index` | Index with embeddings |
| `GET` | `/api/v1/documents` | List documents |
| `GET` | `/api/v1/documents/{id}` | Get document details |
| `GET` | `/api/v1/documents/{id}/chunks` | Get document chunks |
| `DELETE` | `/api/v1/documents/{id}` | Delete document + vectors |

### Q&A
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/qa/ask` | Ask a question (RAG) |
| `POST` | `/api/v1/qa/ask/stream` | Ask with SSE streaming |
| `GET` | `/api/v1/qa/history` | Query history with costs |

### Extraction
| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/extract/json` | Extract structured JSON |

### Other
| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/v1/models` | Available LLM models |
| `GET` | `/api/v1/stats` | Platform statistics |
| `POST` | `/api/v1/tenants` | Create tenant (API key) |
| `GET` | `/api/v1/conversations` | List conversations |
| `POST` | `/api/v1/webhooks` | Register webhook |
| `GET` | `/api/v1/health` | Health check |

## Authentication

The API supports two authentication methods:

1. **JWT Bearer token** (frontend) — `Authorization: Bearer <token>`
2. **API Key** (programmatic) — `X-API-Key: rag_...`

Both resolve to a tenant for data isolation. Register via the UI or:

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "min8chars", "full_name": "Your Name"}'

# Check server logs for verification code, then:
curl -X POST http://localhost:8000/api/v1/auth/verify-email \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "code": "123456"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "you@example.com", "password": "min8chars"}'
```

## Email Verification

Verification codes are sent via **Resend** when `RESEND_API_KEY` is configured. Without it, codes are logged to the server console and can also be read from the database:

```sql
SELECT email, email_verification_code FROM users ORDER BY created_at DESC LIMIT 1;
```

To set up Resend: create a free account at [resend.com](https://resend.com), get your API key, and add it to `.env`. Free tier: 100 emails/day. Add a custom domain in Resend to send to any email address.

## Available Models

The platform supports 8 OpenRouter models out of the box:

- GPT-4o, GPT-4o Mini (OpenAI)
- Claude 3.5 Sonnet, Claude 3 Haiku (Anthropic)
- Gemini 2.0 Flash, Gemini Pro 1.5 (Google)
- Llama 3.1 70B, Mixtral 8x7B (Meta/Mistral)

Select models per-query in the Chat and Extract pages.

## Project Structure

```
├── app/
│   ├── api/v1/          # FastAPI route handlers
│   │   ├── auth.py      # Register, login, verify, refresh
│   │   ├── documents.py # Upload, index, delete, chunks
│   │   ├── qa.py        # RAG Q&A with streaming
│   │   ├── extraction.py# Structured data extraction
│   │   └── ...
│   ├── core/            # Config, auth, security, database
│   │   ├── auth.py      # Dual auth (JWT + API key)
│   │   ├── security.py  # bcrypt, JWT tokens
│   │   └── config.py    # Pydantic settings
│   ├── models/          # SQLAlchemy ORM models
│   │   ├── user.py      # Email, password, 2FA, tenant FK
│   │   ├── tenant.py    # Multi-tenant + API keys
│   │   ├── document.py  # Documents + chunks
│   │   └── ...
│   ├── services/        # Business logic
│   │   ├── qa_service.py       # RAG pipeline
│   │   ├── indexing_service.py # Chunking + embedding
│   │   ├── email_service.py    # Resend integration
│   │   └── ...
│   ├── clients/         # External service clients
│   ├── schemas/         # Pydantic request/response models
│   └── utils/           # Text extraction, chunking strategies
├── frontend/
│   ├── src/
│   │   ├── pages/       # 8 page components
│   │   ├── components/  # Shared + shadcn/ui components
│   │   └── lib/         # API client with JWT auth
│   └── ...
├── alembic/             # Database migrations (5 revisions)
├── docker-compose.yml   # PostgreSQL, Qdrant, Redis, Prometheus, Grafana
└── docker/              # Prometheus config
```

## Development

```bash
# Lint
ruff check .
mypy app/

# Type check frontend
cd frontend && npx tsc --noEmit

# Build frontend
cd frontend && npm run build
```

## Supported File Types

- PDF (`.pdf`) — via PyMuPDF
- DOCX (`.docx`) — via python-docx
- Plain text (`.txt`)
- Markdown (`.md`)

## License

Released under the [MIT License](LICENSE).
