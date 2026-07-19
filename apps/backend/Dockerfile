FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copy root manifests and configuration
COPY package.json package-lock.json tsconfig.json ./

# Copy package manifests for workspace packages needed
COPY packages/llm-sdk/package.json ./packages/llm-sdk/
COPY apps/backend/package.json ./apps/backend/
COPY apps/frontend/package.json ./apps/frontend/
COPY apps/ingestion/package.json ./apps/ingestion/
COPY apps/worker/package.json ./apps/worker/

# Install dependencies (cached unless package.json files change)
RUN npm ci

# Copy database schema and generate Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code (changes here will NOT trigger npm ci!)
COPY packages/llm-sdk ./packages/llm-sdk/
COPY apps/backend ./apps/backend/

# Build SDK and Backend
RUN npm run build --workspace=@llm-logging/llm-sdk
RUN npm run build --workspace=@llm-logging/backend

# Runner stage
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma/
COPY packages/llm-sdk/package.json ./packages/llm-sdk/
COPY apps/backend/package.json ./apps/backend/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/packages/llm-sdk/dist ./packages/llm-sdk/dist/
COPY --from=builder /app/apps/backend/dist ./apps/backend/dist/

EXPOSE 4000
ENV PORT=4000
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Run database migrations before starting the backend
CMD npx prisma migrate deploy && npm run start --workspace=@llm-logging/backend
