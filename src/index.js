const { Telegraf } = require("telegraf");
const config = require("./config");
const { createLogger } = require("./utils/logger");
const { authMiddleware } = require("./bot/middleware/auth");
const { registerHelpCommands } = require("./bot/commands/help");
const { registerBoardCommands } = require("./bot/commands/board");
const { registerCardCommands } = require("./bot/commands/card");
const { registerLabelCommands } = require("./bot/commands/label");
const { registerStatsCommands } = require("./bot/commands/stats");
const { registerMessageHandler } = require("./bot/handlers/message");
const { registerCallbackHandler } = require("./bot/handlers/callback");
const { registerGreetingHandler } = require("./bot/handlers/greeting");
const { setupScheduler } = require("./cron/scheduler");

const log = createLogger("main");

const bot = new Telegraf(config.bot.token);

// ─── Global Error Handler ───
bot.catch((err, ctx) => {
  log.error("Unhandled bot error", {
    error: err.message,
    update: ctx.update?.update_id,
  });
  ctx.reply("Có lỗi xảy ra 😅 Thử lại nhé!").catch(() => {});
});

// ─── Middleware ───
bot.use(authMiddleware());

// ─── Register Commands (order matters: commands before message handler) ───
registerHelpCommands(bot);
registerBoardCommands(bot);
registerCardCommands(bot);
registerLabelCommands(bot);
registerStatsCommands(bot);

// ─── Register Handlers ───
registerCallbackHandler(bot);
registerGreetingHandler(bot);
registerMessageHandler(bot); // Must be last — catches all text

// ─── Scheduler ───
setupScheduler(bot);

// ─── Launch ───
bot
  .launch()
  .then(() => {
    log.info("🚀 G-Tech Bot is Online!");
  })
  .catch((err) => {
    log.error("Failed to start bot", { error: err.message });
    process.exit(1);
  });

// ─── Graceful Shutdown ───
process.once("SIGINT", () => {
  log.info("Shutting down (SIGINT)");
  bot.stop("SIGINT");
});
process.once("SIGTERM", () => {
  log.info("Shutting down (SIGTERM)");
  bot.stop("SIGTERM");
});
