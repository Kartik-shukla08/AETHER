FROM node:20-alpine AS builder
RUN apk add --no-cache openssl
WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json tsconfig.json ./

# Copy ingestion service manifest
COPY apps/ingestion/package.json ./apps/ingestion/

# Install dependencies (cached)
RUN npm ci

# Copy database schema and generate Prisma Client
COPY prisma ./prisma/
RUN npx prisma generate

# Copy source code (changes here will NOT trigger npm ci!)
COPY apps/ingestion ./apps/ingestion/

# Build Ingestion
RUN npm run build --workspace=@llm-logging/ingestion

# Runner stage
FROM node:20-alpine AS runner
RUN apk add --no-cache openssl
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY prisma ./prisma/
COPY apps/ingestion/package.json ./apps/ingestion/
COPY --from=builder /app/node_modules ./node_modules/
COPY --from=builder /app/apps/ingestion/dist ./apps/ingestion/dist/

EXPOSE 4010
ENV PORT_INGESTION=4010
ENV HOST=0.0.0.0
ENV NODE_ENV=production

# Run database migrations just in case, then start the ingestion service
CMD npx prisma migrate deploy && npm run start --workspace=@llm-logging/ingestion
