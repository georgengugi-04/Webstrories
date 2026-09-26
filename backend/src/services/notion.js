const { Client } = require("@notionhq/client");
const prisma = require("../db");

function getClient() {
  const token = process.env.NOTION_TOKEN;
  if (!token) return null;
  return new Client({ auth: token });
}

// Reads the plain title text off a Notion page's title property,
// whatever that property happens to be named.
function extractTitle(properties) {
  for (const key of Object.keys(properties)) {
    const prop = properties[key];
    if (prop.type === "title" && prop.title.length > 0) {
      return prop.title.map((t) => t.plain_text).join("");
    }
  }
  return "Untitled";
}

// Reads a "Status" or "Select" property if present, for a status badge.
function extractStatus(properties) {
  const statusProp = properties.Status || properties.status;
  if (!statusProp) return null;
  if (statusProp.type === "status") return statusProp.status?.name || null;
  if (statusProp.type === "select") return statusProp.select?.name || null;
  return null;
}

// Pulls every page from the configured Notion database and upserts it into
// the local NotionItem cache table. Call this from a cron job / scheduled
// task, or hit POST /api/notion/sync manually.
async function syncFromNotion() {
  const notion = getClient();
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!notion || !databaseId) {
    console.warn("[notion] Skipped sync — NOTION_TOKEN / NOTION_DATABASE_ID not set");
    return { ok: false, synced: 0 };
  }

  let cursor = undefined;
  let synced = 0;

  do {
    const res = await notion.databases.query({
      database_id: databaseId,
      start_cursor: cursor,
      page_size: 50,
    });

    for (const page of res.results) {
      const title = extractTitle(page.properties);
      const status = extractStatus(page.properties);

      await prisma.notionItem.upsert({
        where: { notionPageId: page.id },
        update: {
          title,
          status,
          url: page.url,
          lastEditedAt: new Date(page.last_edited_time),
          syncedAt: new Date(),
        },
        create: {
          notionPageId: page.id,
          title,
          status,
          url: page.url,
          lastEditedAt: new Date(page.last_edited_time),
        },
      });
      synced += 1;
    }

    cursor = res.has_more ? res.next_cursor : undefined;
  } while (cursor);

  return { ok: true, synced };
}

// Creates a new page in the Notion database (e.g. from the site's
// "+ New" button) and caches it locally right away.
async function createNotionItem({ title, status }) {
  const notion = getClient();
  const databaseId = process.env.NOTION_DATABASE_ID;
  if (!notion || !databaseId) {
    throw new Error("NOTION_TOKEN / NOTION_DATABASE_ID not configured");
  }

  // Change NOTION_TITLE_PROPERTY if your database's title column isn't
  // called "Name" (Notion databases default to "Name").
  const titleProperty = process.env.NOTION_TITLE_PROPERTY || "Name";
  const properties = {
    [titleProperty]: { title: [{ text: { content: title } }] },
  };
  if (status) {
    properties.Status = { status: { name: status } };
  }

  const page = await notion.pages.create({
    parent: { database_id: databaseId },
    properties,
  });

  const item = await prisma.notionItem.create({
    data: {
      notionPageId: page.id,
      title,
      status: status || null,
      url: page.url,
      lastEditedAt: new Date(page.last_edited_time),
    },
  });

  return item;
}

module.exports = { syncFromNotion, createNotionItem };
