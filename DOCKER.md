# Docker Setup — GreenTrack

## Architecture

```
┌─────────────────────┐      ┌──────────────────────┐      ┌─────────────────┐
│   frontend (nginx)   │      │  backend (Node/       │      │  db (MySQL 8.4)  │
│   static HTML/CSS/JS │─────▶│  Express + Prisma)     │─────▶│  persistent volume│
│   port 80 → 8080     │ REST │  port 4000             │ SQL  │  internal only    │
└─────────────────────┘      └──────────────────────┘      └─────────────────┘
        ▲ browser                     ▲ GitHub webhooks,
                                       WhatsApp Cloud API, Notion API
```

Three containers, one Docker network (`greentrack-net`):

- **frontend** — the static "GreenTrack Journal" site (15 HTML pages, no build step) served by nginx. A small entrypoint script regenerates `env.js` from real environment variables at container startup, so the API URL is configurable per-environment without rebuilding the image.
- **backend** — Node.js + Express + Prisma API: the chat widget (forwards to WhatsApp), the GitHub webhook activity feed, and the Notion two-way sync.
- **db** — MySQL 8.4 with a named volume (`db-data`) for persistence. Not exposed to the host by default — only the backend can reach it, over the internal Docker network.

This is a genuinely simple stack (static site + one API + one database) — there's no reverse proxy or message queue in here because nothing in this project needs one yet. Don't add complexity the app doesn't use.

## Why the frontend has no build stage

The frontend is plain HTML/CSS/JS with no bundler (no React/Vue/Next, no `package.json`). There's nothing to compile, so the Dockerfile is a single stage: copy files, configure nginx, done. If you later introduce a frontend framework or build tool, add a `node:20-alpine AS build` stage that runs the build, and `COPY --from=build /app/dist ...` into the nginx stage instead of copying source files directly.

## Run locally

```bash
cp .env.example .env
# edit .env — at minimum set real MYSQL_PASSWORD / MYSQL_ROOT_PASSWORD

docker compose up --build
```

- Frontend: http://localhost:8080
- Backend: http://localhost:4000/health
- MySQL: internal only (not published to the host)

First run: the `db` container initializes MySQL, then the backend waits for it to report healthy (via `depends_on: condition: service_healthy`) before starting. Run migrations once the stack is up:

```bash
docker compose exec backend npx prisma migrate deploy
```

Stop everything:

```bash
docker compose down
```

Stop and also delete the database volume (⚠️ destroys all data):

```bash
docker compose down -v
```

## Rebuilding after code changes

```bash
docker compose up --build            # rebuild everything
docker compose up --build backend    # just the backend
docker compose up --build frontend   # just the frontend
```

The frontend has no hot-reload in this setup — it's a production-style build. For active frontend editing, just open the HTML files directly in a browser or run a plain static server (`npx serve frontend`) instead of Docker.

## Configuring the frontend → backend connection

This is the part most static-site Docker setups get wrong, so it's worth calling out: because the frontend has no build step, `frontend/env.js` can't be "baked in" at build time without needing a different image per environment. Instead:

1. `frontend/env.js` ships in the image with safe localhost defaults (so the static files work even outside Docker).
2. At container **startup**, `frontend/docker-entrypoint.sh` overwrites `env.js` using the `API_BASE_URL` and `WHATSAPP_NUMBER` environment variables passed to the container.
3. `main.js` and `widget.js` read `window.GREENTRACK_API_BASE` / `window.GREENTRACK_WHATSAPP_NUMBER`, which `env.js` sets.

So: **the same built image works in every environment** — dev, staging, prod — you just pass different env vars when you run the container. Never hardcode an API URL back into `main.js` or any HTML file; that was a real bug in an earlier version of this project (main.js was unconditionally overwriting the config every page load) and has been fixed as part of this Docker setup.

## Health checks

Both `backend` and `frontend` have Docker `HEALTHCHECK` instructions:

- Backend: `GET /health` → `{ ok: true }`
- Frontend: `GET /` on port 80

`docker compose ps` will show `(healthy)` / `(unhealthy)` once each container's checks have run a few times.

## Known limitation of this local setup

`docker-compose.yml` as written is meant for **local development and staging**, not for exposing MySQL or the backend directly to the public internet. For production, see `DEPLOYMENT.md` — in particular, always put the backend behind HTTPS (a platform's built-in TLS, or a reverse proxy like Caddy/nginx with Let's Encrypt on a VPS), and never publish the `db` service's port publicly.

## Sharing your images (Docker Hub)

If someone needs to `docker pull` your images directly (a teammate, an assessor, a demo environment), publish them to Docker Hub. Both services already have `image:` fields in `docker-compose.yml` tied to `DOCKERHUB_USERNAME`, so building and publishing both is one command each.

**One-time setup:**

1. Create a free account at [hub.docker.com](https://hub.docker.com) — this gives you your Docker Hub username.
2. Set it in `.env`:
   ```
   DOCKERHUB_USERNAME=your-actual-username
   ```
3. Log in from the terminal:
   ```bash
   docker login
   ```

**Build and publish both images:**

```bash
docker compose build
docker compose push
```

This builds `<username>/greentrack-backend:latest` and `<username>/greentrack-frontend:latest` (the names come from the `image:` field in `docker-compose.yml`) and pushes both to Docker Hub. By default, a new repo you push to is created as **public** — meaning anyone can pull it without logging in, which is usually what you want for sharing with a teammate or assessor. If you'd rather keep it private, create the repo manually on hub.docker.com first and set it to private before pushing; the person pulling will then need `docker login` with an account you've granted access to.

**What the other person runs**, once you've told them your Docker Hub username:

```bash
docker pull yourusername/greentrack-backend:latest
docker pull yourusername/greentrack-frontend:latest
```

Or, if you also send them `docker-compose.yml` and `.env.example` (they don't need the source code at all for this — the images are self-contained):

```bash
docker compose pull   # fetches both images instead of building from source
docker compose up
```

**Tagging versions.** `:latest` is fine for casual sharing, but for anything you'll refer back to (a submission, a specific demo), tag a version too so it doesn't silently change later:

```bash
docker build -t yourusername/greentrack-backend:v1.0 ./backend
docker push yourusername/greentrack-backend:v1.0
```

