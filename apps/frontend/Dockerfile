# =============================================================================
# MailZen – frontend production container (Next.js 15 / Node 20)
# Multi-stage build:
#   deps     → installs prod dependencies
#   builder  → installs all deps + builds Next.js
#   runner   → minimal runtime image using Next.js standalone output
# NOTE:
#   NEXT_PUBLIC_* values are compiled into the bundle at build time.
#   Pass them as Docker build-args (--build-arg or Coolify build vars).
# =============================================================================

# ─── Stage 1: deps ───────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS deps

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY libs/ ./libs/

RUN npm ci --workspace frontend --include-workspace-root --omit=dev \
    && npm cache clean --force

# ─── Stage 2: builder ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY libs/ ./libs/

# Install all deps (dev too, needed for Next.js build).
RUN npm ci --workspace frontend --include-workspace-root

# Copy source.
COPY apps/frontend/ ./apps/frontend/

# Build-time public env vars — must be declared as ARG before ENV to allow
# docker build --build-arg and Coolify build-variable injection.
ARG NEXT_PUBLIC_GRAPHQL_ENDPOINT=https://localhost/graphql
ARG NEXT_PUBLIC_AUTH_ENABLED=true
ARG NEXT_PUBLIC_ENABLE_EMAIL_WARMUP=true
ARG NEXT_PUBLIC_ENABLE_SMART_REPLIES=true
ARG NEXT_PUBLIC_ENABLE_EMAIL_TRACKING=true
ARG NEXT_PUBLIC_DEFAULT_THEME=system

ENV NEXT_PUBLIC_GRAPHQL_ENDPOINT=${NEXT_PUBLIC_GRAPHQL_ENDPOINT}
ENV NEXT_PUBLIC_AUTH_ENABLED=${NEXT_PUBLIC_AUTH_ENABLED}
ENV NEXT_PUBLIC_ENABLE_EMAIL_WARMUP=${NEXT_PUBLIC_ENABLE_EMAIL_WARMUP}
ENV NEXT_PUBLIC_ENABLE_SMART_REPLIES=${NEXT_PUBLIC_ENABLE_SMART_REPLIES}
ENV NEXT_PUBLIC_ENABLE_EMAIL_TRACKING=${NEXT_PUBLIC_ENABLE_EMAIL_TRACKING}
ENV NEXT_PUBLIC_DEFAULT_THEME=${NEXT_PUBLIC_DEFAULT_THEME}

RUN npm run build --workspace frontend

# ─── Stage 3: runner ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /workspace/apps/frontend

ENV NODE_ENV=production
ENV PORT=3000

# Copy built output and prod deps.
COPY --from=builder /workspace/apps/frontend/.next ./.next
COPY --from=builder /workspace/apps/frontend/public ./public
COPY --from=builder /workspace/apps/frontend/package.json ./package.json
COPY --from=builder /workspace/apps/frontend/next.config.ts ./next.config.ts
COPY --from=deps /workspace/apps/frontend/node_modules ./node_modules
COPY --from=deps /workspace/node_modules /workspace/node_modules
COPY --from=deps /workspace/package.json /workspace/package.json

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
