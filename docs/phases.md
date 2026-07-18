# Project Implementation Phases

This document details the step-by-step execution roadmap for building the LLM Inference Logging System, divided into 8 logical phases.

---

### Phase 1: Project Setup & Monorepo Initialization [COMPLETED]
* **Tasks**:
  - [x] Initialize npm workspaces monorepo structure.
  - [x] Setup root `package.json`, TypeScript configurations, and eslint rules.
  - [x] Create development Docker Compose configuration including local **PostgreSQL** and **Redis**.
  - [x] Write the database model inside `prisma/schema.prisma` and execute initial migrations.
* **Goal**: A clean compilation skeleton with running local databases and verified DB connections.

---

### Phase 2: Core Chat Backend & History APIs [COMPLETED]
* **Tasks**:
  - [x] Scaffold `apps/backend` using **Fastify** + TypeScript.
  - [x] Integrate Prisma client into the backend.
  - [x] Expose REST endpoints:
    - [x] `GET /conversations` - Fetch list of active threads.
    - [x] `GET /conversations/:id` - Fetch messages in a thread.
    - [x] `POST /conversations` - Create new conversation thread.
    - [x] `DELETE /conversations/:id` - Clear/Delete a conversation thread.
    - [x] `POST /chat` - Completion routing (connected to LLM SDK).
* **Goal**: Validate conversation history storage and retrieval works natively from REST APIs.

---

### Phase 3: The LLM SDK Wrapper (Strategy Pattern) [COMPLETED]
* **Tasks**:
  - [x] Scaffold shareable package `packages/llm-sdk`.
  - [x] Define uniform `LLMProvider` interface and parameter types.
  - [x] Create `OpenAIProvider` class strategy (handles OpenAI, Groq, Grok, and OpenRouter endpoints using base URL overrides).
  - [x] Create `GeminiProvider` class strategy (handles Google AI Gemini requests).
  - [x] Implement latency counters:
    - [x] Time-to-First-Token (TTFT) detection using streaming chunk interceptors.
    - [x] Total generation time.
  - [x] Implement a tokenizer utility fallback to count prompt/completion tokens when API headers don't supply them.
* **Goal**: Complete SDK client capability to stream tokens from various providers, returning performance metrics.

---

### Phase 4: Telemetry Queue & Worker (Redis & BullMQ) [COMPLETED]
* **Tasks**:
  - [x] Integrate `BullMQ` inside `packages/llm-sdk`.
  - [x] Configure SDK client to automatically push a log event payload to the `inference_events` Redis queue at the end of each generation.
  - [x] Scaffold the background daemon `apps/worker` using TypeScript.
  - [x] Implement queue runner consumer utilizing `BullMQ`.
  - [x] Configure worker retry logic with exponential backoff to handle ingestion API failures.
* **Goal**: Inference logs are safely stored in Redis instantly and processed asynchronously by the background worker.

---

### Phase 5: Ingestion API & PII Redaction [COMPLETED]
* **Tasks**:
  - [x] Scaffold `apps/ingestion` service.
  - [x] Implement schema validation for inbound JSON payloads.
  - [x] Code the regex PII Redaction engine to filter:
    * Email addresses (`[EMAIL]`)
    * Phone numbers (`[PHONE]`)
    * Credit cards (`[CREDIT_CARD]`)
    * Aadhaar IDs (`[AADHAAR]`)
    * PAN IDs (`[PAN]`)
  - [x] Write incoming, redacted inference logs into PostgreSQL.
  - [x] Incorporate a WebSocket server (`ws`) inside the service, broadcasting real-time updates of metrics to any connected dashboard.
* **Goal**: Incoming logs are safely validated, sanitized, written to Postgres, and broadcasted over WebSockets.

---

### Phase 6: Next.js Chat Frontend & Settings UI [COMPLETED]
* **Tasks**:
  - [x] Scaffold `apps/frontend` using **Next.js (App Router)** and CSS Modules/Vanilla CSS.
  - [x] Build conversational UI featuring:
    - [x] Thread sidebar (history selection, adding conversations, deletion).
    - [x] Chat interface capable of rendering Markdown & SSE token streams.
    - [x] Generation cancellation button (sending abort signals).
  - [x] Create a **Settings** modal or page to enter API keys for various providers. Stored in local storage and passed via request headers.
* **Goal**: Functional chat browser client running fully against local backend APIs using user-supplied keys.

---

### Phase 7: Dashboard UI (WebSockets & Recharts) [COMPLETED]
* **Tasks**:
  - [x] Design and build a telemetry Dashboard page in the Next.js app.
  - [x] Connect to the Ingestion WebSocket server.
  - [x] Render active analytics with `recharts`:
    - [x] Total requests, average latencies, P95 latency.
    - [x] Success vs. Error rates.
    - [x] Token consumption over time.
    - [x] Provider splits.
* **Goal**: Dashboard updates live without browser refresh as soon as a chat message finishes.

---

### Phase 8: Dockerization & Railway Orchestration [COMPLETED]
* **Tasks**:
  - [x] Create optimized multi-stage `Dockerfile` configurations for `frontend`, `backend`, `worker`, and `ingestion`.
  - [x] Update local `docker-compose.yml` linking all services (including web apps and APIs) with health checks, private networking, and default environment values.
  - [x] Draft Railway deployment blueprint (explaining env configurations, PostgreSQL/Redis setups, and internal private URL mappings).
  - [x] Validate entire stack builds and runs locally with a single `docker compose up` command before deployment.
* **Goal**: Monorepo fully containerized and pre-configured for instant single-click deployment to Railway.
