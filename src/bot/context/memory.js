const TTL_MS = 10 * 60 * 1000; // 10 minutes
const PENDING_DELETE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// In-memory per-process context store.
// Keyed by chat + topic so group forum topics don't bleed into each other.
const store = new Map();
const pendingDelete = new Map();
const historyStore = new Map(); // chatID:topicID -> Array of {role, content, name}

function _now() {
  return Date.now();
}

function makeKey(ctx) {
  const chatId = ctx?.chat?.id?.toString?.() ?? "unknown";
  const topicId =
    ctx?.message?.message_thread_id ??
    ctx?.callbackQuery?.message?.message_thread_id ??
    "0";
  return `${chatId}:${topicId}`;
}

function setLastCardId(ctx, cardId) {
  if (!cardId) return;
  const key = makeKey(ctx);
  store.set(key, { lastCardId: cardId, updatedAt: _now() });
}

function getLastCardId(ctx) {
  const key = makeKey(ctx);
  const v = store.get(key);
  if (!v) return null;
  if (_now() - v.updatedAt > TTL_MS) {
    store.delete(key);
    return null;
  }
  return v.lastCardId ?? null;
}

function _randToken() {
  return Math.random().toString(36).slice(2, 8);
}

function setPendingDelete(ctx, cardIds) {
  const ids = Array.from(new Set((cardIds || []).filter((n) => Number.isFinite(n) && n > 0)));
  if (ids.length === 0) return null;
  const key = makeKey(ctx);
  const token = `${_randToken()}${_randToken()}`.slice(0, 10);
  pendingDelete.set(`${key}:${token}`, { ids, createdAt: _now() });
  return token;
}

function getPendingDelete(ctx, token) {
  if (!token) return null;
  const key = makeKey(ctx);
  const v = pendingDelete.get(`${key}:${token}`);
  if (!v) return null;
  if (_now() - v.createdAt > PENDING_DELETE_TTL_MS) {
    pendingDelete.delete(`${key}:${token}`);
    return null;
  }
  return v.ids;
}

function clearPendingDelete(ctx, token) {
  if (!token) return;
  const key = makeKey(ctx);
  pendingDelete.delete(`${key}:${token}`);
}

function addMessageToHistory(ctx, role, content, name) {
  const key = makeKey(ctx);
  let history = historyStore.get(key) || [];
  
  // Add new message
  history.push({ 
    role, 
    content, 
    name: name || (role === "user" ? "User" : "Bot"),
    timestamp: _now() 
  });
  
  // Clean up old messages (older than TTL)
  history = history.filter(m => _now() - m.timestamp < TTL_MS);
  
  // Limit to last 15 messages
  if (history.length > 15) {
    history = history.slice(-15);
  }
  
  historyStore.set(key, history);
}

function getHistory(ctx) {
  const key = makeKey(ctx);
  let history = historyStore.get(key) || [];
  
  // Filter out expired messages
  history = history.filter(m => _now() - m.timestamp < TTL_MS);
  
  // Update store with filtered history
  if (history.length === 0) {
    historyStore.delete(key);
  } else {
    historyStore.set(key, history);
  }
  
  return history;
}

module.exports = {
  setLastCardId,
  getLastCardId,
  makeKey,
  setPendingDelete,
  getPendingDelete,
  clearPendingDelete,
  addMessageToHistory,
  getHistory,
};

