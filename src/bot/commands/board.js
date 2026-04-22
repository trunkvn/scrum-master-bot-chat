const boardService = require("../../services/board.service");
const boardRepo = require("../../db/board.repo");
const { formatCardsByList } = require("../../utils/formatter");
const { createLogger } = require("../../utils/logger");

const log = createLogger("board-cmd");

function registerBoardCommands(bot) {
  // /board — View current board
  bot.command("board", async (ctx) => {
    try {
      const board = await boardService.getBoard(ctx);
      const lists = await boardService.getLists(board.id);
      const display = formatCardsByList(lists);

      ctx.reply(
        `📋 *Board: ${board.name}*\n${display}`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      log.error("Board view failed", { error: err.message });
      ctx.reply("❌ Lỗi khi xem board.");
    }
  });

  // /boards — List all boards
  bot.command("boards", async (ctx) => {
    try {
      const boards = await boardRepo.findAll();
      if (boards.length === 0) {
        return ctx.reply("Chưa có board nào. Gửi tin nhắn trong group để tự động tạo!");
      }

      let msg = "📋 *Danh sách Boards:*\n\n";
      boards.forEach((b, i) => {
        msg += `${i + 1}. *${b.name}* (ID: ${b.id})\n`;
      });
      ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Boards list failed", { error: err.message });
      ctx.reply("❌ Lỗi khi liệt kê boards.");
    }
  });

  // /newboard [name] — Create a new board
  bot.command("newboard", async (ctx) => {
    const name = ctx.payload?.trim();
    if (!name) return ctx.reply("⚠️ Dùng: /newboard Tên Board");

    try {
      const board = await boardService.createBoard(
        name,
        ctx.state.user.id,
        ctx.chat.id.toString(),
      );
      ctx.reply(`✅ Đã tạo board *${board.name}*!`, { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Board create failed", { error: err.message });
      ctx.reply("❌ Lỗi khi tạo board.");
    }
  });
  // /set_notify_topic — Bind board notifications to the current topic
  bot.command("set_notify_topic", async (ctx) => {
    try {
      const topicId = ctx.message?.message_thread_id || ctx.callbackQuery?.message?.message_thread_id;
      const board = await boardService.getBoard(ctx);
      await boardRepo.updateTopicId(board.id, topicId);
      
      const topicDesc = topicId ? `topic hiện tại` : "nhóm chung (General)";
      ctx.reply(`✅ Đã cấu hình luồng báo cáo! Từ nay Bot sẽ gửi thông báo Standup/Cronjob vào ${topicDesc}.`);
    } catch (err) {
      log.error("Set notify topic failed", { error: err.message });
      ctx.reply("❌ Lỗi cấu hình luồng thông báo.");
    }
  });
}

module.exports = { registerBoardCommands };
