const express = require("express");
const prisma = require("../db");
const { syncFromNotion, createNotionItem } = require("../services/notion");

const router = express.Router();

// POST /api/notion/sync
// Pulls the latest pages from your Notion database into the local cache.
// Call this manually, or wire it to a scheduled task (e.g. a Railway cron
// job hitting this endpoint every few minutes).
router.post("/sync", async (req, res) => {
  try {
    const result = await syncFromNotion();
    return res.json(result);
  } catch (err) {
    console.error("[notion] Sync failed:", err.message);
    return res.status(500).json({ error: "Sync failed" });
  }
});

// GET /api/notion/items
// Serves the cached copy — fast, and doesn't hit Notion's rate limits on
// every page view of the site.
router.get("/items", async (req, res) => {
  try {
    const items = await prisma.notionItem.findMany({
      orderBy: { lastEditedAt: "desc" },
      take: 100,
    });
    return res.json(items);
  } catch (err) {
    console.error("[notion] GET /items failed:", err.message);
    return res.status(500).json({ error: "Could not load items" });
  }
});

// POST /api/notion/items
// Body: { title, status? }
// Creates a real page in your Notion database (two-way sync) and returns
// the cached copy immediately.
router.post("/items", async (req, res) => {
  try {
    const { title, status } = req.body || {};
    if (!title || !title.trim()) {
      return res.status(400).json({ error: "title is required" });
    }
    const item = await createNotionItem({ title: title.trim(), status });
    return res.status(201).json(item);
  } catch (err) {
    console.error("[notion] POST /items failed:", err.message);
    return res.status(500).json({ error: "Could not create item" });
  }
});

module.exports = router;
