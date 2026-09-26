const crypto = require("crypto");

// Verifies the X-Hub-Signature-256 header GitHub sends with every webhook
// delivery, using the secret you set both here (GITHUB_WEBHOOK_SECRET) and
// in the repo's Webhook settings on GitHub.
function verifyGithubSignature(rawBody, signatureHeader) {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  if (!secret) {
    console.warn("[github] GITHUB_WEBHOOK_SECRET not set — rejecting webhook");
    return false;
  }
  if (!signatureHeader) return false;

  const expected =
    "sha256=" + crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;

  return crypto.timingSafeEqual(a, b);
}

// Turns a raw GitHub webhook payload into a short, human-readable summary
// for the activity feed, based on the event type.
function summarizeEvent(eventType, payload) {
  const repo = payload.repository ? payload.repository.full_name : "unknown/repo";
  const actor = payload.sender ? payload.sender.login : null;

  switch (eventType) {
    case "push": {
      const branch = (payload.ref || "").replace("refs/heads/", "");
      const count = (payload.commits || []).length;
      return {
        summary: `${actor} pushed ${count} commit${count === 1 ? "" : "s"} to ${branch}`,
        url: payload.compare || payload.repository?.html_url,
      };
    }
    case "pull_request": {
      const pr = payload.pull_request || {};
      return {
        summary: `${actor} ${payload.action} PR #${payload.number}: ${pr.title || ""}`,
        url: pr.html_url,
      };
    }
    case "issues": {
      const issue = payload.issue || {};
      return {
        summary: `${actor} ${payload.action} issue #${payload.issue?.number}: ${issue.title || ""}`,
        url: issue.html_url,
      };
    }
    case "star":
      return {
        summary: `${actor} starred ${repo}`,
        url: payload.repository?.html_url,
      };
    case "release": {
      const rel = payload.release || {};
      return {
        summary: `${actor} ${payload.action} release ${rel.tag_name || ""}`,
        url: rel.html_url,
      };
    }
    default:
      return { summary: `${actor || "someone"} triggered ${eventType} on ${repo}`, url: payload.repository?.html_url };
  }
}

module.exports = { verifyGithubSignature, summarizeEvent };
