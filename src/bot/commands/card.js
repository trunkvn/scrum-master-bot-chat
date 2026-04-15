const { Markup } = require("telegraf");
const cardService = require("../../services/card.service");
const boardService = require("../../services/board.service");
const cardRepo = require("../../db/card.repo");
const userRepo = require("../../db/user.repo");
const { formatCard, formatMyCards, parseViDate } = require("../../utils/formatter");
const { createLogger } = require("../../utils/logger");
const { setPendingDelete } = require("../context/memory");

const log = createLogger("card-cmd");

function registerCardCommands(bot) {
  // /add [title] — Create a card
  bot.command("add", async (ctx) => {
    const title = ctx.payload?.trim();
    if (!title) return ctx.reply("⚠️ Cách dùng: /add Tên công việc mới");

    try {
      const board = await boardService.getBoard(ctx);
      const card = await cardService.createCard(board.id, {
        card_title: title,
      });

      ctx.reply(
        `✅ Tạo card *#${card.displayId || card.id} ${card.title}*\n📂 ${card.list.name}`,
        { 
          parse_mode: "Markdown",
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("✅ Hoàn thành", `done:${card.id}`),
              Markup.button.callback("🔍 Chi tiết", `view:${card.id}`)
            ]
          ])
        },
      );
    } catch (err) {
      log.error("Card create failed", { error: err.message });
      ctx.reply("❌ Lỗi khi tạo task.");
    }
  });

  // /my — View my cards
  bot.command("my", async (ctx) => {
    try {
      const cards = await cardService.getMyCards(ctx.state.user.id);
      const display = formatMyCards(cards);
      
      const buttons = cards.slice(0, 10).map((c) => {
        return [Markup.button.callback(`✅ #${c.displayId || c.id}`, `done:${c.id}`)];
      });

      ctx.reply(
        `📋 *Task của ${ctx.from.first_name}:*\n${display}`,
        { 
          parse_mode: "Markdown",
          ...(cards.length > 0 ? Markup.inlineKeyboard(buttons) : {})
        },
      );
    } catch (err) {
      log.error("My cards failed", { error: err.message });
      ctx.reply("❌ Lỗi khi xem task.");
    }
  });

  // /done [#id] — Mark as done
  bot.command("done", async (ctx) => {
    const input = ctx.payload?.trim().replace("#", "");
    const cardId = parseInt(input);
    if (!cardId) return ctx.reply("⚠️ Bạn cần cung cấp mã task. Ví dụ: /done #123");

    try {
      const board = await boardService.getBoard(ctx);
      const result = await cardService.moveCard(board.id, {
        card_id: cardId,
        target_list: "Done",
      });

      if (result.notFound) return ctx.reply("❌ Không tìm thấy card này.");
      ctx.reply(`✅ Card *#${result.card.displayId || cardId}* đã xong! 🎉`, { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Done failed", { error: err.message });
      ctx.reply("❌ Lỗi.");
    }
  });

  // /move [#id] [list name] — Move card to list
  bot.command("move", async (ctx) => {
    const parts = ctx.payload?.trim().split(/\s+/);
    if (!parts || parts.length < 2) return ctx.reply("⚠️ Cách dùng: /move #ID Tên-list (Vd: /move #123 Done)");

    const cardId = parseInt(parts[0].replace("#", ""));
    const listName = parts.slice(1).join(" ");

    if (!cardId) return ctx.reply("⚠️ ID card không hợp lệ.");

    try {
      const board = await boardService.getBoard(ctx);
      const result = await cardService.moveCard(board.id, {
        card_id: cardId,
        target_list: listName,
      });

      if (result.notFound) return ctx.reply("❌ Không tìm thấy card.");
      if (result.listNotFound) return ctx.reply("❌ Không tìm thấy list này.");

      ctx.reply(
        `📦 Đã chuyển *#${result.card.displayId || cardId}* → *${result.listName}*`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      log.error("Move failed", { error: err.message });
      ctx.reply("❌ Lỗi khi chuyển task.");
    }
  });

  // /assign [#id] [@user] — Assign card
  bot.command("assign", async (ctx) => {
    const parts = ctx.payload?.trim().split(/\s+/);
    if (!parts || parts.length < 2) return ctx.reply("⚠️ Dùng: /assign #123 @username");

    const cardId = parseInt(parts[0].replace("#", ""));
    const targetUser = parts[1].replace("@", "");

    try {
      const board = await boardService.getBoard(ctx);
      const result = await cardService.assignCard(board.id, {
        card_id: cardId,
        target_user: targetUser,
      });

      if (result.notFound) return ctx.reply("❌ Không tìm thấy card.");
      if (result.userNotFound) return ctx.reply(`❌ Không tìm thấy user "${targetUser}".`);

      ctx.reply(
        `👤 Đã giao *#${result.card.displayId || cardId}* cho *${result.card.assignee.firstName}*`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      log.error("Assign failed", { error: err.message });
      ctx.reply("❌ Lỗi khi giao task.");
    }
  });

  // /deadline [#id] [date] — Set deadline
  bot.command("deadline", async (ctx) => {
    const parts = ctx.payload?.trim().split(/\s+/);
    if (!parts || parts.length < 2) return ctx.reply("⚠️ Bạn hãy nhập theo mẫu: /deadline #ID ngày/tháng.\nVí dụ: /deadline #123 30/04");

    const cardId = parseInt(parts[0].replace("#", ""));
    const dateStr = parts.slice(1).join(" ");

    try {
      const board = await boardService.getBoard(ctx);
      const result = await cardService.setDeadline(board.id, {
        card_id: cardId,
        deadline: dateStr,
      });

      if (result.notFound) return ctx.reply("❌ Không tìm thấy card.");
      if (result.invalidDate) return ctx.reply("❌ Định dạng ngày không hợp lệ. Dùng: DD/MM");

      const { formatDate } = require("../../utils/formatter");
      ctx.reply(
        `⏰ Đã set deadline *#${result.card.displayId || cardId}* → *${formatDate(result.card.dueDate)}*`,
        { parse_mode: "Markdown" },
      );
    } catch (err) {
      log.error("Deadline failed", { error: err.message });
      ctx.reply("❌ Lỗi khi set deadline.");
    }
  });

  // /del [#id] — Delete card
  bot.command("del", async (ctx) => {
    const input = ctx.payload?.trim().replace("#", "");
    const cardId = parseInt(input);
    if (!cardId) return ctx.reply("⚠️ Dùng: /del #123");

    try {
      const board = await boardService.getBoard(ctx);
      const card = await cardService.getCardByDisplayId(board.id, cardId);
      if (!card) return ctx.reply("❌ Không tìm thấy card này.");
      
      const token = setPendingDelete(ctx, [card.id]);
      ctx.reply(`🗑️ Bạn chắc muốn xoá card *#${card.displayId || cardId}* không?`, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🗑️ Xoá", `delc:${token}`),
            Markup.button.callback("Huỷ", `delx:${token}`),
          ],
        ]),
      });
    } catch (err) {
      log.error("Delete failed", { error: err.message });
      ctx.reply("❌ Không tìm thấy card hoặc lỗi khi xoá.");
    }
  });
}

module.exports = { registerCardCommands };
