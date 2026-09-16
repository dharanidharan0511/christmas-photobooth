import { fileNode, filesFromContent, type MockTreeRoot } from "./helpers";

const BACKEND_MAIN_CONTENT: Record<string, string> = {
  "README.md": `# Backend API

FastAPI service backing the Chat Bot edge deployment. Handles session lifecycle,
chat completions proxying, and health checks for the on-prem engine integration.

## Structure

\`\`\`
src/
  main.py              FastAPI app factory + lifespan
  config.py            Pydantic settings
  api/                 HTTP routers
  services/            Business logic
  models/              Request/response schemas
tests/
  unit/                Fast unit tests
  integration/         HTTP-level tests against TestClient
\`\`\`

## Local development

\`\`\`bash
python -m venv .venv && source .venv/bin/activate
pip install -e ".[dev]"
uvicorn src.main:app --reload --port 8080
pytest -q
\`\`\`

## Environment

Copy \`.env.example\` to \`.env\` and set \`ENGINE_URL\`, \`JWT_SECRET\`, and \`POSTGRES_URL\`.
`,

  "pyproject.toml": `[project]
name = "backend-api"
version = "0.4.2"
description = "Chat Bot backend API for edge deployments"
requires-python = ">=3.11"
dependencies = [
  "fastapi>=0.115.0",
  "uvicorn[standard]>=0.30.0",
  "httpx>=0.27.0",
  "pydantic-settings>=2.4.0",
  "sqlalchemy[asyncio]>=2.0.35",
  "asyncpg>=0.29.0",
  "python-jose[cryptography]>=3.3.0",
  "structlog>=24.4.0",
]

[project.optional-dependencies]
dev = ["pytest>=8.3.0", "pytest-asyncio>=0.24.0", "ruff>=0.6.0", "httpx"]

[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]

[tool.ruff]
line-length = 100
target-version = "py311"
`,

  ".env.example": `# Copy to .env — never commit real secrets
ENGINE_URL=http://localhost:9002
POSTGRES_URL=postgresql+asyncpg://chatbot:chatbot@localhost:5432/chatbot
JWT_SECRET=change-me-in-production
JWT_ALGORITHM=HS256
JWT_EXPIRE_MINUTES=60
LOG_LEVEL=info
CORS_ORIGINS=http://localhost:5353,http://localhost:5173
`,

  "Dockerfile": `FROM python:3.11-slim AS base
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY src ./src
EXPOSE 8080
CMD ["uvicorn", "src.main:app", "--host", "0.0.0.0", "--port", "8080"]
`,

  "docker-compose.yml": `services:
  api:
    build: .
    ports:
      - "8080:8080"
    env_file: .env
    depends_on:
      - postgres
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: chatbot
      POSTGRES_PASSWORD: chatbot
      POSTGRES_DB: chatbot
    ports:
      - "5433:5432"
`,

  "src/main.py": `"""Application entrypoint."""

from __future__ import annotations

import structlog
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.routes import router as api_router
from src.config import settings

logger = structlog.get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup", engine_url=settings.engine_url)
    yield
    logger.info("shutdown")


def create_app() -> FastAPI:
    app = FastAPI(title="Chat Bot Backend API", version="0.4.2", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router)
    return app


app = create_app()
`,

  "src/config.py": `from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    engine_url: str = "http://localhost:9002"
    postgres_url: str = "postgresql+asyncpg://chatbot:chatbot@localhost:5432/chatbot"
    jwt_secret: str = "dev-secret"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60
    log_level: str = "info"
    cors_origins: list[str] = ["http://localhost:5353"]


settings = Settings()
`,

  "src/api/__init__.py": `"""HTTP route modules."""\n`,

  "src/api/deps.py": `from collections.abc import AsyncIterator
from typing import Annotated

from fastapi import Depends, Header, HTTPException

from src.services.session_store import SessionStore, session_store


async def get_session_store() -> AsyncIterator[SessionStore]:
    yield session_store


StoreDep = Annotated[SessionStore, Depends(get_session_store)]


async def require_bearer(authorization: Annotated[str | None, Header()] = None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing_bearer")
    return authorization.removeprefix("Bearer ").strip()
`,

  "src/api/routes.py": `from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from src.api.deps import StoreDep, require_bearer
from src.models.schemas import ChatRequest, ChatResponse, HealthResponse, SessionSummary
from src.services.chat_service import ChatService

router = APIRouter(prefix="/api/v1")


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(status="ok", version="0.4.2")


@router.get("/sessions", response_model=list[SessionSummary])
async def list_sessions(store: StoreDep, token: str = Depends(require_bearer)) -> list[SessionSummary]:
    return await store.list_for_token(token)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, store: StoreDep, token: str = Depends(require_bearer)) -> ChatResponse:
    service = ChatService(store=store)
    return await service.complete(token=token, request=body)


class ItemOut(BaseModel):
    id: str
    name: str = Field(min_length=1)


@router.get("/items", response_model=list[ItemOut])
async def list_items() -> list[ItemOut]:
    return [ItemOut(id="seed-1", name="Welcome pack"), ItemOut(id="seed-2", name="Edge handbook")]
`,

  "src/api/middleware.py": `import time
import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

logger = structlog.get_logger(__name__)


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        started = time.perf_counter()
        response = await call_next(request)
        elapsed_ms = (time.perf_counter() - started) * 1000
        logger.info(
            "http_request",
            method=request.method,
            path=request.url.path,
            status=response.status_code,
            elapsed_ms=round(elapsed_ms, 2),
        )
        return response
`,

  "src/models/schemas.py": `from datetime import datetime
from pydantic import BaseModel, Field


class HealthResponse(BaseModel):
    status: str
    version: str


class SessionSummary(BaseModel):
    id: str
    title: str | None = None
    updated_at: datetime


class ChatMessage(BaseModel):
    role: str = Field(pattern="^(system|user|assistant)$")
    content: str = Field(min_length=1)


class ChatRequest(BaseModel):
    session_id: str | None = None
    messages: list[ChatMessage]
    stream: bool = False


class ChatResponse(BaseModel):
    session_id: str
    message: ChatMessage
    usage_tokens: int = 0
`,

  "src/services/chat_service.py": `import httpx
import structlog

from src.config import settings
from src.models.schemas import ChatRequest, ChatResponse, ChatMessage
from src.services.session_store import SessionStore

logger = structlog.get_logger(__name__)


class ChatService:
    def __init__(self, *, store: SessionStore) -> None:
        self._store = store

    async def complete(self, *, token: str, request: ChatRequest) -> ChatResponse:
        session_id = request.session_id or await self._store.create(token=token)
        payload = {
            "messages": [m.model_dump() for m in request.messages],
            "stream": request.stream,
        }
        async with httpx.AsyncClient(base_url=settings.engine_url, timeout=120.0) as client:
            resp = await client.post(
                "/api/v2/chat/completions",
                json=payload,
                headers={"Authorization": f"Bearer {token}"},
            )
            resp.raise_for_status()
            data = resp.json()

        assistant = ChatMessage(role="assistant", content=data.get("content", ""))
        await self._store.touch(session_id)
        logger.info("chat_complete", session_id=session_id, tokens=data.get("usage", {}).get("total_tokens", 0))
        return ChatResponse(
            session_id=session_id,
            message=assistant,
            usage_tokens=int(data.get("usage", {}).get("total_tokens", 0)),
        )
`,

  "src/services/session_store.py": `from __future__ import annotations

import uuid
from datetime import datetime, timezone

from src.models.schemas import SessionSummary


class SessionStore:
    """In-memory session index for the preview deployment."""

    def __init__(self) -> None:
        self._by_token: dict[str, list[SessionSummary]] = {}

    async def create(self, *, token: str) -> str:
        session_id = str(uuid.uuid4())
        summary = SessionSummary(id=session_id, title="New chat", updated_at=datetime.now(timezone.utc))
        self._by_token.setdefault(token, []).insert(0, summary)
        return session_id

    async def list_for_token(self, token: str) -> list[SessionSummary]:
        return list(self._by_token.get(token, []))

    async def touch(self, session_id: str) -> None:
        for sessions in self._by_token.values():
            for session in sessions:
                if session.id == session_id:
                    session.updated_at = datetime.now(timezone.utc)
                    return


session_store = SessionStore()
`,

  "tests/conftest.py": `import pytest
from httpx import ASGITransport, AsyncClient

from src.main import app


@pytest.fixture
async def client():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
`,

  "tests/unit/test_health.py": `import pytest


@pytest.mark.asyncio
async def test_health_returns_ok(client):
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "ok"
    assert body["version"]
`,

  "tests/unit/test_chat_service.py": `import pytest

from src.models.schemas import ChatMessage, ChatRequest
from src.services.chat_service import ChatService
from src.services.session_store import SessionStore


@pytest.mark.asyncio
async def test_create_session_when_missing(monkeypatch):
    store = SessionStore()

    async def fake_post(*args, **kwargs):
        class Resp:
            def raise_for_status(self): ...
            def json(self):
                return {"content": "hello", "usage": {"total_tokens": 12}}
        return Resp()

    monkeypatch.setattr("httpx.AsyncClient.post", fake_post)
    service = ChatService(store=store)
    result = await service.complete(
        token="test-token",
        request=ChatRequest(messages=[ChatMessage(role="user", content="hi")]),
    )
    assert result.message.content == "hello"
    assert result.session_id
`,

  "tests/integration/test_sessions_api.py": `import pytest


@pytest.mark.asyncio
async def test_sessions_requires_bearer(client):
    resp = await client.get("/api/v1/sessions")
    assert resp.status_code == 401
`,

  "migrations/001_initial.sql": `-- Sessions table for persistent storage (future)
CREATE TABLE IF NOT EXISTS chat_sessions (
    id UUID PRIMARY KEY,
    owner_token_hash TEXT NOT NULL,
    title TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_sessions_owner_idx ON chat_sessions (owner_token_hash);
`,
};

const BACKEND_DEVELOP_EXTRA: Record<string, string> = {
  "README.md": `# Backend API (develop)

Integration branch for the next minor release. Adds structured logging middleware,
session persistence migration, and expanded chat proxy error handling.

See \`docs/ARCHITECTURE.md\` and \`docs/API_CHANGELOG.md\` for details.
`,

  "docs/ARCHITECTURE.md": `# Architecture

## Request flow

\`\`\`
Client (TP-Web / Studio)
    -> FastAPI /api/v1/chat
        -> ChatService
            -> httpx -> Edge Engine /api/v2/chat/completions
        -> SessionStore (in-memory today, Postgres in develop)
\`\`\`

## Modules

| Layer | Responsibility |
|-------|----------------|
| \`api/\` | HTTP routing, auth dependency injection |
| \`services/\` | Orchestration, outbound engine calls |
| \`models/\` | Pydantic schemas shared across routes |
| \`tests/\` | Unit + integration coverage |

## Deployment

Container image built from \`Dockerfile\`. Compose stack includes Postgres for local parity
with the edge cluster database.
`,

  "docs/API_CHANGELOG.md": `# API Changelog (develop)

## Unreleased

- \`GET /api/v1/sessions\` — paginated session list (planned)
- \`POST /api/v1/chat\` — structured engine error mapping
- Request logging middleware enabled by default
`,

  "src/api/routes.py": BACKEND_MAIN_CONTENT["src/api/routes.py"]!.replace(
    'router = APIRouter(prefix="/api/v1")',
    'router = APIRouter(prefix="/api/v1", tags=["chat"])',
  ),
};

function treeFromContent(content: Record<string, string>): MockTreeRoot {
  const root: MockTreeRoot = {};
  for (const [path] of Object.entries(content)) {
    const parts = path.split("/");
    let current = root;
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i]!;
      const isFile = i === parts.length - 1;
      if (isFile) {
        current[part] = fileNode(content[path]!);
      } else {
        if (!current[part] || current[part].type !== "dir") {
          current[part] = { type: "dir", children: {} };
        }
        current = (current[part] as { type: "dir"; children: MockTreeRoot }).children;
      }
    }
  }
  return root;
}

export const BACKEND_TREES_BY_BRANCH = {
  main: treeFromContent(BACKEND_MAIN_CONTENT),
  develop: treeFromContent({ ...BACKEND_MAIN_CONTENT, ...BACKEND_DEVELOP_EXTRA }),
};

export const BACKEND_FILES_BY_BRANCH = {
  main: filesFromContent(BACKEND_MAIN_CONTENT),
  develop: filesFromContent({ ...BACKEND_MAIN_CONTENT, ...BACKEND_DEVELOP_EXTRA }),
};
