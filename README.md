# LLM Inference Logging & Telemetry System

A production-inspired, highly observable AI chatbot platform featuring an asynchronous event-driven logging queue, a unified LLM SDK wrapper (supporting multiple providers), live telemetry streaming, and a real-time analytics dashboard.

---

## 1. Setup Instructions

The easiest and recommended way to run the entire system is using **Docker Compose**, which spins up all necessary services and databases in a single command. Alternatively, you can run services manually for local development.

### Option A: Running via Docker Compose (Recommended)

#### Prerequisites
- Docker and Docker Compose installed.
- API credentials for at least one provider (e.g., Google Gemini, OpenAI, Groq, x.AI Grok, or OpenRouter).

#### Launch Steps
1. Navigate to the project root directory.
2. Initialize and build the stack:
   ```bash
   docker compose up --build
   ```
3. Once running, open your browser and navigate to:
   - **Frontend UI / Chat Console**: [http://localhost:3000](http://localhost:3000)
   - **Backend Service (Fastify)**: [http://localhost:4000/health](http://localhost:4000/health)
   - **Telemetry Ingestion Service**: [http://localhost:4010/health](http://localhost:4010/health)
   - **PostgreSQL**: Bound to `localhost:5432`
   - **Redis (BullMQ)**: Bound to `localhost:6379`

### Option B: Local Manual Setup (Development Mode)

#### Prerequisites
- Node.js (v20+) and npm installed.
- PostgreSQL and Redis instances running locally.

#### Launch Steps
1. Copy the `.env.example` file to `.env` in the root and customize connection URIs:
   ```bash
   DATABASE_URL="postgresql://postgres:postgres@localhost:5432/llm_logging?schema=public"
   REDIS_URL="redis://localhost:6379"
   ```
2. Install dependencies for all workspaces at the root level:
   ```bash
   npm install
   ```
3. Run Prisma migrations to initialize the database:
   ```bash
   npm run db:migrate
   npm run db:generate
   ```
4. Start each service individually (in separate terminal sessions):
   - **Backend API**: `npm run dev:backend`
   - **Ingestion Service**: `npm run dev:ingestion`
   - **Worker Daemon**: `npm run dev:worker`
   - **Frontend App**: `npm run dev:frontend`

---

## 2. Microservices Architecture & Communication Flow

The system is decoupled into independent services communicating via REST APIs, Server-Sent Events (SSE), a Redis event queue, and WebSockets.

```text
               User (Browser)
                     │
          HTTP / SSE │ (Port 3000)
                     ▼
          ┌───────────────────────┐
          │   Frontend Service    │ <────────────────────────┐
          │ (Next.js - App Router)│                          │ Live
          └──────────┬────────────┘                          │ WebSockets
                     │                                       │ (Port 4010)
          CORS REST  │ (Port 4000)                           │
          HTTP / SSE ▼                                       │
          ┌───────────────────────┐                          │
          │      Backend API      │                          │
          │ (Fastify API Routing) │                          │
          └──────────┬────────────┘                          │
                     │ Calls (In-process)                    │
                     ▼                                       │
          ┌───────────────────────┐                          │
          │   LLM SDK / Wrapper   │                          │
          │   (Strategy Pattern)  │                          │
          └────┬─────────────┬────┘                          │
               │             │                               │
    LLM Stream │             │ Publish                       │
    HTTP POST  ▼             ▼ Event                         │
         OpenAI / Gemini   Redis Queue                       │
        (Grok/Groq/OpenRouter) │                             │
                               ▼                             │
                         ┌───────────┐                       │
                         │   Redis   │                       │
                         └─────┬─────┘                       │
                               │ Read Event                  │
                               ▼                             │
                         ┌───────────┐                       │
                         │  Worker   │                       │
                         │  Daemon   │                       │
                         └─────┬─────┘                       │
                               │ HTTP POST                   │
                               ▼ (Port 4010)                 │
                         ┌───────────────────────────────────┴┐
                         │         Ingestion Service          │
                         │ (Fastify, PII Redact, Live WS)    │
                         └─────┬──────────────────────────────┘
                               │ Writes Logs
                               ▼
                         ┌───────────┐
                         │ Postgres  │
                         └───────────┘
```

### Services Breakdown
1. **Frontend App (`apps/frontend`)**: Next.js single-page application. Handles provider credentials configuration (stored locally in-browser), multi-turn chat interaction, and streams markdown text token-by-token. Includes a dedicated live Observability Dashboard.
2. **Backend API (`apps/backend`)**: Fastify-based orchestrator. Manages thread-based conversation state and message persistence. Calls the shared LLM SDK, handles client-side aborting, and pipes SSE chunks back to the client.
3. **LLM SDK (`packages/llm-sdk`)**: Shareable package implementing the **Strategy Pattern**. Wraps OpenAI and Google AI libraries into a uniform API. Automatically calculates prompt/completion token lengths, measures TTFT/total latency, and pushes telemetry objects onto the Redis queue.
4. **Worker Daemon (`apps/worker`)**: BullMQ processor running on Redis. Asynchronously polls inference jobs, routes them to the telemetry ingestion endpoint, and manages exponential backoff retries.
5. **Ingestion Service (`apps/ingestion`)**: High-throughput telemetry collector. Validates schemas using `zod`, processes recursive PII redaction on preview strings, writes records to PostgreSQL, and broadcasts telemetry to dashboards via WebSockets.

---

## 3. Database Schema

We use **Prisma ORM** with a **PostgreSQL** relational database.

```text
  ┌──────────────────┐
  │   Conversation   │
  ├──────────────────┤
  │ id (UUID) [PK]   │◄───────┐
  │ title (String)   │        │
  │ created_at       │        │
  │ updated_at       │        │
  └──────────────────┘        │
            │                 │
            ├─────────────────┼─────────────────┐
            │ 1               │ 1               │ 1
            ▼ 0..*            ▼ 0..*            ▼ 0..*
  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
  │     Message      │  │   InferenceLog   │  │   InferenceLog   │
  ├──────────────────┤  ├──────────────────┤  ├──────────────────┤
  │ id (UUID) [PK]   │  │ id (UUID) [PK]   │  │ id (UUID) [PK]   │
  │ conversation_id  │  │ conversation_id  │  │ conversation_id  │
  │ role (String)    │  │ provider (String)│  │ provider (String)│
  │ content (String) │  │ model (String)   │  │ model (String)   │
  │ provider (String)│  │ latency_ms (Int) │  │ latency_ms (Int) │
  │ created_at       │  │ ttft_ms (Int)    │  │ ttft_ms (Int)    │
  │                  │  │ input_tokens     │  │ input_tokens     │
  │                  │  │ output_tokens    │  │ output_tokens    │
  │                  │  │ total_tokens     │  │ total_tokens     │
  │                  │  │ request_preview  │  │ request_preview  │
  │                  │  │ response_preview │  │ response_preview │
  │                  │  │ status (String)  │  │ status (String)  │
  │                  │  │ error_message    │  │ error_message    │
  │                  │  │ created_at       │  │ created_at       │
  └──────────────────┘  └──────────────────┘  └──────────────────┘
```

1. **`conversations`**: Tracks threads. Sending a new message updates `updated_at` to float active chats to the top of the history list.
2. **`messages`**: Multi-turn logs containing chat messages (`role: "user" | "assistant"`), their textual content, and the originating provider. Relates to `conversations` (cascade delete enabled).
3. **`inference_logs`**: Observability logs storing metrics (latencies, token calculations, status codes) and redacted request/response payloads. Used directly by the Dashboard service.

---

## 4. API Endpoints

### Backend API (`Port 4000`)
- `GET /conversations`: Returns a list of active threads ordered by `updatedAt` desc.
- `POST /conversations`: Creates a new empty thread. Expects `{ title: string }`.
- `GET /conversations/:id`: Fetches detailed thread info including its full message array.
- `DELETE /conversations/:id`: Deletes the thread and cascade deletes all child messages and logs.
- `POST /chat`: Routes conversational prompt to the LLM SDK. Handles SSE streaming if `stream: true` is supplied.
- `DELETE /chat/cancel`: Instructs the backend to cancel a running stream for a specific `conversationId`.
- `GET /health`: Service and Postgres connection diagnostics.

### Ingestion Service (`Port 4010`)
- `POST /logs`: Ingests raw inference events. Runs PII redaction and writes records to Postgres.
- `GET /metrics`: Aggregates global statistics (average latency, P95 latency, error rates, token count sums, provider percentages).
- `WS /ws`: WebSocket endpoint. Streams live telemetry items and system aggregates to dashboard charts.
- `GET /health`: Service and Postgres connection diagnostics.

---

## 5. Architectural Tradeoffs

1. **Relational Database (PostgreSQL) vs. Document/Timeseries Store**
   - *Tradeoff*: Relational databases make structural joins (like fetching conversations and related messages) easy, but log tables can expand rapidly.
   - *Decision*: We used PostgreSQL since Prisma manages migrations easily and relational constraints are essential for chat history. For large production volumes, we can partition `inference_logs` by timestamp or offload them to a specialized timeseries database (like TimescaleDB or ClickHouse).

2. **Asynchronous Event-Driven Queue (Redis/BullMQ) vs. Inline Writes**
   - *Tradeoff*: Writing logs directly to the database inside the `/chat` response loop is simple but ties the user's chat latency directly to the database write speed.
   - *Decision*: We offloaded writes to a Redis queue. The SDK publishes the event in less than 5ms and returns immediately. The worker consumes the task asynchronously. Even if the database experiences lockups or the ingestion API fails, the user continues chatting uninterrupted.

3. **In-Browser Client-Side API Keys vs. Centralized Database Storage**
   - *Tradeoff*: Storing API keys on the server makes keys easy to share across users but increases the server's security footprint.
   - *Decision*: Keys are stored in the client's `localStorage` and sent over local HTTP headers. This respects user privacy, avoids database encryption complexities, and allows developer-centric testing.

4. **Fastify vs. Express**
   - *Tradeoff*: Express has a larger ecosystem, but Fastify features faster JSON serialization and native async/await lifecycle support.
   - *Decision*: We built the backend and ingestion APIs using Fastify to minimize routing overhead and easily stream Server-Sent Events (SSE).

---

## 6. System Design Notes & Lifecycle Details

### Request Lifecycle (User Chat Prompt)
1. The user types a message and clicks "Send".
2. Next.js inserts a temporary user bubble into the UI state and starts an SSE stream listener (creating an `AbortController` signal).
3. The Backend API receives the request, stores the new message in PostgreSQL, and updates the conversation's `updatedAt` field.
4. The Backend resolves the provider API credentials and invokes the LLM SDK's `chatStream` API.
5. As chunks are received from the LLM provider, they are piped directly to the user's browser via Server-Sent Events (SSE), giving sub-second responsiveness.
6. Once the stream ends or is cancelled:
   - The final full string is compiled and persisted in the database as an `assistant` message.
   - The SDK resolves the collected telemetry metrics and starts the event logging lifecycle.

### Event Logging Lifecycle (Asynchronous Pipeline)
1. The LLM SDK constructs an `InferenceMetrics` payload. It pushes the payload to the BullMQ Redis queue `inference_events` and returns immediately.
2. The `apps/worker` daemon pulls the event off the Redis queue.
3. The worker sends the payload via HTTP POST to the `/logs` endpoint of the `apps/ingestion` service.
4. The Ingestion service:
   - Validates the schema.
   - Run PII redaction to strip sensitive data (Emails, Phone numbers, Credit cards, Aadhaar, PAN) from previews.
   - Saves the sanitized log to the `inference_logs` table in PostgreSQL.
   - Queries PostgreSQL for updated global metrics (including a raw SQL `percentile_cont(0.95)` query for P95 latency).
   - Broadcasts the new telemetry item and fresh metrics to all active dashboard WebSocket clients.

### Failure Handling & Durability
- **Redis Queue Durability**: BullMQ is configured to retry failed jobs up to 5 times using **exponential backoff** (starting at 1,000ms delay). If the Ingestion service goes down, Redis caches jobs safely until it recovers.
- **Circuit Isolation**: If the background worker fails, it never impacts the chat flow. The backend handles chatbot operations completely isolated from logging errors.

### Scaling & Performance
- **Queue Concurrency**: The worker runs with a concurrency limit of `5` (configurable depending on core availability) to prevent database connection exhaustion under heavy load.
- **P95 Latency Performance**: P95 latency is evaluated on-demand using Postgres aggregates. In highly active systems, this database lookup should be replaced with a sliding-window calculation stored in Redis or pre-computed hourly to prevent CPU spikes.
- **WebSocket Broadcasting**: Websocket instances are tracked in an active server-side set. Dead sockets are pruned immediately on `close` or `error` events to avoid memory leaks.
