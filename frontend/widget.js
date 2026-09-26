/**
 * GreenTrack floating widget.
 * Three tabs: Chat (saved + forwarded to WhatsApp), Activity (GitHub webhook
 * feed), Workspace (Notion database, two-way).
 *
 * Configure these two lines before deploying:
 */
window.GREENTRACK_API_BASE = window.GREENTRACK_API_BASE || "http://localhost:4000";
window.GREENTRACK_WHATSAPP_NUMBER = window.GREENTRACK_WHATSAPP_NUMBER || "254700110527";

(function () {
  const API = window.GREENTRACK_API_BASE;
  const WA_NUMBER = window.GREENTRACK_WHATSAPP_NUMBER;
  const SESSION_KEY = "gt_session_id";

  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = "s_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  function timeAgo(iso) {
    const diff = Math.max(0, Date.now() - new Date(iso).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return hrs + "h ago";
    return Math.floor(hrs / 24) + "d ago";
  }

  function el(html) {
    const div = document.createElement("div");
    div.innerHTML = html.trim();
    return div.firstChild;
  }

  const sessionId = getSessionId();
  let contact = JSON.parse(localStorage.getItem("gt_contact") || "null");

  // ---------- build markup ----------
  const root = el(`
    <div id="gt-widget">
      <button class="gt-launcher" aria-label="Open GreenTrack chat">
        <svg viewBox="0 0 24 24" fill="none"><path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <span class="gt-badge" style="display:none">0</span>
      </button>
      <div class="gt-panel">
        <div class="gt-head">
          <div class="gt-head-title">
            <span class="dot"></span>
            <div><b>GreenTrack</b><span>Chat · GitHub · Notion</span></div>
          </div>
          <button class="gt-close" aria-label="Close">✕</button>
        </div>
        <div class="gt-tabs">
          <button class="gt-tab active" data-tab="chat">Chat</button>
          <button class="gt-tab" data-tab="activity">Activity</button>
          <button class="gt-tab" data-tab="workspace">Workspace</button>
        </div>

        <div class="gt-view active" data-view="chat">
          <div class="gt-messages"><div class="gt-empty">Say hello — it's forwarded straight to WhatsApp.</div></div>
          <form class="gt-precontact" style="${contact ? "display:none" : ""}">
            <input type="text" name="name" placeholder="Your name" required>
            <input type="email" name="email" placeholder="Email (optional)">
            <small>Just so we know who's asking. Saved on this device only.</small>
            <button type="submit" style="display:none"></button>
          </form>
          <form class="gt-composer">
            <input type="text" name="body" placeholder="Type a message…" autocomplete="off" required>
            <button type="submit" aria-label="Send">
              <svg viewBox="0 0 24 24" fill="none"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>
            </button>
          </form>
        </div>

        <div class="gt-view" data-view="activity">
          <div class="gt-activity-list"><div class="gt-loading">Loading GitHub activity…</div></div>
        </div>

        <div class="gt-view" data-view="workspace">
          <div class="gt-workspace"><div class="gt-loading">Loading Notion workspace…</div></div>
          <form class="gt-new-item">
            <input type="text" name="title" placeholder="Add an item to Notion…" required>
            <button type="submit">Add</button>
          </form>
        </div>
      </div>
    </div>
  `);
  document.body.appendChild(root);

  // ---------- element refs ----------
  const launcher = root.querySelector(".gt-launcher");
  const closeBtn = root.querySelector(".gt-close");
  const tabs = root.querySelectorAll(".gt-tab");
  const views = root.querySelectorAll(".gt-view");
  const messagesEl = root.querySelector(".gt-messages");
  const precontactForm = root.querySelector(".gt-precontact");
  const composerForm = root.querySelector(".gt-composer");
  const activityList = root.querySelector(".gt-activity-list");
  const workspaceList = root.querySelector(".gt-workspace");
  const newItemForm = root.querySelector(".gt-new-item");

  let opened = false;
  let activityLoaded = false;
  let workspaceLoaded = false;
  let pollTimer = null;

  launcher.addEventListener("click", () => {
    opened = !opened;
    root.classList.toggle("open", opened);
    if (opened) {
      loadChatHistory();
      if (!pollTimer) pollTimer = setInterval(loadChatHistory, 8000);
    }
  });
  closeBtn.addEventListener("click", () => {
    opened = false;
    root.classList.remove("open");
  });

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      views.forEach((v) => v.classList.remove("active"));
      tab.classList.add("active");
      const name = tab.dataset.tab;
      root.querySelector(`.gt-view[data-view="${name}"]`).classList.add("active");
      if (name === "activity" && !activityLoaded) loadActivity();
      if (name === "workspace" && !workspaceLoaded) loadWorkspace();
    });
  });

  // ---------- chat ----------
  function renderMessages(messages) {
    if (!messages.length) {
      messagesEl.innerHTML = `<div class="gt-empty">Say hello — it's forwarded straight to WhatsApp.</div>`;
      return;
    }
    messagesEl.innerHTML = "";
    messages.forEach((m) => {
      const bubble = el(`
        <div class="gt-msg ${m.sender === "user" ? "user" : "team"}">
          ${m.body.replace(/</g, "&lt;")}
          <span class="gt-msg-meta">${m.sender === "user" ? "You" : "GreenTrack"} · ${timeAgo(m.createdAt)}</span>
        </div>
      `);
      messagesEl.appendChild(bubble);
    });
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function loadChatHistory() {
    try {
      const res = await fetch(`${API}/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) throw new Error("bad response");
      renderMessages(await res.json());
    } catch {
      // Backend not reachable yet — leave the friendly empty state as-is.
    }
  }

  precontactForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = new FormData(precontactForm);
    contact = { name: data.get("name"), email: data.get("email") || "" };
    localStorage.setItem("gt_contact", JSON.stringify(contact));
    precontactForm.style.display = "none";
  });

  composerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(composerForm);
    const body = String(data.get("body") || "").trim();
    if (!body) return;

    if (!contact) {
      precontactForm.style.display = "flex";
      return;
    }

    composerForm.querySelector("input").value = "";
    // Optimistic render
    const optimistic = { sender: "user", body, createdAt: new Date().toISOString() };
    renderMessages([...(await currentMessagesOrEmpty()), optimistic]);

    try {
      await fetch(`${API}/api/chat/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, name: contact.name, email: contact.email, body }),
      });
      loadChatHistory();
    } catch {
      messagesEl.appendChild(el(`<div class="gt-empty">Couldn't reach the server — try again shortly, or use WhatsApp directly.</div>`));
    }
  });

  async function currentMessagesOrEmpty() {
    try {
      const res = await fetch(`${API}/api/chat/messages?sessionId=${encodeURIComponent(sessionId)}`);
      if (!res.ok) return [];
      return await res.json();
    } catch {
      return [];
    }
  }

  // ---------- GitHub activity ----------
  async function loadActivity() {
    activityLoaded = true;
    try {
      const res = await fetch(`${API}/api/github/activity?limit=15`);
      if (!res.ok) throw new Error("bad response");
      const events = await res.json();
      if (!events.length) {
        activityList.innerHTML = `<div class="gt-empty">No activity yet — push a commit or open a PR to see it here.</div>`;
        return;
      }
      activityList.innerHTML = "";
      events.forEach((ev) => {
        const item = el(`
          <div class="gt-event">
            <a href="${ev.url || "#"}" target="_blank" rel="noopener">${ev.summary.replace(/</g, "&lt;")}</a>
            <span class="gt-event-meta">${ev.repo} · ${timeAgo(ev.createdAt)}</span>
          </div>
        `);
        activityList.appendChild(item);
      });
    } catch {
      activityList.innerHTML = `<div class="gt-offline">GitHub activity feed is offline — connect the backend to see live events.</div>`;
      activityLoaded = false;
    }
  }

  // ---------- Notion workspace ----------
  async function loadWorkspace() {
    workspaceLoaded = true;
    try {
      const res = await fetch(`${API}/api/notion/items`);
      if (!res.ok) throw new Error("bad response");
      const items = await res.json();
      if (!items.length) {
        workspaceList.innerHTML = `<div class="gt-empty">Nothing synced yet — trigger a Notion sync on the backend.</div>`;
        return;
      }
      workspaceList.innerHTML = "";
      items.forEach((it) => {
        const row = el(`
          <div class="gt-item">
            <a href="${it.url || "#"}" target="_blank" rel="noopener">${it.title.replace(/</g, "&lt;")}</a>
            ${it.status ? `<span class="gt-item-status">${it.status}</span>` : ""}
          </div>
        `);
        workspaceList.appendChild(row);
      });
    } catch {
      workspaceList.innerHTML = `<div class="gt-offline">Notion workspace is offline — connect the backend to see synced items.</div>`;
      workspaceLoaded = false;
    }
  }

  newItemForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const data = new FormData(newItemForm);
    const title = String(data.get("title") || "").trim();
    if (!title) return;
    newItemForm.querySelector("input").value = "";
    try {
      await fetch(`${API}/api/notion/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      workspaceLoaded = false;
      loadWorkspace();
    } catch {
      alert("Couldn't reach the backend to add this to Notion.");
    }
  });
})();
