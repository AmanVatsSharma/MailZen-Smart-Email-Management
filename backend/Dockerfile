# syntax=docker/dockerfile:1

FROM node:22-alpine AS builder
WORKDIR /app

# Install build tools for native deps (e.g., bcrypt)
RUN apk add --no-cache python3 make g++

COPY package*.json ./
RUN npm ci

COPY prisma ./prisma
COPY nest-cli.json ./
COPY tsconfig*.json ./
COPY src ./src

# Generate Prisma client and build NestJS
RUN npm run build


FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copy runtime artifacts
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

EXPOSE 4000

# Start the server (TypeORM will sync schema in non-production if enabled)
CMD sh -c "node dist/main.js"

