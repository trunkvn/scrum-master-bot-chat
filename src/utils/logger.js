const config = require("../config");

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };
const currentLevel = LEVELS[config.app.logLevel] ?? LEVELS.info;

function formatMsg(level, module, message, data) {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level.toUpperCase()}] [${module}] ${message}`;
  if (data) return `${base} ${JSON.stringify(data)}`;
  return base;
}

function createLogger(module) {
  return {
    error: (msg, data) => {
      if (currentLevel >= LEVELS.error)
        console.error(formatMsg("error", module, msg, data));
    },
    warn: (msg, data) => {
      if (currentLevel >= LEVELS.warn)
        console.warn(formatMsg("warn", module, msg, data));
    },
    info: (msg, data) => {
      if (currentLevel >= LEVELS.info)
        console.log(formatMsg("info", module, msg, data));
    },
    debug: (msg, data) => {
      if (currentLevel >= LEVELS.debug)
        console.log(formatMsg("debug", module, msg, data));
    },
  };
}

module.exports = { createLogger };
