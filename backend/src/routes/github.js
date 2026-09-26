const express = require("express");
const prisma = require("../db");
const { verifyGithubSignature, summarizeEvent } = require("../services/githubVerify");

const router = express.Router();

// POST /api/github/webhook
// Configure this exact URL in GitHub → Settings → Webhooks on the repos you
// want to show activity for. Content type: application/json.
// Note: this route needs the *raw* request body to verify the signature,
// so it's mounted with express.raw() in src/index.js rather than express.json().
router.post("/webhook", async (req, res) => {
  const signature = req.header("X-Hub-Signature-256");
  const eventType = req.header("X-GitHub-Event");
  const rawBody = req.body; // Buffer, thanks to express.raw()

  if (!verifyGithubSignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString("utf8"));
  } catch {
    return res.status(400).json({ error: "Invalid JSON payload" });
  }

  // "ping" fires once when the webhook is first created — acknowledge it
  // without saving an activity row.
  if (eventType === "ping") {
    return res.status(200).json({ ok: true, pong: true });
  }

  const { summary, url } = summarizeEvent(eventType, payload);

  try {
    await prisma.githubEvent.create({
      data: {
        eventType: eventType || "unknown",
        repo: payload.repository ? payload.repository.full_name : "unknown/repo",
        actor: payload.sender ? payload.sender.login : null,
        summary,
        url,
        payload,
      },
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("[github] Failed to save event:", err.message);
    return res.status(500).json({ error: "Could not save event" });
  }
});

// GET /api/github/activity?limit=20
router.get("/activity", async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const events = await prisma.githubEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        eventType: true,
        repo: true,
        actor: true,
        summary: true,
        url: true,
        createdAt: true,
      },
    });
    return res.json(events);
  } catch (err) {
    console.error("[github] GET /activity failed:", err.message);
    return res.status(500).json({ error: "Could not load activity" });
  }
});

module.exports = router;
