const express = require("express");
const prisma = require("../db");
const { sendWhatsAppMessage } = require("../services/whatsapp");

const router = express.Router();

// POST /api/chat/messages
// Body: { sessionId, name?, email?, body }
router.post("/messages", async (req, res) => {
  try {
    const { sessionId, name, email, body } = req.body || {};

    if (!sessionId || !body || !body.trim()) {
      return res.status(400).json({ error: "sessionId and body are required" });
    }

    const saved = await prisma.chatMessage.create({
      data: { sessionId, sender: "user", name, email, body: body.trim() },
    });

    // Forward to WhatsApp in the background — don't block the reply on it.
    sendWhatsAppMessage({ name, email, body }).then((result) => {
      prisma.chatMessage
        .update({ where: { id: saved.id }, data: { whatsappStatus: result.status } })
        .catch((err) => console.error("[chat] Failed to update whatsappStatus:", err.message));
    });

    return res.status(201).json(saved);
  } catch (err) {
    console.error("[chat] POST /messages failed:", err.message);
    return res.status(500).json({ error: "Could not save message" });
  }
});

// GET /api/chat/messages?sessionId=xyz
router.get("/messages", async (req, res) => {
  try {
    const { sessionId } = req.query;
    if (!sessionId) return res.status(400).json({ error: "sessionId is required" });

    const messages = await prisma.chatMessage.findMany({
      where: { sessionId: String(sessionId) },
      orderBy: { createdAt: "asc" },
      take: 200,
    });

    return res.json(messages);
  } catch (err) {
    console.error("[chat] GET /messages failed:", err.message);
    return res.status(500).json({ error: "Could not load messages" });
  }
});

module.exports = router;
