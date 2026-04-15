const PRIORITY_ICONS = {
  low: "🟢",
  medium: "🟡",
  high: "🟠",
  urgent: "🔴",
};

const STATUS_ICONS = {
  "To Do": "📋",
  "In Progress": "🚧",
  Review: "👀",
  Done: "✅",
  Blocked: "🚨",
};

/**
 * Format a single card for display
 */
function formatCard(card, opts = {}) {
  const priority = PRIORITY_ICONS[card.priority] || "🟡";
  const listName = card.list?.name || "";
  const status = STATUS_ICONS[listName] || "📌";
  const assignee = card.assignee ? ` → @${card.assignee.firstName}` : "";
  const due = card.dueDate ? ` ⏰ ${formatDate(card.dueDate)}` : "";
  const id = opts.showId !== false ? `#${card.displayId || card.id}` : "";

  let line = `${status} ${id} ${card.title}${assignee}${due}`;
  if (opts.showPriority) line = `${priority} ${line}`;
  return line;
}

/**
 * Format a list of cards grouped by list
 */
function formatCardsByList(lists) {
  let out = "";
  for (const list of lists) {
    if (list.cards.length === 0) continue;
    out += `\n📂 *${list.name}* (${list.cards.length})\n`;
    list.cards.forEach((card) => {
      out += `  ${formatCard(card)}\n`;
    });
  }
  return out || "Không có card nào.";
}

/**
 * Format cards for a single user
 */
function formatMyCards(cards) {
  if (cards.length === 0) return "🎉 Không còn task nào dang dở!";

  let out = "";
  const grouped = {};
  for (const card of cards) {
    const listName = card.list?.name || "Other";
    if (!grouped[listName]) grouped[listName] = [];
    grouped[listName].push(card);
  }

  for (const [listName, items] of Object.entries(grouped)) {
    const icon = STATUS_ICONS[listName] || "📌";
    out += `\n${icon} *${listName}:*\n`;
    items.forEach((c, i) => {
      const due = c.dueDate ? ` ⏰ ${formatDate(c.dueDate)}` : "";
      out += `  ${i + 1}. #${c.displayId || c.id} ${c.title}${due}\n`;
    });
  }
  return out;
}

/**
 * Format board stats
 */
function formatStats(stats) {
  const lines = [
    `📊 *Thống kê Board: ${stats.boardName}*`,
    ``,
    `Tổng Cards: ${stats.total}`,
  ];

  for (const [listName, count] of Object.entries(stats.byList)) {
    const icon = STATUS_ICONS[listName] || "📌";
    lines.push(`${icon} ${listName}: ${count}`);
  }

  if (stats.overdue > 0) {
    lines.push(`\n🔴 Quá hạn: ${stats.overdue} cards`);
  }

  return lines.join("\n");
}

function formatDate(date) {
  const d = new Date(date);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}`;
}

/**
 * Parse a Vietnamese date string like "20/04", "20/4/2026", "thứ 6", "mai"
 */
function parseViDate(text) {
  const now = new Date();
  const input = String(text || "").trim().toLowerCase();

  // "mai" / "ngày mai"
  if (/\bmai\b/i.test(input)) {
    const d = new Date(now);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // "thứ 2..7", "thu 2..7", "t2..t7", "cn", "chủ nhật"
  // Returns the next occurrence (including today if it matches).
  const weekdayPatterns = [
    { re: /\b(chu\s*nhat|chủ\s*nhật|cn)\b/i, dow: 0 }, // Sunday
    { re: /\b(t(?:hứ|hu)?\s*2|t2)\b/i, dow: 1 }, // Monday
    { re: /\b(t(?:hứ|hu)?\s*3|t3)\b/i, dow: 2 }, // Tuesday
    { re: /\b(t(?:hứ|hu)?\s*4|t4)\b/i, dow: 3 }, // Wednesday
    { re: /\b(t(?:hứ|hu)?\s*5|t5)\b/i, dow: 4 }, // Thursday
    { re: /\b(t(?:hứ|hu)?\s*6|t6)\b/i, dow: 5 }, // Friday
    { re: /\b(t(?:hứ|hu)?\s*7|t7)\b/i, dow: 6 }, // Saturday
  ];
  for (const { re, dow } of weekdayPatterns) {
    if (re.test(input)) {
      const d = new Date(now);
      const currentDow = d.getDay(); // 0..6 (Sun..Sat)
      const delta = (dow - currentDow + 7) % 7;
      d.setDate(d.getDate() + delta);
      return d;
    }
  }

  // "20/04" or "20/04/2026"
  const match = input.match(/(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/);
  if (match) {
    const day = parseInt(match[1]);
    const month = parseInt(match[2]) - 1;
    const year = match[3] ? parseInt(match[3]) : now.getFullYear();
    return new Date(year, month, day);
  }

  return null;
}

module.exports = {
  formatCard,
  formatCardsByList,
  formatMyCards,
  formatStats,
  formatDate,
  parseViDate,
  PRIORITY_ICONS,
  STATUS_ICONS,
};
