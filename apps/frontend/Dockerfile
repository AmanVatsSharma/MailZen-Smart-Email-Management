# =============================================================================
# MailZen – frontend production container (Next.js 15 / Node 20)
# Multi-stage build:
#   builder  → installs all deps + builds Next.js
#   runner   → minimal runtime image
# NOTE:
#   NEXT_PUBLIC_* values are compiled into the bundle at build time.
#   Pass them as Docker build-args (--build-arg or Coolify build vars).
# =============================================================================

# ─── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /workspace

# Copy workspace manifests for layer caching.
COPY package.json package-lock.json ./
COPY apps/frontend/package.json ./apps/frontend/
COPY libs/ ./libs/

# Install all deps (dev included — needed for Next.js + Sentry build).
RUN npm ci --workspace frontend --include-workspace-root

# Copy full frontend source.
COPY apps/frontend/ ./apps/frontend/

# Build-time public env vars — declared as ARG before ENV so
# docker build --build-arg and Coolify build-variable injection works.
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

# Build must run from within the app directory so tsconfig @/* paths resolve.
WORKDIR /workspace/apps/frontend
RUN npm run build

# ─── Stage 2: runner (Next.js standalone) ────────────────────────────────────
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# next.config.ts has output: 'standalone' — copy the self-contained server.
COPY --from=builder /workspace/apps/frontend/.next/standalone ./
COPY --from=builder /workspace/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=builder /workspace/apps/frontend/public ./apps/frontend/public

EXPOSE 3000

# The standalone server lives at apps/frontend/server.js relative to WORKDIR /app
CMD ["node", "apps/frontend/server.js"]
