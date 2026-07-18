FROM node:20-alpine AS builder
WORKDIR /app

# Copy root manifests
COPY package.json package-lock.json tsconfig.json ./

# Copy worker service manifest
COPY apps/worker/package.json ./apps/worker/

# Install dependencies (cached)
RUN npm ci

# Copy source code (changes here will NOT trigger npm ci!)
COPY apps/worker ./apps/worker/

# Build Worker
RUN npm run build --workspace=@llm-logging/worker

# Runner stage
FROM node:20-alpine AS runner
WORKDIR /app

COPY package.json package-lock.json tsconfig.json ./
COPY apps/worker/package.json ./apps/worker/
COPY --from=builder /app/apps/worker/dist ./apps/worker/dist/
COPY --from=builder /app/node_modules ./node_modules/

ENV NODE_ENV=production

CMD ["npm", "run", "start", "--workspace=@llm-logging/worker"]
