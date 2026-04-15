const cron = require("node-cron");
const config = require("../config");
const boardRepo = require("../db/board.repo");
const reportService = require("../services/report.service");
const cardRepo = require("../db/card.repo");
const { createLogger } = require("../utils/logger");
const { Markup } = require("telegraf");

const log = createLogger("cron");

function setupScheduler(bot) {
  const tz = config.app.timezone;

  // Daily Standup — 8:30 AM, Mon-Fri
  cron.schedule(
    "30 8 * * 1-5",
    async () => {
      log.info("Running daily standup reminder");
      const boards = await boardRepo.findAll();

      for (const board of boards) {
        if (!board.chatId) continue;
        try {
          bot.telegram.sendMessage(
            board.chatId,
            "☀️ *Chào buổi sáng cả nhà!*\nHôm nay mọi người định làm gì thì báo tui nhé! 💪",
            { 
              parse_mode: "Markdown",
              message_thread_id: board.topicId
            },
          );
        } catch (err) {
          log.error("Standup send failed", { chatId: board.chatId, error: err.message });
        }
      }
    },
    { timezone: tz },
  );

  // Weekly Report — 17:00 PM, Friday
  cron.schedule(
    "0 17 * * 5",
    async () => {
      log.info("Running weekly report");
      const boards = await boardRepo.findAll();

      for (const board of boards) {
        if (!board.chatId) continue;
        try {
          const report = await reportService.getWeeklyReport(board.id);
          if (report) {
            bot.telegram.sendMessage(board.chatId, report, {
              parse_mode: "Markdown",
              message_thread_id: board.topicId
            });
          }
        } catch (err) {
          log.error("Weekly report send failed", { chatId: board.chatId, error: err.message });
        }
      }
    },
    { timezone: tz },
  );

  // Lunch Break — 12:00 PM daily
  cron.schedule(
    "0 12 * * *",
    async () => {
      log.info("Running lunch reminder");
      const { generateResponse } = require("../ai/brain");
      const boards = await boardRepo.findAll();

      for (const board of boards) {
        if (!board.chatId) continue;
        try {
          const customMsg = await generateResponse(
            "Đã đến 12h trưa, hãy viết một lời nhắc nhở nghỉ ngơi và đi ăn trưa hài hước, thân thiện cho team. Kèm emoji sinh động.",
          );
          
          bot.telegram.sendMessage(
            board.chatId,
            customMsg || "🍛 *12 giờ trưa rồi!* Đi ăn thôi anh em ơi!",
            { 
              parse_mode: "Markdown",
              message_thread_id: board.topicId
            },
          );
        } catch (err) {
          log.error("Lunch reminder failed", { chatId: board.chatId, error: err.message });
        }
      }
    },
    { timezone: tz },
  );

  // Daily Summary — 17:30 PM, Mon-Fri
  cron.schedule(
    "30 17 * * 1-5",
    async () => {
      log.info("Running daily summary");
      const boards = await boardRepo.findAll();

      for (const board of boards) {
        if (!board.chatId) continue;
        try {
          const report = await reportService.getDailyReport(board.id);
          if (report) {
            bot.telegram.sendMessage(board.chatId, report, {
              parse_mode: "Markdown",
              message_thread_id: board.topicId
            });
          }
        } catch (err) {
          log.error("Summary send failed", { chatId: board.chatId, error: err.message });
        }
      }
    },
    { timezone: tz },
  );

  // Deadline warning — 8:00 AM daily
  cron.schedule(
    "0 9 * * *",
    async () => {
      log.info("Running deadline check");
      const boards = await boardRepo.findAll();

      for (const board of boards) {
        if (!board.chatId) continue;
        try {
          const overdue = await cardRepo.findOverdue(board.id);
          if (overdue.length > 0) {
            let msg = "🔴 *CẢNH BÁO DEADLINE:*\n\n";
            overdue.forEach((c) => {
              const who = c.assignee ? `@${c.assignee.firstName}` : "chưa assign";
              msg += `• *#${c.id} ${c.title}* — ${who}\n`;
            });
            msg += "\nHãy cập nhật tiến độ nhé! 🙏";
            bot.telegram.sendMessage(board.chatId, msg, {
              parse_mode: "Markdown",
              message_thread_id: board.topicId,
              ...Markup.inlineKeyboard(
                overdue.slice(0, 10).map((c) => [
                  Markup.button.callback(`✅ Xong #${c.id}`, `done:${c.id}`)
                ])
              )
            });
          }
        } catch (err) {
          log.error("Deadline check failed", { chatId: board.chatId, error: err.message });
        }
      }
    },
    { timezone: tz },
  );

  log.info("Scheduler initialized", { timezone: tz });
}

module.exports = { setupScheduler };
