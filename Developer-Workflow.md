# CodeForensics — Complete Developer Workflow Guide

> Team reference for local development setup, application architecture, and end-to-end user workflows.

---

## 1. Architecture Overview

CodeForensics is a microservices application with 6 backend services, a React frontend, and an API gateway.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Frontend (React/Vite :5173)                     │
│  Landing → Projects → New Project → Project View → Document View   │
│                          ↓ /api/*                                   │
├─────────────────────────────────────────────────────────────────────┤
│                    API Gateway (Node/Express :8000)                  │
│              Reverse proxy — routes by URL prefix                    │
├──────────┬──────────┬──────────┬──────────┬─────────────────────────┤
│ Proj-Mgmt│  Export  │ Doc-Gen  │ Indexing │  RAG Embedding          │
│ Node :3001│ Node :3002│ Python :8001│ Python :8003│ Python :8005     │
│ Project  │ PDF/DOCX │ LLM doc  │ Code     │ Embeddings,            │
│ CRUD, KB │ export   │ generation│ parsing  │ Chat, Search           │
└──────────┴──────────┴──────────┴──────────┴─────────────────────────┘
                              │
                    ┌─────────┴─────────┐
                    │   PostgreSQL DB    │
                    │  + pgvector ext    │
                    └───────────────────┘
```

### Service Summary

| Service | Language | Port | Responsibility |
|---------|----------|------|----------------|
| Gateway | Node/Express | 8000 | API reverse proxy, rate limiting, health aggregation |
| Proj-Mgmt | Node/Express | 3001 | Project CRUD, file upload, knowledge base metadata, auth |
| Export | Node/Express | 3002 | Document download/export (PDF, DOCX) |
| Doc-Gen | Python/FastAPI | 8001 | LLM document generation, master context, SSE progress |
| Indexing | Python/FastAPI | 8003 | Code parsing, AST indexing, platform detection |
| RAG Embedding | Python/FastAPI | 8005 | Vector embeddings, similarity search, RAG chat |

---

## 2. Prerequisites

### Required Software

| Tool | Version | Purpose |
|------|---------|---------|
| Node.js | v22+ | Gateway, Proj-Mgmt, Export services |
| Python | 3.11+ | Doc-Gen, Indexing, RAG Embedding services |
| PostgreSQL | 15+ | Database (with pgvector extension) |
| Redis | 7+ | Caching (doc-gen, rag-embedding) |
| npm | 10+ | Node dependency management |
| pip/venv | — | Python dependency management |

### Database Setup

```bash
# Create database and user
psql -U postgres
CREATE DATABASE codeforensics_db;
CREATE USER codeforensics_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE codeforensics_db TO codeforensics_user;

# Enable pgvector extension (required for embeddings)
\c codeforensics_db
CREATE EXTENSION IF NOT EXISTS vector;
```

### Knowledge Base Migration (if using KB feature)

```bash
# Run from CodeForensics-Backend/
psql -U codeforensics_user -d codeforensics_db -f proj-mgmt-service/scripts/migrate_knowledge_base.sql
```

This creates:
- `knowledge_base_documents` — uploaded KB document metadata
- `knowledge_base_chunks` — chunked text with pgvector embeddings

---

## 3. Environment Configuration

### Step 1: Set APP_PROFILE

```bash
# CodeForensics-Backend/.env.profile
APP_PROFILE=local
```

This tells all services to load `.env.local` files instead of `.env` (which targets Azure).

### Step 2: Configure Each Service

Copy `.env.local.example` → `.env.local` for each service and fill in values:

```bash
cd CodeForensics-Backend

# Proj-Mgmt Service
cp proj-mgmt-service/.env.local.example proj-mgmt-service/.env.local
# Edit: DatabaseHost, DatabaseUser, DatabasePassword

# Doc-Gen Service
cp doc-gen-service/.env.local.example doc-gen-service/.env.local
# Edit: DatabaseHost/User/Password, LLM keys, DataDir

# Export Service
cp export-service/.env.local.example export-service/.env.local
# Edit: DatabaseHost/User/Password

# Indexing Controller
cp indexing-controller-service/.env.local.example indexing-controller-service/.env.local
# Edit: DatabaseHost/User/Password

# RAG Embedding Service
cp rag-embedding-service/.env.local.example rag-embedding-service/.env.local
# Edit: DatabaseHost/User/Password, Embedding keys

# Gateway
cp gateway/.env.local.example gateway/.env.local
# Usually no changes needed for local
```

### Key Environment Variables

| Variable | Service | Description |
|----------|---------|-------------|
| `DatabaseHost` | All | PostgreSQL host (`localhost` for local) |
| `DatabaseName` | All | `codeforensics_db` |
| `DatabaseUser` / `DatabasePassword` | All | DB credentials |
| `AzureClaudeApiKey` | Doc-Gen | LLM API key for document generation |
| `AzureClaudeEndpoint` | Doc-Gen | LLM endpoint URL |
| `AzureOpenAiApiKey` | Doc-Gen, RAG | Embedding model API key |
| `DataDir` / `DATA_DIR` | Doc-Gen, Indexing, Export | Local filesystem path for project data |
| `JwtSecretKey` | Proj-Mgmt, Export | JWT signing key (for non-SSO auth) |
| `AzureAdTenantId` | Proj-Mgmt, Export | Azure AD tenant (for SSO auth) |

### Auth Behavior

- If **neither** `JwtSecretKey` nor `AzureAdTenantId` is set → dev-mode bypass (auto-authenticates as `dev-user`)
- If `JwtSecretKey` is set → JWT auth required (frontend must send `Authorization: Bearer <token>`)
- If `AzureAdTenantId` is set + `X-Is-SSO: true` header → Azure AD token validation

---

## 4. Installation & Dependency Setup

### Backend (Node services)

```bash
cd CodeForensics-Backend

# Install dependencies for each Node service
npm install --prefix proj-mgmt-service
npm install --prefix export-service
npm install --prefix gateway
```

### Backend (Python services)

```bash
# Doc-Gen Service
cd CodeForensics-Backend/doc-gen-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Indexing Controller
cd ../indexing-controller-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# RAG Embedding Service
cd ../rag-embedding-service
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### Frontend

```bash
cd CodeForensics-Frontend
npm install
```

---

## 5. Starting the Application

### Backend (all 6 services)

```bash
cd CodeForensics-Backend
npm run dev
```

This runs `scripts/start-all.js` which:
1. Kills any stale processes on ports 8000, 3001, 3002, 8001, 8003, 8005
2. Starts Python services first (doc-gen, indexing, rag-embedding), then proj-mgmt and export, then **waits until 8001/8003/8005 accept TCP connections**, then starts the **gateway** — so the proxy is not ready before backends listen (avoids immediate 502 / `ECONNRESET` on page load)
3. Auto-restarts crashed services (max 5 restarts per 5-minute window)
4. Ctrl+C gracefully shuts down all services

**Expected healthy output:**
```
[doc-gen]       Uvicorn running on http://0.0.0.0:8001
[indexing]      Uvicorn running on http://0.0.0.0:8003
[rag-embedding] Uvicorn running on http://0.0.0.0:8005
[proj-mgmt]     Proj-Mgmt-Api running on port 3001
[export]        Export Service is running on port 3002
[gateway]       CodeForensics API Gateway listening on port 8000
```

### Frontend

```bash
cd CodeForensics-Frontend
npm run dev
```

Opens at `http://localhost:5173`. Vite proxies all `/api/*` requests to the gateway at `:8000`.

### Health Check

```bash
# Aggregated health (all services)
curl http://localhost:8000/health

# Individual services
curl http://localhost:3001/health    # proj-mgmt
curl http://localhost:3002/health    # export
curl http://localhost:8001/health    # doc-gen
curl http://localhost:8003/health    # indexing
curl http://localhost:8005/health    # rag-embedding
```

---

## 6. Common Startup Issues & Fixes

### Issue: `Cannot find module 'jsonwebtoken'` or `Cannot find module 'xss'`

**Cause:** Node dependencies not installed or stale after branch switch.

**Fix:**
```bash
npm install --prefix proj-mgmt-service
npm install --prefix export-service
npm install --prefix gateway
```

### Issue: `401 Unauthorized` on all API requests

**Cause:** JWT auth is enabled but no token is being sent by the frontend.

**Fix (local dev):** Ensure neither `JwtSecretKey` nor `AzureAdTenantId` is set in `.env.local`. The auth middleware has a dev-mode bypass that auto-authenticates when auth is not configured.

### Issue: `EADDRINUSE` — port already in use

**Cause:** Previous process didn't shut down cleanly.

**Fix:**
```bash
# Kill processes on all service ports
lsof -ti:8000,3001,3002,8001,8003,8005 | xargs kill -9
```

### Issue: PostgreSQL connection refused

**Cause:** PostgreSQL not running or wrong credentials.

**Fix:**
```bash
# Check PostgreSQL is running
pg_isready -h localhost -p 5432

# Verify credentials
psql -U codeforensics_user -d codeforensics_db -c "SELECT 1"
```

### Issue: Python service won't start (ModuleNotFoundError)

**Cause:** Virtual environment not activated or dependencies not installed.

**Fix:**
```bash
cd doc-gen-service  # or indexing-controller-service, rag-embedding-service
source .venv/bin/activate
pip install -r requirements.txt
```

---

## 7. API Gateway Routing

The gateway routes requests by URL prefix. Order matters (most specific first):

| URL Pattern | Target Service | Purpose |
|-------------|---------------|---------|
| `GET /api/projects/:id/index/events` | Indexing :8003 | SSE — indexing progress |
| `GET /api/projects/:id/generation/events` | Doc-Gen :8001 | SSE — generation progress |
| `/api/projects/:id/documents/:docType/download` | Export :3002 | Document download |
| `/api/projects/:id/generate*` | Doc-Gen :8001 | Trigger document generation |
| `/api/projects/:id/documents*` | Doc-Gen :8001 | Document CRUD |
| `/api/projects/:id/custom-document*` | Doc-Gen :8001 | Custom document wizard |
| `/api/projects/:id/chat*` | RAG Embedding :8005 | Chat conversations |
| `/api/projects/:id/embeddings*` | RAG Embedding :8005 | Embedding management |
| `/api/projects/:id/index*` | Indexing :8003 | Code indexing |
| `/api/projects/:id/code-objects` | Indexing :8003 | Parsed code objects |
| `/api/search*` | RAG Embedding :8005 | Semantic search |
| `/api/*` (catch-all) | Proj-Mgmt :3001 | Project CRUD, KB, technologies |

---

## 8. Frontend Pages & Navigation

| Route | Page | Description |
|-------|------|-------------|
| `/` | Landing | Hero page with product overview |
| `/projects` | Projects | List all projects, search, delete |
| `/new` | NewProject | 4-step wizard: Name → Type → Upload → Technology |
| `/project/:id` | ProjectView | Tabbed view: Overview, Documents, Knowledge Base |
| `/project/:id/doc/:docType` | DocumentView | Rendered markdown document with export options |
| `/project/:id/chat` | ChatPage | Full-screen RAG chat with project context |
| `/chat` | ChatStandalone | Standalone chat with project picker |
| `/projects/:id/custom-document` | CustomDocumentWizard | Custom document specification & generation |

---

## 9. End-to-End User Workflow

### Stage 1: Project Creation

```
User → /new (NewProject.tsx)
```

1. **Step 1 — Name:** Enter project name and optional description
2. **Step 2 — Input Type:** Choose `Code` | `Documents` | `Both`
3. **Step 3 — Upload:** Select folder to upload
   - Frontend filters out `node_modules`, `.git`, `__pycache__`, etc.
   - Files uploaded in batches to avoid timeouts:
     - `POST /api/projects/upload-folder` → creates project, returns `projectId`
     - `POST /api/projects/:id/upload-folder-batch` → uploads file chunks
     - `POST /api/projects/:id/upload-folder-complete` → finalizes upload
4. **Step 4 — Technology:** Select technology platform (Java, .NET, COBOL, Python, etc.)
   - Fetched from `GET /api/supported-technologies`
   - Auto-detection available via indexing service

**Result:** Project created with status `created`, files stored on disk/blob.

### Stage 2: Code Indexing

```
Automatic after project creation → ProjectView.tsx (Overview tab)
```

1. Frontend triggers: `POST /api/projects/:id/index`
2. Indexing service reads uploaded code files
3. Parses code into AST using language-specific parsers (COBOL, Java, Python, C#, etc.)
4. Detects platforms and frameworks
5. Generates index file with all code objects (functions, classes, modules)
6. **Real-time progress:** Frontend subscribes to `GET /api/projects/:id/index/events` (SSE)
   - Events include: file count, current file, parse progress, errors
7. On completion: `project.status = "indexed"`, `project.index_file` populated

**Validation:** Check project status via `GET /api/projects/:id` — should show `status: "indexed"` and `statistics` with file/object counts.

### Stage 3: Master Context & Embeddings

```
Automatic after indexing completes
```

1. Doc-gen service builds master context document from the index
   - `POST /api/projects/:id/generate-master`
   - Summarizes entire codebase into a structured context document
2. Embeddings generated for RAG retrieval
   - Vector embeddings stored in PostgreSQL (pgvector)
3. **Real-time progress:** `GET /api/projects/:id/generation/events` (SSE)
4. On completion: `project.master_status = "completed"`, `project.embeddings_ready = true`

**Validation:** `GET /api/projects/:id` should show `master_status: "completed"`.

### Stage 4: Overview Generation

```
Automatic after master context completes
```

1. Doc-gen generates high-level overview document
   - `POST /api/projects/:id/generate-overview`
   - Architecture diagrams, technology stack, component summary
2. On completion: `project.overview_status = "completed"`

**Validation:** Overview document appears in the Documents tab.

### Stage 5: Document Generation

```
User-triggered → ProjectView.tsx (Documents tab)
```

1. User selects documentation mode:
   - **Technical** — code-level documentation
   - **Business** — business requirements, process flows
   - **Forward Engineering** — modernization blueprints
2. User selects document types from available list
3. Optionally selects generation scope: **Compact** (faster) | **Comprehensive** (detailed)
4. Triggers: `POST /api/projects/:id/generate` with `{ doc_types: [...], mode: "..." }`
5. Doc-gen service generates each document sequentially using LLM
6. **Real-time progress:** SSE stream shows per-document progress bars
7. Generated documents stored as markdown files

**Validation:** Documents appear in the Documents tab with "completed" status.

### Stage 6: Document Viewing & Export

```
User clicks document → /project/:id/doc/:docType (DocumentView.tsx)
```

1. Frontend fetches: `GET /api/projects/:id/documents/:docType`
2. Renders markdown with syntax highlighting, Mermaid diagrams, tables
3. Export options:
   - **PDF:** Client-side rendering via html2canvas + jsPDF
   - **Download:** `GET /api/projects/:id/documents/:docType/download` → Export service

### Stage 7: RAG Chat (Optional)

```
User navigates → /project/:id/chat (ChatPage.tsx)
```

**Prerequisite:** Embeddings must be ready (`embeddings_ready = true`).

1. User types question about the project
2. Frontend sends: `POST /api/projects/:id/chat` with `{ message: "..." }`
3. RAG service:
   - Converts question to embedding vector
   - Retrieves relevant code chunks via similarity search
   - Sends context + question to LLM
   - Returns grounded response with source references
4. Chat history persisted in `chat_conversations` / `chat_messages` tables

### Stage 8: Knowledge Base (Optional)

```
User navigates → ProjectView.tsx (Knowledge Base tab)
```

1. **Upload:** User uploads reference documents (BRD, Word, PDF, Excel)
   - `POST /api/projects/:id/knowledge-base` (multipart form)
   - Categorized into pools: `customer_knowledge` | `reference_knowledge`
2. **Processing:** Documents chunked and embedded automatically
   - Status: `pending` → `processing` → `completed`
3. **Usage:** KB chunks augment RAG retrieval during document generation and chat
4. **Management:**
   - Replace: `PUT /api/projects/:id/knowledge-base/:docId/replace`
   - Delete: `DELETE /api/projects/:id/knowledge-base/:docId`

### Stage 9: Custom Document Generation (Optional)

```
User navigates → /projects/:id/custom-document (CustomDocumentWizard.tsx)
```

1. User defines custom document specification:
   - Document name and type (documentation | modernization)
   - Target sections and subsections
   - Custom instructions per section
2. Triggers: `POST /api/projects/:id/generate-custom`
3. Doc-gen generates document following the custom spec
4. Result appears in Documents tab

---

## 10. Running Tests

### Backend — Python (doc-gen-service)

```bash
cd CodeForensics-Backend
python3 -m pytest doc-gen-service/tests/ \
  --override-ini="addopts=-v --tb=short --import-mode=importlib" \
  --ignore=doc-gen-service/tests/test_kb_ingest_endpoint.py \
  --ignore=doc-gen-service/tests/test_bug_condition_exploration.py
```

### Backend — Full test suite

```bash
cd CodeForensics-Backend
python3 -m pytest \
  --override-ini="addopts=-v --tb=short --import-mode=importlib" \
  --ignore=doc-gen-service/tests/test_kb_ingest_endpoint.py \
  --ignore=doc-gen-service/tests/test_bug_condition_exploration.py
```

### Frontend

```bash
cd CodeForensics-Frontend
npm run test          # single run
npm run test:watch    # watch mode
npm run test:coverage # with coverage report
npm run typecheck     # TypeScript type checking
```

---

## 11. Git Workflow

### Branch Strategy

| Branch | Purpose |
|--------|---------|
| `development` | Main integration branch |
| `development-ashish` | Feature integration branch (merged from dev-ashish-v2) |
| `dev-ashish-v2` | Feature development branch |
| `main` | Production releases |

### After Branch Switch

Always reinstall Node dependencies after switching branches:

```bash
npm install --prefix proj-mgmt-service
npm install --prefix export-service
npm install --prefix gateway
```

Python services: re-activate venv and `pip install -r requirements.txt` if `requirements.txt` changed.

---

## 12. Project Data Flow Diagram

```
┌──────────┐     POST /upload-folder      ┌──────────────┐
│  User    │ ──────────────────────────→  │  Proj-Mgmt   │ → DB (projects table)
│ (Browser)│                               │  :3001       │ → Disk/Blob (files)
└──────────┘                               └──────┬───────┘
                                                   │ POST /index
                                                   ▼
                                           ┌──────────────┐
                                           │  Indexing     │ → Parse code → AST
                                           │  :8003       │ → index.json
                                           └──────┬───────┘
                                                   │ SSE: index/events
                                                   ▼
                                           ┌──────────────┐
                                           │  Doc-Gen     │ → Master context
                                           │  :8001       │ → Embeddings
                                           └──────┬───────┘   → Documents (LLM)
                                                   │ SSE: generation/events
                                                   ▼
                                           ┌──────────────┐
                                           │  RAG Embed   │ → Vector search
                                           │  :8005       │ → Chat (LLM)
                                           └──────┬───────┘
                                                   │
                                                   ▼
                                           ┌──────────────┐
                                           │  Export      │ → PDF / DOCX
                                           │  :3002       │ → Download
                                           └──────────────┘
```

---

## 13. Swagger / API Documentation

Each service exposes Swagger UI:

| Service | Swagger URL |
|---------|-------------|
| Proj-Mgmt | http://localhost:3001/api-docs |
| Export | http://localhost:3002/api-docs |
| Doc-Gen | http://localhost:8001/docs |
| Indexing | http://localhost:8003/docs |
| RAG Embedding | http://localhost:8005/docs |

---

## 14. Quick Reference — Common Commands

```bash
# Start everything
cd CodeForensics-Backend && npm run dev    # all 6 backend services
cd CodeForensics-Frontend && npm run dev   # frontend on :5173

# Health check
curl http://localhost:8000/health | python3 -m json.tool

# Kill all service ports
lsof -ti:8000,3001,3002,8001,8003,8005 | xargs kill -9

# Run backend tests
cd CodeForensics-Backend
python3 -m pytest doc-gen-service/tests/ --override-ini="addopts=-v --tb=short --import-mode=importlib"

# Run frontend tests
cd CodeForensics-Frontend && npm run test

# Check git status (both repos)
git -C CodeForensics-Backend status
git -C CodeForensics-Frontend status

# Reinstall Node deps (after branch switch)
npm install --prefix CodeForensics-Backend/proj-mgmt-service
npm install --prefix CodeForensics-Backend/export-service
npm install --prefix CodeForensics-Backend/gateway
```
