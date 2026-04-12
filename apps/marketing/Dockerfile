FROM node:20-bookworm-slim

# -----------------------------------------------------------------------------
# MailZen marketing site production container (Next.js).
# NEXT_PUBLIC_* variables that differ per deployment can be set as build args.
# -----------------------------------------------------------------------------

ARG NEXT_PUBLIC_APP_URL=https://app.mailzen.email

ENV NEXT_PUBLIC_APP_URL=${NEXT_PUBLIC_APP_URL}

WORKDIR /workspace

# Copy repository (respecting root .dockerignore).
COPY . .

# Install marketing workspace dependencies and build.
RUN npm ci --workspace marketing --include-workspace-root
RUN npm run build --workspace marketing

WORKDIR /workspace/apps/marketing

ENV NODE_ENV=production
ENV PORT=3001

EXPOSE 3001

CMD ["npm", "run", "start", "--", "-H", "0.0.0.0", "-p", "3001"]
