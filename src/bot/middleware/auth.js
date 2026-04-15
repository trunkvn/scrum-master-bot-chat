const userRepo = require("../../db/user.repo");
const { createLogger } = require("../../utils/logger");

const log = createLogger("auth");

/**
 * Middleware: auto-register users on every interaction.
 * Attaches ctx.state.user for downstream handlers.
 */
function authMiddleware() {
  return async (ctx, next) => {
    if (!ctx.from) return next();

    try {
      const user = await userRepo.upsert(ctx.from.id, {
        username: ctx.from.username || null,
        firstName: ctx.from.first_name || ctx.from.username || "Unknown",
      });
      ctx.state.user = user;
    } catch (err) {
      log.error("Auth middleware failed", { error: err.message });
    }

    return next();
  };
}

module.exports = { authMiddleware };
