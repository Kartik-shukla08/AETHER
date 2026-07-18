# Railway Deployment Guide

This guide explains how to deploy the LLM Logging Platform monorepo to Railway. 

The platform consists of:
1. **PostgreSQL** (Database)
2. **Redis** (Message Broker & Queue)
3. **Backend Service** (Express REST API)
4. **Ingestion Service** (Real-time WebSocket & REST log intake)
5. **Worker Service** (BullMQ background processor)
6. **Frontend Service** (Next.js Dashboard UI)

---

## Step 1: Provision Databases on Railway

1. Go to your [Railway Dashboard](https://railway.app/) and create a new project.
2. Click **+ Add Service** and select **Database -> PostgreSQL**.
3. Click **+ Add Service** again and select **Database -> Redis**.

Railway will automatically provision these services and generate connection strings accessible in your project's variables as `${{ Postgres.DATABASE_URL }}` and `${{ Redis.REDIS_URL }}`.

---

## Step 2: Deploy the Services

For each of the four application components, you will add a service from your GitHub repository:
Click **+ Add Service** -> **GitHub Repo** -> Choose your `AETHER` repository.

Rename the services in Railway to make them easy to identify (e.g., `backend`, `ingestion`, `worker`, `frontend`).

### 1. Ingestion Service
- **Source**: GitHub Repository
- **Dockerfile Path** (Under Settings): `apps/ingestion/Dockerfile`
- **Environment Variables**:
  - `DATABASE_URL`: `${{ Postgres.DATABASE_URL }}`
  - `PORT_INGESTION`: `4010`
  - `HOST`: `0.0.0.0`
- **Networking**: Expose port `4010` and generate a public domain (e.g., `https://ingestion-production.up.railway.app`).

### 2. Backend Service
- **Source**: GitHub Repository
- **Dockerfile Path** (Under Settings): `apps/backend/Dockerfile`
- **Environment Variables**:
  - `DATABASE_URL`: `${{ Postgres.DATABASE_URL }}`
  - `REDIS_URL`: `${{ Redis.REDIS_URL }}`
  - `PORT`: `4000`
  - `HOST`: `0.0.0.0`
- **Networking**: Expose port `4000` and generate a public domain (e.g., `https://backend-production.up.railway.app`).

### 3. Worker Service
- **Source**: GitHub Repository
- **Dockerfile Path** (Under Settings): `apps/worker/Dockerfile`
- **Environment Variables**:
  - `REDIS_URL`: `${{ Redis.REDIS_URL }}`
  - `INGESTION_URL`: `http://ingestion.railway.internal:4010/logs` (Uses Railway's private networking to connect directly to the ingestion service).
- **Networking**: No public ports need to be exposed.

### 4. Frontend Service (Next.js)
- **Source**: GitHub Repository
- **Dockerfile Path** (Under Settings): `apps/frontend/Dockerfile`
- **Environment Variables** (Set these before building/deploying so they are injected at build-time):
  - `NEXT_PUBLIC_BACKEND_URL`: Your Backend Service's public domain URL (e.g., `https://backend-production.up.railway.app`).
  - `NEXT_PUBLIC_INGESTION_WS_URL`: Your Ingestion Service's WebSocket public URL (e.g., `wss://ingestion-production.up.railway.app/ws`).
- **Networking**: Expose port `3000` and generate a public domain.

---

## Step 3: Database Migrations
Both the `backend` and `ingestion` services are configured to run `npx prisma migrate deploy` automatically before starting. Railway will run this command as part of the startup cycle, so your Postgres database tables will be created automatically.
