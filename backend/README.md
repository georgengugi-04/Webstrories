# GreenTrack backend

Powers the chat widget on the GreenTrack site:

- **Chat** — visitor messages are saved to a database and forwarded to your WhatsApp.
- **GitHub activity** — a live feed of push/PR/issue/star events from repos you wire up via webhook.
- **Notion workspace** — a small two-way sync with a Notion database: pulls items in, and can create new ones from the site.

Stack: Node.js, Express, Prisma, MySQL — same stack as your other projects, deployable on Railway the way you already deploy Ikonex SMS.

> **Using Docker?** This README covers running the backend directly with npm. For the containerized setup (this service + the frontend + MySQL, all wired together), see `../DOCKER.md` and `../DEPLOYMENT.md` at the project root instead — the Dockerfile in this folder is what those use.

## 1. Install

```bash
cd backend
npm install
cp .env.example .env
```

## 2. Database

Add a MySQL database (Railway → New → Database → MySQL works well), copy its connection string into `DATABASE_URL` in `.env`, then run:

```bash
npx prisma migrate dev --name init
```

This creates the `ChatMessage`, `GithubEvent`, and `NotionItem` tables.

## 3. WhatsApp Cloud API

1. Create a Meta developer account at developers.facebook.com and add the **WhatsApp** product to an app.
2. Meta gives you a test phone number, a **Phone Number ID**, and a temporary access token — put these in `WHATSAPP_PHONE_NUMBER_ID` and `WHATSAPP_TOKEN`.
3. Set `WHATSAPP_TO_NUMBER` to your own WhatsApp number, in international format with no `+` or spaces (e.g. `2547XXXXXXXX`).
4. Meta only lets you free-text a number that has messaged your business number in the last 24 hours. Send a WhatsApp message to the test number once to open that window while you're testing. For production, look into approved message templates so the first message always goes through — check Meta's current docs, as these policies do shift.

## 4. GitHub webhook (activity feed)

1. On each repo you want to show: **Settings → Webhooks → Add webhook**.
2. Payload URL: `https://your-backend-url/api/github/webhook`
3. Content type: `application/json`
4. Secret: any random string — put the same value in `GITHUB_WEBHOOK_SECRET`.
5. Choose events: at minimum `push`, `pull_request`, `issues`, `star`, `release`.

GitHub will send a `ping` event immediately to confirm the webhook works — the server acknowledges it without saving anything.

## 5. Notion (mini workspace)

1. Go to notion.so/my-integrations and create a new **internal integration**. Copy its token into `NOTION_TOKEN`.
2. Create (or pick) a Notion database to act as the workspace — needs at minimum a title column and, optionally, a `Status` select/status column.
3. Open the database in Notion, click **···→ Connections**, and add your integration so it's allowed to read/write it.
4. Copy the database ID out of its URL (the 32-character string right after your workspace name and before the `?v=`) into `NOTION_DATABASE_ID`.
5. If your title column isn't called "Name", set `NOTION_TITLE_PROPERTY` to match.

Pull existing items in once with:

```bash
curl -X POST https://your-backend-url/api/notion/sync
```

Re-run that on a schedule (a simple cron hitting this endpoint every few minutes) to keep the cache fresh, since Notion doesn't push changes to you.

## 6. Run locally

```bash
npm run dev
```

Server starts on `http://localhost:4000`. Check `http://localhost:4000/health`.

## 7. Deploy (Railway)

1. Push this folder to its own GitHub repo (or a `/backend` folder in your existing one).
2. Railway → New Project → Deploy from GitHub → pick the repo.
3. Add all the variables from `.env` in Railway's Variables tab (use the real MySQL plugin's `DATABASE_URL` if you provisioned MySQL through Railway).
4. Railway will run `npm install` and `npm start` automatically. Run `npx prisma migrate deploy` once from Railway's shell (or add it as a pre-deploy step) to create the tables in production.
5. Copy the Railway-issued URL (e.g. `https://greentrack-backend.up.railway.app`) — set it as the frontend's `API_BASE_URL` environment variable (see `../DOCKER.md`), not by hand-editing any JS file.

## API reference

| Method | Path                     | Purpose                                    |
|--------|--------------------------|---------------------------------------------|
| POST   | `/api/chat/messages`     | Save a chat message, forward it to WhatsApp |
| GET    | `/api/chat/messages`     | Fetch a session's chat history              |
| POST   | `/api/github/webhook`    | Receives GitHub webhook deliveries          |
| GET    | `/api/github/activity`   | Latest GitHub events for the feed           |
| POST   | `/api/notion/sync`       | Pull latest items from Notion                |
| GET    | `/api/notion/items`      | Cached Notion items for the workspace tab   |
| POST   | `/api/notion/items`      | Create a new item in Notion + cache it       |
| GET    | `/health`                | Health check                                |
