const reportService = require("../../services/report.service");
const boardService = require("../../services/board.service");
const { createLogger } = require("../../utils/logger");

const log = createLogger("stats-cmd");

function registerStatsCommands(bot) {
  // /stats — Board statistics
  bot.command("stats", async (ctx) => {
    try {
      const board = await boardService.getBoard(ctx);
      const stats = await reportService.getBoardStats(board.id);
      ctx.reply(stats, { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Stats failed", { error: err.message });
      ctx.reply("❌ Lỗi khi xem thống kê.");
    }
  });

  // /report — Daily report
  bot.command("report", async (ctx) => {
    try {
      const board = await boardService.getBoard(ctx);
      const report = await reportService.getDailyReport(board.id);
      ctx.reply(report, { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Report failed", { error: err.message });
      ctx.reply("❌ Lỗi khi tạo báo cáo.");
    }
  });

  // /weekly — Weekly report
  bot.command("weekly", async (ctx) => {
    try {
      const board = await boardService.getBoard(ctx);
      const report = await reportService.getWeeklyReport(board.id);
      ctx.reply(report, { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Weekly report command failed", { error: err.message });
      ctx.reply("❌ Lỗi khi tạo báo cáo tuần.");
    }
  });
}

module.exports = { registerStatsCommands };
