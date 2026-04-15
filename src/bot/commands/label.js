const labelRepo = require("../../db/label.repo");
const cardRepo = require("../../db/card.repo");
const boardService = require("../../services/board.service");
const { createLogger } = require("../../utils/logger");

const log = createLogger("label-cmd");

const VALID_COLORS = ["red", "blue", "green", "yellow", "purple", "orange"];
const COLOR_ICONS = {
  red: "🔴",
  blue: "🔵",
  green: "🟢",
  yellow: "🟡",
  purple: "🟣",
  orange: "🟠",
};

function registerLabelCommands(bot) {
  // /label [#id] [name] [color] — Add label to card
  bot.command("label", async (ctx) => {
    const parts = ctx.payload?.trim().split(/\s+/);
    if (!parts || parts.length < 2)
      return ctx.reply("⚠️ Dùng: /label #123 Bug red");

    const cardId = parseInt(parts[0].replace("#", ""));
    const name = parts[1];
    const color = parts[2]?.toLowerCase() || "blue";

    if (!VALID_COLORS.includes(color)) {
      return ctx.reply(
        `⚠️ Màu không hợp lệ. Chọn: ${VALID_COLORS.join(", ")}`,
      );
    }

    try {
      const board = await boardService.getBoard(ctx);
      const label = await labelRepo.findOrCreate(board.id, name, color);
      await labelRepo.addToCard(cardId, label.id);

      ctx.reply(
        `${COLOR_ICONS[color]} Đã gắn label *${name}* vào card *#${cardId}*`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      log.error("Label failed", { error: err.message });
      ctx.reply("❌ Lỗi khi gắn label.");
    }
  });

  // /labels — View all labels on current board
  bot.command("labels", async (ctx) => {
    try {
      const board = await boardService.getBoard(ctx);
      const labels = await labelRepo.findByBoard(board.id);

      if (labels.length === 0) return ctx.reply("Chưa có label nào.");

      let msg = "🏷️ *Labels:*\n\n";
      labels.forEach((l) => {
        msg += `${COLOR_ICONS[l.color] || "🏷️"} ${l.name}\n`;
      });
      ctx.reply(msg, { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Labels list failed", { error: err.message });
      ctx.reply("❌ Lỗi.");
    }
  });
}

module.exports = { registerLabelCommands };
