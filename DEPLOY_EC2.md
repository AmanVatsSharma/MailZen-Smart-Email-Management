# Deploy MailZen to Amazon EC2 with Docker

This guide walks you through provisioning an EC2 instance and deploying the application stack (Postgres, Redis, Backend, Frontend) with Docker Compose.

## Prerequisites
- An AWS account
- A domain (optional but recommended)
- SSH keypair available locally

## 1) Create the EC2 instance
1. In AWS Console, go to EC2 → Instances → Launch Instance.
2. Name: MailZen
3. AMI: Ubuntu Server 22.04 LTS (or Amazon Linux 2023)
4. Instance type: t3.small (or higher for production)
5. Key pair: Select an existing key or create a new one
6. Network settings:
   - Create/Select a security group allowing inbound:
     - 22/tcp from your IP (SSH)
     - 80/tcp (HTTP)
     - 443/tcp (HTTPS)
     - 3000/tcp (Frontend) [optional if using a reverse proxy]
     - 4000/tcp (Backend GraphQL) [optional if using a reverse proxy]
7. Storage: 20 GB gp3 (adjust as needed)
8. Launch the instance

## 2) Connect and install dependencies
SSH into the instance:
```bash
ssh -i /path/to/key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```
Update and install Docker + Compose:
```bash
sudo apt-get update -y
sudo apt-get upgrade -y
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER
newgrp docker
# Install docker compose plugin
sudo apt-get install -y docker-compose-plugin
# Verify versions
docker --version
docker compose version
```

## 3) Clone your repository
```bash
sudo apt-get install -y git
cd ~
git clone YOUR_REPO_URL app
cd app
```

If you need private access, configure SSH with GitHub/GitLab accordingly.

## 4) Configure environment variables
Copy `.env.example` to `.env` and edit values:
```bash
cp .env.example .env
nano .env
```
Important settings for production:
- DATABASE_URL should point to the `postgres` service (Compose sets it automatically for backend). For external DB, set the full URL.
- JWT_SECRET: set a strong random value
- SMTP_*: configure if you plan to send emails
- NEXT_PUBLIC_GRAPHQL_ENDPOINT: set to your public backend URL, e.g. `https://api.example.com/graphql`

## 5) Build and start with Docker Compose
```bash
docker compose build --no-cache
docker compose up -d
```
Check containers:
```bash
docker compose ps
docker compose logs -f backend | cat
```

The stack exposes:
- Frontend: http://YOUR_EC2_PUBLIC_IP:3000
- Backend (GraphQL): http://YOUR_EC2_PUBLIC_IP:4000/graphql

## 6) Optional: Add a reverse proxy with HTTPS (Caddy)
For production, terminate TLS and route to services. Example Caddy (single file) setup:

Create `Caddyfile` in project root:
```bash
:80 {
  redir https://{host}{uri}
}

example.com {
  encode zstd gzip
  @frontend {
    path /*
  }
  reverse_proxy frontend:3000
}

api.example.com {
  encode zstd gzip
  reverse_proxy backend:4000
}
```
Add to `docker-compose.yml`:
```yaml
  caddy:
    image: caddy:2-alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile
    depends_on:
      - frontend
      - backend
```
Update your DNS A records for `example.com` and `api.example.com` to the EC2 public IP, then:
```bash
docker compose up -d caddy
```
Caddy will automatically issue and renew Let's Encrypt certificates.

## 7) Prisma migrations
The backend container runs `prisma migrate deploy` automatically on start. To trigger manually:
```bash
docker compose exec backend npx prisma migrate deploy
```

## 8) Health, logs, and updates
- View logs: `docker compose logs -f backend | cat`
- Restart service: `docker compose restart backend`
- Update code: `git pull && docker compose build && docker compose up -d`

## 9) Backups
- Postgres data persists in the `postgres_data` volume. Snapshot the volume by regularly dumping:
```bash
docker compose exec postgres pg_dump -U $POSTGRES_USER $POSTGRES_DB > backup.sql
```

## 10) Common issues
- 502/Bad Gateway via proxy: confirm services are healthy (`docker compose ps`) and URLs in `.env` are correct
- Migrations not applied: check backend logs and DATABASE_URL
- CORS errors: set `FRONTEND_URL` to your frontend origin

## 11) Security hardening (recommended)
- Use a private subnet with a load balancer for production
- Restrict SSH to a bastion or specific IPs
- Enable automatic security updates
- Store secrets in AWS SSM Parameter Store or Secrets Manager

---

You are now running MailZen on EC2 with Docker.