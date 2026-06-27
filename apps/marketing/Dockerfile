# =============================================================================
# MailZen – marketing site production container (Next.js 15 / Node 20)
# Multi-stage build:
#   builder  → installs all deps + builds Next.js (standalone output)
#   runner   → minimal runtime using Next.js standalone server
# NOTE:
#   NEXT_PUBLIC_APP_URL is compiled into the bundle at build time.
#   Pass it as a Docker build-arg or Coolify build variable.
# =============================================================================

# ─── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /workspace

# Copy workspace manifests for layer caching.
COPY package.json package-lock.json ./
COPY apps/marketing/package.json ./apps/marketing/

# Install all dependencies (dev included — needed for Next.js build).
RUN npm ci --workspace marketing --include-workspace-root

# Copy full marketing source (tsconfig @/* paths resolve from apps/marketing/).
COPY apps/marketing/ ./apps/marketing/

ARG NEXT_PUBLIC_APP_URL=https://app.mailzen.email
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

# Build must run from within the app directory so tsconfig paths resolve.
WORKDIR /workspace/apps/marketing
RUN npm run build

# ─── Stage 2: runner (Next.js standalone) ────────────────────────────────────
FROM node:20-bookworm-slim AS runner

ENV NODE_ENV=production
ENV PORT=3001
ENV HOSTNAME=0.0.0.0

WORKDIR /app

# next.config.ts has output: 'standalone' — copy the self-contained server.
COPY --from=builder /workspace/apps/marketing/.next/standalone ./
COPY --from=builder /workspace/apps/marketing/.next/static ./apps/marketing/.next/static
COPY --from=builder /workspace/apps/marketing/public ./apps/marketing/public

EXPOSE 3001

# The standalone server lives at apps/marketing/server.js relative to WORKDIR /app
CMD ["node", "apps/marketing/server.js"]
