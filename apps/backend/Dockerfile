# =============================================================================
# MailZen – backend production container (NestJS / Node 20)
# Multi-stage build:
#   builder  → installs ALL deps, compiles TypeScript → dist/
#   runner   → production image, only prod deps + compiled JS
# Migrations run via compiled JS (no ts-node at runtime).
# =============================================================================

# ─── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /workspace

# Copy workspace manifests first for better layer caching.
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY libs/ ./libs/

# Install ALL dependencies (including devDeps needed for compilation).
# We install for backend and shared-types to ensure tsc is available for the library.
RUN npm ci --workspace backend --workspace @mailzen/shared-types --include-workspace-root

# Build the shared-types workspace so the backend can resolve its dist/ imports.
RUN npm run build --workspace @mailzen/shared-types

# Copy backend source.
COPY apps/backend/ ./apps/backend/

# Compile TypeScript → dist/ (includes data-source.js and migrations).
RUN npm run build --workspace backend

# ─── Stage 2: runner ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /workspace

# Copy workspace manifests.
COPY package.json package-lock.json ./
COPY apps/backend/package.json ./apps/backend/
COPY libs/ ./libs/

# Install ONLY production dependencies.
RUN npm ci --workspace backend --include-workspace-root --omit=dev \
    && npm cache clean --force

# Copy compiled output from builder.
COPY --from=builder /workspace/apps/backend/dist ./apps/backend/dist

WORKDIR /workspace/apps/backend

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Run compiled migrations (no ts-node needed) then start the server.
# data-source.js is the compiled version of src/database/data-source.ts
# NestJS compiles source into dist/src/ (not dist/ directly).
# We start the app; TYPEORM_RUN_MIGRATIONS=true tells TypeORM to auto-run
# migrations on DataSource.initialize() inside the app itself.
# No ts-node needed at runtime — all JS compiled in builder stage.
CMD ["node", "dist/src/main.js"]
