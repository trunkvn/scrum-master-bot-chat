require("dotenv").config();

const config = {
  bot: {
    token: process.env.BOT_TOKEN,
  },
  ai: {
    googleKey: process.env.GOOGLE_API_KEY,
    model: process.env.AI_MODEL || "gemma-3-2b",
  },
  db: {
    url: process.env.DATABASE_URL,
  },
  app: {
    timezone: process.env.TZ || "Asia/Ho_Chi_Minh",
    logLevel: process.env.LOG_LEVEL || "info",
    defaultLists: ["To Do", "In Progress", "Review", "Done"],
  },
};

// Validate required env vars
const required = ["BOT_TOKEN", "GOOGLE_API_KEY", "DATABASE_URL"];
for (const key of required) {
  if (!process.env[key]) {
    console.error(`❌ Missing required env var: ${key}`);
    process.exit(1);
  }
}

module.exports = config;
