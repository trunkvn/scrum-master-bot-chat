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
        assignee_id: ctx.state.user.id,
      });

      ctx.reply(
        `✅ Tạo card *#${card.displayId || card.id} ${card.title}*\n📂 ${card.list.name}`,
        { 
          parse_mode: "Markdown"
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
      
      ctx.reply(
        `📋 *Task của ${ctx.from.first_name}:*\n${display}`,
        { 
          parse_mode: "Markdown"
        },
      );
    } catch (err) {
      log.error("My cards failed", { error: err.message });
      ctx.reply("❌ Lỗi khi xem task.");
    }
  });

  bot.command("done", async (ctx) => {
    const input = ctx.payload?.trim() || "";
    const parts = input.split(/\s+/);
    const ids = [];
    for (const p of parts) {
      if (/^#?\d+$/.test(p)) ids.push(parseInt(p.replace("#", "")));
    }

    if (ids.length === 0) return ctx.reply("⚠️ Bạn cần cung cấp mã task. Ví dụ: /done #123");

    try {
      const board = await boardService.getBoard(ctx);
      const results = [];
      const unauthorized = [];
      const notFound = [];

      for (const id of ids) {
        const result = await cardService.moveCard(board.id, {
          card_id: id,
          target_list: "Done",
          sender_id: ctx.state.user.id
        });
        if (result.notFound) notFound.push(id);
        else if (result.unauthorized) unauthorized.push(result);
        else results.push(result);
      }

      let msg = "";
      if (results.length > 0) {
        msg += `✅ Đã xong ${results.length} task! 🎉`;
        results.forEach(r => msg += `\n• *#${r.card.displayId || r.card.id}*`);
      }
      if (unauthorized.length > 0) {
        msg += `\n\n⚠️ Có ${unauthorized.length} task không chuyển được do bạn không phụ trách:`;
        unauthorized.forEach(r => msg += `\n• *#${r.card.displayId || r.card.id}* (của ${r.assigneeName})`);
      }
      if (notFound.length > 0) {
        msg += `\n\n❌ Không tìm thấy: ${notFound.map(id => `#${id}`).join(", ")}`;
      }

      ctx.reply(msg.trim(), { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Done failed", { error: err.message });
      ctx.reply("❌ Lỗi.");
    }
  });

  bot.command("move", async (ctx) => {
    const input = ctx.payload?.trim() || "";
    const parts = input.split(/\s+/);
    const ids = [];
    const rest = [];

    for (const p of parts) {
      if (/^#?\d+$/.test(p)) ids.push(parseInt(p.replace("#", "")));
      else rest.push(p);
    }
    const listName = rest.join(" ");

    if (ids.length === 0 || !listName) return ctx.reply("⚠️ Cách dùng: /move #ID1 #ID2 Tên-list (Vd: /move #123 #124 Done)");

    try {
      const board = await boardService.getBoard(ctx);
      const results = [];
      const unauthorized = [];
      const notFound = [];
      let listNotFoundError = false;

      for (const id of ids) {
        const result = await cardService.moveCard(board.id, {
          card_id: id,
          target_list: listName,
          sender_id: ctx.state.user.id
        });
        if (result.listNotFound) listNotFoundError = true;
        else if (result.notFound) notFound.push(id);
        else if (result.unauthorized) unauthorized.push(result);
        else results.push(result);
      }

      if (listNotFoundError) return ctx.reply(`❌ Không tìm thấy list "${listName}".`);

      let msg = "";
      if (results.length > 0) {
        msg += `📦 Đã chuyển ${results.length} task → *${results[0].listName}*:`;
        results.forEach(r => msg += `\n• *#${r.card.displayId || r.card.id}*`);
      }
      if (unauthorized.length > 0) {
        msg += `\n\n⚠️ Có ${unauthorized.length} task không chuyển được do bạn không phụ trách:`;
        unauthorized.forEach(r => msg += `\n• *#${r.card.displayId || r.card.id}* (của ${r.assigneeName})`);
      }
      if (notFound.length > 0) {
        msg += `\n\n❌ Không tìm thấy: ${notFound.map(id => `#${id}`).join(", ")}`;
      }

      ctx.reply(msg.trim(), { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Move failed", { error: err.message });
      ctx.reply("❌ Lỗi khi chuyển task.");
    }
  });

  bot.command("assign", async (ctx) => {
    const input = ctx.payload?.trim() || "";
    const parts = input.split(/\s+/);
    const ids = [];
    let targetUser = "";

    for (const p of parts) {
      if (/^#?\d+$/.test(p)) ids.push(parseInt(p.replace("#", "")));
      else if (p.startsWith("@")) targetUser = p.replace("@", "");
      else if (!targetUser) targetUser = p; // fallback
    }

    if (ids.length === 0 || !targetUser) return ctx.reply("⚠️ Dùng: /assign #123 @username");

    try {
      const board = await boardService.getBoard(ctx);
      const results = [];
      const notFound = [];
      let userNotFound = false;

      for (const id of ids) {
        const result = await cardService.assignCard(board.id, {
          card_id: id,
          target_user: targetUser,
        });

        if (result.userNotFound) {
          userNotFound = true;
          break;
        }
        if (result.notFound) notFound.push(id);
        else results.push(result);
      }

      if (userNotFound) return ctx.reply(`❌ Không tìm thấy user "${targetUser}".`);

      let msg = "";
      if (results.length > 0) {
        msg += `👤 Đã giao ${results.length} task cho *${results[0].card.assignee.firstName}*:`;
        results.forEach(r => msg += `\n• *#${r.card.displayId || r.card.id}*`);
      }
      if (notFound.length > 0) {
        msg += `\n\n❌ Không tìm thấy: ${notFound.map(id => `#${id}`).join(", ")}`;
      }

      ctx.reply(msg.trim(), { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Assign failed", { error: err.message });
      ctx.reply("❌ Lỗi khi giao task.");
    }
  });

  bot.command("deadline", async (ctx) => {
    const input = ctx.payload?.trim() || "";
    const parts = input.split(/\s+/);
    const ids = [];
    const rest = [];

    for (const p of parts) {
      if (/^#?\d+$/.test(p)) ids.push(parseInt(p.replace("#", "")));
      else rest.push(p);
    }
    const dateStr = rest.join(" ");

    if (ids.length === 0 || !dateStr) return ctx.reply("⚠️ Bạn hãy nhập theo mẫu: /deadline #ID ngày/tháng.\nVí dụ: /deadline #123 30/04");

    try {
      const board = await boardService.getBoard(ctx);
      const results = [];
      const notFound = [];
      const invalidDate = [];
      
      const { formatDate } = require("../../utils/formatter");

      for (const id of ids) {
        const result = await cardService.setDeadline(board.id, {
          card_id: id,
          deadline: dateStr,
        });
        
        if (result.invalidDate) invalidDate.push(id);
        else if (result.notFound) notFound.push(id);
        else results.push(result);
      }

      if (invalidDate.length > 0 && results.length === 0) return ctx.reply("❌ Ngày không hợp lệ, dùng: DD/MM");

      let msg = "";
      if (results.length > 0) {
        msg += `⏰ Đã set deadline cho ${results.length} task thành ${formatDate(results[0].card.dueDate)}:`;
        results.forEach(r => msg += `\n• *#${r.card.displayId || r.card.id}*`);
      }
      if (notFound.length > 0) {
        msg += `\n\n❌ Không tìm thấy: ${notFound.map(id => `#${id}`).join(", ")}`;
      }

      ctx.reply(msg.trim(), { parse_mode: "Markdown" });
    } catch (err) {
      log.error("Deadline failed", { error: err.message });
      ctx.reply("❌ Lỗi khi set deadline.");
    }
  });

  // /del [#id] — Delete card
  bot.command("del", async (ctx) => {
    const input = ctx.payload?.trim() || "";
    const parts = input.split(/\s+/);
    const ids = [];

    for (const p of parts) {
      if (/^#?\d+$/.test(p)) ids.push(parseInt(p.replace("#", "")));
    }

    if (ids.length === 0) return ctx.reply("⚠️ Dùng: /del #123 #124");

    try {
      const board = await boardService.getBoard(ctx);
      const cards = [];
      const notFoundIds = [];
      
      for (const id of ids) {
        const card = await cardService.getCardByDisplayId(board.id, id);
        if (card) cards.push(card);
        else notFoundIds.push(id);
      }

      if (cards.length === 0) return ctx.reply(`❌ Không tìm thấy các task: ${notFoundIds.map(id => `#${id}`).join(", ")}`);
      
      const token = setPendingDelete(ctx, cards.map(c => c.id));
      let msg = `🗑️ Bạn chắc muốn xoá ${cards.length} task này không?\n`;
      cards.forEach(c => msg += `\n• *#${c.displayId || c.id}* ${c.title}`);
      if (notFoundIds.length > 0) msg += `\n\n⚠️ Không lấy được: ${notFoundIds.map(id => `#${id}`).join(", ")}`;

      ctx.reply(msg.trim(), {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🗑️ Xoá", `delc:${token}`),
            Markup.button.callback("Huỷ", `delx:${token}`),
          ]
        ])
      });
    } catch (err) {
      log.error("Delete failed", { error: err.message });
      ctx.reply("❌ Không tìm thấy card hoặc lỗi khi xoá.");
    }
  });
}

module.exports = { registerCardCommands };
