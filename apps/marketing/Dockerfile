# =============================================================================
# MailZen – marketing site production container (Next.js 15 / Node 20)
# Multi-stage build:
#   builder  → installs all deps + builds Next.js
#   runner   → minimal runtime image
# NOTE:
#   NEXT_PUBLIC_APP_URL is compiled into the bundle at build time.
#   Pass it as a Docker build-arg or Coolify build variable.
# =============================================================================

# ─── Stage 1: builder ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /workspace

COPY package.json package-lock.json ./
COPY apps/marketing/package.json ./apps/marketing/
COPY libs/ ./libs/

RUN npm ci --workspace marketing --include-workspace-root

COPY apps/marketing/ ./apps/marketing/

ARG NEXT_PUBLIC_APP_URL=https://app.mailzen.email
ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

RUN npm run build --workspace marketing

# ─── Stage 2: runner ─────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /workspace/apps/marketing

ENV NODE_ENV=production
ENV PORT=3001

COPY --from=builder /workspace/apps/marketing/.next ./.next
COPY --from=builder /workspace/apps/marketing/public ./public
COPY --from=builder /workspace/apps/marketing/package.json ./package.json
COPY --from=builder /workspace/apps/marketing/next.config.ts ./next.config.ts
COPY --from=builder /workspace/node_modules /workspace/node_modules
COPY --from=builder /workspace/package.json /workspace/package.json

EXPOSE 3001

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3001"]
