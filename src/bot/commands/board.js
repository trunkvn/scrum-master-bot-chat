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
}

module.exports = { registerBoardCommands };
