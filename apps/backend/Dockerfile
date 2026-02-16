FROM node:20-bookworm-slim

# -----------------------------------------------------------------------------
# MailZen backend production container.
# - Uses npm workspace-aware install for the backend app.
# - Builds NestJS output before runtime start.
# - Runs DB migrations on container start for safer first boot on EC2.
# -----------------------------------------------------------------------------

WORKDIR /workspace

# Copy repository (respecting root .dockerignore).
COPY . .

# Install backend workspace dependencies.
RUN npm ci --workspace backend --include-workspace-root

# Build backend into apps/backend/dist.
RUN npm run build --workspace backend

WORKDIR /workspace/apps/backend

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Run migrations before starting the API process.
# This keeps first-time deployment simple for non-technical operators.
CMD ["bash", "-lc", "npm run migration:run && npm run start:prod"]
