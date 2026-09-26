// Forwards a chat-widget message to your WhatsApp using Meta's WhatsApp
// Cloud API (the free official API — not a third-party wrapper).
//
// Needs three env vars, all from developers.facebook.com:
//   WHATSAPP_TOKEN            - permanent or temporary access token
//   WHATSAPP_PHONE_NUMBER_ID  - the "from" number's ID (not the number itself)
//   WHATSAPP_TO_NUMBER        - your number in international format, e.g. 2547XXXXXXXX
//
// Note: Meta only allows free-form text messages to a number that has
// messaged your WhatsApp business number in the last 24 hours. Outside that
// window you'd need an approved message *template*. For a "someone filled in
// my site's chat" use case, the simplest fix is to message your own test
// number from WhatsApp once to open the 24h window, or switch this function
// to send a template message — see Meta's docs for the current setup.

async function sendWhatsAppMessage({ name, email, body }) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const toNumber = process.env.WHATSAPP_TO_NUMBER;

  if (!token || !phoneNumberId || !toNumber) {
    console.warn("[whatsapp] Skipped — WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID / WHATSAPP_TO_NUMBER not set");
    return { ok: false, status: "skipped" };
  }

  const text = [
    "New message from the GreenTrack site chat:",
    name ? `From: ${name}${email ? ` (${email})` : ""}` : null,
    "",
    body,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const res = await fetch(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toNumber,
          type: "text",
          text: { body: text },
        }),
      }
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error("[whatsapp] Send failed:", res.status, errText);
      return { ok: false, status: "failed" };
    }

    return { ok: true, status: "sent" };
  } catch (err) {
    console.error("[whatsapp] Send error:", err.message);
    return { ok: false, status: "failed" };
  }
}

module.exports = { sendWhatsAppMessage };
