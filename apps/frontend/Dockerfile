FROM node:20-bookworm-slim

# -----------------------------------------------------------------------------
# MailZen frontend production container (Next.js).
# NOTE:
# - NEXT_PUBLIC_* values are compiled into the frontend bundle at build time.
# - For EC2 deployment we pass NEXT_PUBLIC_GRAPHQL_ENDPOINT during image build.
# -----------------------------------------------------------------------------

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

WORKDIR /workspace

# Copy repository (respecting root .dockerignore).
COPY . .

# Install frontend workspace dependencies and build.
RUN npm ci --workspace frontend --include-workspace-root
RUN npm run build --workspace frontend

WORKDIR /workspace/apps/frontend

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3000"]
