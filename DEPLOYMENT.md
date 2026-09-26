# Deployment Guide — GreenTrack

Three deployment targets, from least to most hands-on.

---

## 1. Railway (easiest — recommended for this project's size)

Railway builds each service from its own Dockerfile; it doesn't run `docker-compose.yml` directly, so you create three separate services in one Railway project.

1. **Push this repo to GitHub** (with the `frontend/`, `backend/`, `docker-compose.yml` layout as-is).
2. **New Project → Deploy from GitHub repo.**
3. **Database**: Railway → New → Database → **MySQL**. Copy the connection string it gives you — you'll use it as `DATABASE_URL`.
4. **Backend service**: New → GitHub Repo → same repo, set **Root Directory** to `backend`. Railway detects the Dockerfile automatically. Add environment variables (Settings → Variables):
   - `DATABASE_URL` — from the MySQL plugin
   - `ALLOWED_ORIGINS` — your frontend's Railway URL, e.g. `https://greentrack-frontend.up.railway.app`
   - `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TO_NUMBER`
   - `GITHUB_WEBHOOK_SECRET`
   - `NOTION_TOKEN`, `NOTION_DATABASE_ID`, `NOTION_TITLE_PROPERTY`
   - Railway sets `PORT` automatically — the app already reads `process.env.PORT`, no change needed.
   - Run the migration once, from Railway's shell for this service: `npx prisma migrate deploy`.
5. **Frontend service**: New → GitHub Repo → same repo, **Root Directory** = `frontend`. Add:
   - `API_BASE_URL` = your backend service's public Railway URL (e.g. `https://greentrack-backend.up.railway.app`)
   - `WHATSAPP_NUMBER` = your WhatsApp number
6. Both services get free HTTPS and a `*.up.railway.app` URL automatically. Add a custom domain under each service's Settings → Networking if you have one.

Cost note: three small services (frontend, backend, MySQL) fit comfortably in Railway's usage-based free/starter tier for a project this size.

---

## 2. VPS (DigitalOcean Droplet, Linode, EC2, etc. — full control)

This is where `docker-compose.yml` gets used as-is.

1. Provision a small VPS (1 vCPU / 1–2GB RAM is enough for this stack). Install Docker + the Compose plugin:
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
2. Clone the repo onto the server, `cd` into it.
3. `cp .env.example .env` and fill in real values — **especially strong MySQL passwords** and `ALLOWED_ORIGINS` set to your real domain.
4. Set `FRONTEND_API_BASE_URL` in `.env` to your real public backend URL (see step 6 — you'll be putting a domain in front of it).
5. `docker compose up -d --build`, then `docker compose exec backend npx prisma migrate deploy`.
6. **Put a reverse proxy with HTTPS in front of both services.** `docker-compose.yml` publishes the frontend on host port 8080 and the backend on 4000 — those aren't meant to be exposed directly to the internet over plain HTTP. The simplest option is [Caddy](https://caddyserver.com/), which handles Let's Encrypt certificates automatically:
   ```
   # /etc/caddy/Caddyfile
   greentrack.africa {
       reverse_proxy localhost:8080
   }
   api.greentrack.africa {
       reverse_proxy localhost:4000
   }
   ```
   Point both domains' DNS A records at the VPS's IP first, then `systemctl reload caddy`.
7. Set up a process to restart the stack on reboot: `restart: unless-stopped` (already set in `docker-compose.yml`) handles container restarts; for full-server reboots, enable Docker's own systemd service (`systemctl enable docker`) — Compose-managed containers with a restart policy come back up automatically once the Docker daemon does.

---

## 3. AWS / DigitalOcean (managed container platforms)

For **DigitalOcean App Platform**: it can build directly from a Dockerfile per-component, very similar to the Railway flow — create one "Service" component pointed at `backend/`, one "Static Site" or Dockerfile-based Service pointed at `frontend/`, and a managed **DigitalOcean Database (MySQL)** add-on instead of running MySQL in a container. Set the same environment variables as the Railway section above; App Platform provides HTTPS and a public URL automatically.

For **AWS**, the equivalent of "just run these containers" is **ECS on Fargate**:

1. Push both images to a registry (ECR):
   ```bash
   aws ecr create-repository --repository-name greentrack-backend
   aws ecr create-repository --repository-name greentrack-frontend
   docker build -t greentrack-backend ./backend
   docker build -t greentrack-frontend ./frontend
   # tag + docker push each to its ECR repo (AWS CLI gives you the exact commands
   # under "View push commands" on each repo's console page)
   ```
2. Use **RDS for MySQL** instead of a MySQL container — don't run stateful databases in Fargate; use the managed service.
3. Create an ECS Fargate service for each image, put an **Application Load Balancer** in front (this is what gives you HTTPS via an ACM certificate, and is the AWS equivalent of the Caddy step in the VPS section).
4. Environment variables go in the ECS Task Definition (or, better, AWS Secrets Manager for the sensitive ones — `WHATSAPP_TOKEN`, `NOTION_TOKEN`, `DATABASE_URL`, `GITHUB_WEBHOOK_SECRET` — referenced from the task definition rather than stored as plain env vars).

This path is meaningfully more setup than Railway or a single VPS. Given this project's actual size (a marketing site + a small API with one database), **Railway or a $6–12/mo VPS will comfortably handle real traffic** — reach for ECS/RDS only once you have a concrete reason (compliance requirement, existing AWS infrastructure, need for auto-scaling under real load).

---

## Post-deploy checklist (any platform)

- [ ] `ALLOWED_ORIGINS` on the backend is set to the real frontend URL, not `*`
- [ ] `FRONTEND_API_BASE_URL` / `API_BASE_URL` on the frontend points at the real backend URL, not `localhost`
- [ ] Migrations have been run: `npx prisma migrate deploy`
- [ ] MySQL is not reachable from the public internet
- [ ] GitHub webhook (Settings → Webhooks on your repo) points at `https://<your-backend-domain>/api/github/webhook`
- [ ] WhatsApp Cloud API and Notion credentials are the real production ones, not test values
- [ ] Visit `<backend-url>/health` and confirm `{ "ok": true }`
