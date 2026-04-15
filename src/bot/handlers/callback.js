const cardService = require("../../services/card.service");
const boardService = require("../../services/board.service");
const cardRepo = require("../../db/card.repo");
const { createLogger } = require("../../utils/logger");
const { formatDate } = require("../../utils/formatter");
const { setLastCardId, getPendingDelete, clearPendingDelete } = require("../context/memory");
const { Markup } = require("telegraf");

const log = createLogger("callback");

function registerCallbackHandler(bot) {
  bot.on("callback_query", async (ctx) => {
    const data = ctx.callbackQuery.data;

    try {
      if (data === "cancel") {
        await ctx.answerCbQuery("Đã huỷ");
        return ctx.editMessageText("👌 Đã huỷ.");
      }

      // Pattern: action:cardId:extra
      const parts = data.split(":");
      const action = parts[0];

      switch (action) {
        case "done": {
          const cardId = parseInt(parts[1]);
          const board = await boardService.getBoard(ctx);
          await cardService.moveCard(board.id, {
            internal_card_id: cardId,
            target_list: "Done",
          });
          setLastCardId(ctx, cardId);
          await ctx.answerCbQuery("Done! ✅");
          const card = await cardRepo.findById(cardId);
          await ctx.editMessageText(`✅ Card #${card?.displayId || cardId} đã hoàn thành!`);
          break;
        }

        case "view": {
          const cardId = parseInt(parts[1]);
          const card = await cardRepo.findById(cardId);
          if (!card) {
            await ctx.answerCbQuery("Không tìm thấy");
            return;
          }
          setLastCardId(ctx, cardId);

          let msg = `📌 *#${card.displayId || card.id} ${card.title}*\n`;
          msg += `📂 ${card.list.name}\n`;
          if (card.assignee) msg += `👤 ${card.assignee.firstName}\n`;
          if (card.dueDate) msg += `⏰ ${formatDate(card.dueDate)}\n`;
          if (card.description) msg += `\n${card.description}`;

          if (card.labels.length > 0) {
            msg += `\n🏷️ ${card.labels.map((cl) => cl.label.name).join(", ")}`;
          }

          await ctx.answerCbQuery();
          await ctx.reply(msg, { parse_mode: "Markdown" });
          break;
        }

        case "delc": {
          const token = parts[1];
          const ids = getPendingDelete(ctx, token);
          if (!ids || ids.length === 0) {
            await ctx.answerCbQuery("Hết hạn hoặc không tìm thấy");
            return;
          }
          clearPendingDelete(ctx, token);
          const result = await cardService.deleteCards(null, ids, true);
          const ok = (result.deletedIds || []).map((id) => `#${id}`);
          const miss = (result.notFoundIds || []).map((id) => `#${id}`);
          await ctx.answerCbQuery("Đã xoá");
          let msg = ok.length ? `🗑️ Đã xoá: ${ok.join(", ")}` : "⚠️ Không xoá được task nào.";
          if (miss.length) msg += `\n❌ Không tìm thấy: ${miss.join(", ")}`;
          // Prefer editing if possible, fallback to replying.
          try {
            await ctx.editMessageText(msg);
          } catch (_) {
            await ctx.reply(msg);
          }
          break;
        }

        case "delx": {
          const token = parts[1];
          clearPendingDelete(ctx, token);
          await ctx.answerCbQuery("Đã huỷ");
          try {
            await ctx.editMessageText("👌 Đã huỷ.");
          } catch (_) {
            await ctx.reply("👌 Đã huỷ.");
          }
          break;
        }

        default:
          await ctx.answerCbQuery("Unknown action");
      }
    } catch (err) {
      log.error("Callback failed", { error: err.message, data });
      await ctx.answerCbQuery("Lỗi 😅");
    }
  });
}

module.exports = { registerCallbackHandler };
