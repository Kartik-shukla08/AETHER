
# LLM Inference Logging System
## Product Requirements Document (PRD) + Engineering Architecture
Version: 1.0

---

# 1. Objective

Build a production-inspired AI chatbot platform that demonstrates modern backend engineering practices, observability, modular architecture, and scalability.

This project is **not** about building the smartest chatbot. It is about demonstrating how real AI products are architected.

The final system should consist of multiple independent services that communicate cleanly and can be deployed independently.

---

# 2. Primary Goals

## Functional

- Multi-turn chatbot
- Conversation persistence
- LLM abstraction layer
- Inference logging
- Telemetry ingestion
- Analytics dashboard

## Engineering

- Clean architecture
- Modular services
- Dockerized development
- Production-ready folder structure
- Provider abstraction
- Event-driven logging

---

# 3. High-Level Architecture

```text
                User
                  │
                  ▼
      ┌─────────────────────┐
      │  Next.js Frontend   │
      └─────────┬───────────┘
                │ HTTP / SSE
                ▼
      ┌─────────────────────┐
      │  Backend API        │
      └─────────┬───────────┘
                │
        calls only SDK
                ▼
      ┌─────────────────────┐
      │ LLM SDK / Wrapper   │
      └───────┬───────┬─────┘
              │       │
      LLM Call│       │Publish Event
              ▼       ▼
      OpenAI/Gemini  Redis Queue
                      │
                      ▼
                 Worker Service
                      │
                      ▼
             Ingestion Service
                      │
                      ▼
                 PostgreSQL
```

---

# 4. Services

## Frontend

Responsibilities

- Chat UI
- Conversation list
- Resume conversation
- Cancel generation
- Dashboard
- Stream tokens

Never talks directly to LLM providers.

---

## Backend API

Responsibilities

- Authentication (optional)
- Conversation CRUD
- Message persistence
- Context loading
- Streaming endpoint
- Calls SDK

Routes

GET /conversations

POST /conversations

GET /conversations/:id

POST /chat

DELETE /chat/cancel

---

## LLM SDK

Purpose

Abstract every provider behind one interface.

```ts
await llm.chat({
 provider,
 model,
 messages,
 stream
})
```

Responsibilities

- Provider selection
- Retry policy
- Latency timing
- Token extraction
- Metadata collection
- Event publishing
- Error normalization

Should never know anything about databases.

---

## Ingestion Service

Purpose

Receive telemetry events.

Routes

POST /logs

Responsibilities

- Validate payload
- Sanitize
- PII Redaction
- Save logs
- Return quickly

---

## Worker

Consumes Redis queue.

Responsibilities

- Read events
- Retry failed jobs
- Forward to ingestion
- Dead-letter failed jobs (optional)

---

# 5. Database Schema

## conversations

- id
- title
- created_at
- updated_at

## messages

- id
- conversation_id
- role
- content
- provider
- created_at

## inference_logs

- id
- conversation_id
- provider
- model
- latency_ms
- input_tokens
- output_tokens
- total_tokens
- request_preview
- response_preview
- status
- error_message
- created_at

Recommended ORM: Prisma.

---

# 6. Event Flow

1. User submits message.
2. Backend loads conversation.
3. Backend calls SDK.
4. SDK starts timer.
5. SDK calls provider.
6. SDK receives response.
7. SDK publishes inference event to Redis.
8. SDK returns response immediately.
9. Worker reads event.
10. Worker calls ingestion service.
11. Ingestion validates and stores log.

Important rule:

Failure in steps 9–11 MUST NOT affect the chatbot.

---

# 7. Streaming

Preferred: Server Sent Events (SSE)

Flow

Browser
→ Backend
→ Provider stream
→ Backend
→ Browser

Display tokens as they arrive.

---

# 8. Multi-provider Design

Use Strategy Pattern.

```text
ProviderFactory

├── OpenAIProvider
├── GeminiProvider
└── Future:
    Claude
    DeepSeek
```

Frontend selects provider.

SDK decides implementation.

No provider-specific code outside SDK.

---

# 9. Dashboard

Metrics

- Average latency
- P95 latency
- Total requests
- Success rate
- Error rate
- Requests by provider
- Token consumption
- Requests over time

Recommended library:
Recharts.

---

# 10. PII Redaction

Before storing logs replace

- Emails
- Phone numbers
- Credit cards
- Aadhaar
- PAN

Example

Input

"My email is john@gmail.com"

Stored

"My email is [EMAIL]"

Provider still receives original prompt.

---

# 11. Docker Compose

Goal

One command starts everything.

```bash
docker compose up
```

Services

- frontend
- backend
- ingestion
- postgres
- redis

Each service has:

- Dockerfile
- Environment variables
- Health check

---

# 12. Kubernetes (Stretch Goal)

Deploy same services using

- Minikube
- Kind
- k3s

Need

- Deployment
- Service
- ConfigMap
- Secret
- PersistentVolume (optional)

---

# 13. Folder Structure

```text
apps/
    frontend/
    backend/
    ingestion/
    worker/

packages/
    llm-sdk/
    shared/

prisma/

docker/

docs/

docker-compose.yml

README.md
```

---

# 14. Development Phases

## Phase 1

- Setup repo
- Prisma
- PostgreSQL
- Frontend
- Backend

## Phase 2

- Chat
- Conversation persistence

## Phase 3

- SDK
- OpenAI integration

## Phase 4

- Logging
- Ingestion API

## Phase 5

- Redis queue
- Worker

## Phase 6

- Dashboard

## Phase 7

- Docker Compose

## Phase 8

- Multi-provider

## Phase 9

- Kubernetes (optional)

---

# 15. Deliverables

Repository

- Complete source

README

Must explain

- Setup
- Architecture
- Database
- API
- Tradeoffs
- Improvements

Architecture Notes

Explain

- Request lifecycle
- Event lifecycle
- Failure handling
- Scaling
- Queue

Demo

Hosted application OR Loom video.

---

# 16. Acceptance Criteria

Mandatory

- Chat works
- Conversations persist
- SDK wraps providers
- Ingestion service stores logs
- PostgreSQL schema complete

Interview Bonuses

- Multi-provider
- Streaming
- Dashboard
- Docker Compose
- Event-driven logging
- PII redaction

Stretch

- Kubernetes

---

# 17. Engineering Rules

- Never call providers outside SDK.
- Logging must be asynchronous.
- Chat latency should never depend on logging.
- Services should be independently deployable.
- Every service has its own responsibility.
- Prefer composition over tight coupling.
- Build for maintainability rather than shortcuts.
