FROM node:20-alpine AS builder
WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json tsconfig.json ./

# Copy frontend service manifest
COPY apps/frontend/package.json ./apps/frontend/

# Install dependencies (cached)
RUN npm ci

# Copy source code (changes here will NOT trigger npm ci!)
COPY apps/frontend ./apps/frontend/

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_BACKEND_URL
ARG NEXT_PUBLIC_INGESTION_WS_URL
ENV NEXT_PUBLIC_BACKEND_URL=$NEXT_PUBLIC_BACKEND_URL
ENV NEXT_PUBLIC_INGESTION_WS_URL=$NEXT_PUBLIC_INGESTION_WS_URL

# Build Next.js
RUN npm run build --workspace=@llm-logging/frontend

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/frontend/next.config.ts ./apps/frontend/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/apps/frontend/.next ./apps/frontend/.next/
COPY --from=builder /app/apps/frontend/public ./apps/frontend/public/

EXPOSE 3000
ENV PORT=3000
ENV HOST=0.0.0.0
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

CMD ["npm", "run", "start", "--workspace=@llm-logging/frontend"]
