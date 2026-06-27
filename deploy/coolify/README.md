# MailZen – Coolify Deployment Guide

> **Reverse proxy:** Coolify uses **Traefik** (built-in). This compose file does **not** include Caddy.
> TLS certificates are issued automatically by Traefik via Let's Encrypt.

---

## Prerequisites

| Requirement | Details |
|---|---|
| Coolify installed | v4+ on a VPS (DigitalOcean, Hetzner, etc.) |
| Domain DNS | `mail.example.com` → server IP (A record) |
| `www` DNS | `www.mail.example.com` → server IP (A record) |
| Port 80 & 443 open | Needed for Traefik / Let's Encrypt |
| Git remote | Code pushed to GitHub / GitLab / Gitea |

---

## Architecture

```
Internet
  │
  ▼
Traefik (Coolify built-in, ports 80/443, auto TLS)
  ├── mail.example.com/graphql  →  backend:4000
  ├── mail.example.com/auth/*   →  backend:4000
  ├── mail.example.com/*        →  frontend:3000
  └── www.mail.example.com/*    →  marketing:3001

Docker internal network (mailzen-internal):
  backend ←→ postgres
  backend ←→ redis
  backend ←→ ai-agent-platform
```

---

## Step-by-Step Deployment

### 1. Prepare your environment file

```bash
cp deploy/coolify/.env.coolify.example deploy/coolify/.env.coolify
```

Edit `.env.coolify` and fill in **every field marked ← REQUIRED**:
- `MAILZEN_DOMAIN` — your apex domain (e.g. `mail.yourdomain.com`)
- `NEXT_PUBLIC_GRAPHQL_ENDPOINT` — `https://<MAILZEN_DOMAIN>/graphql`
- `POSTGRES_PASSWORD` — strong random password
- `JWT_SECRET` — random string ≥ 32 chars
- `OAUTH_STATE_SECRET` — random string ≥ 32 chars
- `SECRETS_KEY` — random string ≥ 32 chars
- `PROVIDER_SECRETS_KEYRING` — `default:<random ≥ 32 chars>`
- `AI_AGENT_PLATFORM_KEY` — random string

Generate random secrets quickly:
```bash
# Linux/Mac
openssl rand -base64 40

# Or use Node.js
node -e "console.log(require('crypto').randomBytes(40).toString('base64'))"
```

> **Do NOT commit `.env.coolify` to git.** It is gitignored by default.

---

### 2. Push code to your Git remote

```bash
git add -A
git commit -m "chore: add Coolify deployment"
git push origin main
```

---

### 3. Create a new resource in Coolify

1. Open your Coolify dashboard → **New Resource**
2. Select **Docker Compose**
3. Connect your Git repository
4. Set **Compose file path** to: `deploy/coolify/docker-compose.yml`
5. Set **Base directory** to: `/` (repo root — the compose build contexts reference `../..`)

---

### 4. Configure environment variables in Coolify UI

In the Coolify resource → **Environment Variables** tab, paste the contents of your `.env.coolify`.

> ⚠️ **CRITICAL — Build Variables for Next.js**
>
> The following variables must be set as **Build Variables** (not just runtime env vars) in Coolify, because Next.js bakes `NEXT_PUBLIC_*` values into the JavaScript bundle at build time:
>
> - `NEXT_PUBLIC_GRAPHQL_ENDPOINT`
> - `NEXT_PUBLIC_AUTH_ENABLED`
> - `NEXT_PUBLIC_ENABLE_EMAIL_WARMUP`
> - `NEXT_PUBLIC_ENABLE_SMART_REPLIES`
> - `NEXT_PUBLIC_ENABLE_EMAIL_TRACKING`
> - `NEXT_PUBLIC_DEFAULT_THEME`
> - `NEXT_PUBLIC_APP_URL`
>
> In Coolify UI: tick the **"Build Variable"** checkbox for each of these.

---

### 5. Configure domains in Coolify

In the Coolify resource → **Domains** tab:
- Add `mail.yourdomain.com`
- Add `www.mail.yourdomain.com`

Coolify will auto-provision TLS via Let's Encrypt.

---

### 6. Deploy

Click **Deploy** in Coolify UI. Build logs will stream live.

First deploy is slower (building all images). Subsequent deploys are faster (Docker layer cache).

**Expected startup order:**
1. `postgres` + `redis` (parallel, ~10s)
2. `ai-agent-platform` (~30–60s for Python deps to warm up)
3. `backend` (runs DB migrations automatically, ~15s)
4. `frontend` + `marketing` (parallel, ~10s)

Total cold-start: **~2–4 minutes**

---

### 7. Verify deployment

```bash
# Check all containers are running
docker ps --filter "name=mailzen"

# View backend logs (migration output + startup)
docker logs mailzen-backend -f

# Check health endpoints
curl -f https://mail.yourdomain.com/health
curl -f https://mail.yourdomain.com/graphql
```

---

## Updating / Redeploying

Push new commits to your Git branch and click **Redeploy** in Coolify (or enable auto-deploy on push).

Migrations run automatically on every backend container start. Rollback is handled by TypeORM's migration revert if needed.

---

## Troubleshooting

### `coolify` network not found
```
Error: network coolify declared as external, but could not be found
```
Coolify creates this network automatically when it's installed. If you're testing outside Coolify:
```bash
docker network create coolify
```

### Frontend shows wrong API URL
The `NEXT_PUBLIC_GRAPHQL_ENDPOINT` was not passed as a **Build Variable**. Rebuild with the variable set correctly in Coolify's **Build Variables** section.

### Backend won't start (migration error)
Check logs:
```bash
docker logs mailzen-backend --tail 50
```
If the migration fails, connect to postgres and inspect:
```bash
docker exec -it mailzen-postgres psql -U mailzen -d mailzen -c "SELECT * FROM typeorm_migrations ORDER BY timestamp DESC LIMIT 10;"
```

### AI platform unhealthy
The backend has `AI_AGENT_PLATFORM_REQUIRED=false` so it will still start. The AI features will be disabled until the platform recovers. Check:
```bash
docker logs mailzen-ai-agent-platform -f
```

---

## Security Checklist

- [ ] All `← REQUIRED` secrets are filled with strong random values
- [ ] `.env.coolify` is NOT committed to git (check `.gitignore`)
- [ ] `TYPEORM_SYNCHRONIZE=false` in production
- [ ] `MAILZEN_SESSION_COOKIE_SECURE=true`
- [ ] OAuth redirect URIs updated to your real domain in Google/Microsoft consoles
- [ ] Sentry DSN configured for error tracking (optional but recommended)

---

## File Structure

```
deploy/
├── coolify/
│   ├── docker-compose.yml        ← Coolify compose (this file's sibling)
│   ├── .env.coolify.example      ← Template — copy to .env.coolify
│   └── README.md                 ← This file
└── ec2/
    ├── docker-compose.yml        ← EC2 + Caddy compose
    ├── .env.ec2.example          ← EC2 env template
    ├── Caddyfile                 ← Caddy reverse proxy config
    └── README.md                 ← EC2 deployment guide
```
