const { analyzeMessage } = require("../../ai/brain");
const boardService = require("../../services/board.service");
const cardService = require("../../services/card.service");
const reportService = require("../../services/report.service");
const { formatMyCards, formatCard } = require("../../utils/formatter");
const { createLogger } = require("../../utils/logger");
const { Markup } = require("telegraf");
const {
  setLastCardId,
  getLastCardId,
  setPendingDelete,
  getHistory,
  addMessageToHistory,
} = require("../context/memory");

const log = createLogger("message");

function normalizeTargetUser(targetUser) {
  if (targetUser == null) return null;
  const raw = String(targetUser).trim();
  if (!raw) return null;
  const noAt = raw.replace(/^@+/, "");
  const selfWord = /^(tôi|toi|mình|minh|me|tui|tao|tớ|to|myself)$/i;
  return selfWord.test(noAt) ? null : noAt;
}

function extractAllCardIds(text) {
  const ids = [];
  const re = /#\s*(\d+)/g;
  let m;
  while ((m = re.exec(text)) !== null) ids.push(parseInt(m[1]));
  return Array.from(new Set(ids)).filter((n) => Number.isFinite(n) && n > 0);
}

function isIntroductionRequest(text) {
  const t = text.toLowerCase();
  return (
    (t.includes("là ai") && (t.includes("bạn") || t.includes("bot"))) ||
    t.includes("giới thiệu") ||
    t.includes("introduce") ||
    t.includes("who are you") ||
    t.includes("hướng dẫn")
  );
}

function registerMessageHandler(bot) {
  bot.on("text", async (ctx) => {
    const text = ctx.message.text;

    // Skip commands (already handled)
    if (text.startsWith("/")) return;

    const isPrivate = ctx.chat.type === "private";
    const isGroup = ctx.chat.type === "group" || ctx.chat.type === "supergroup";

    // In groups: only respond if @mentioned or replied to
    if (isGroup) {
      const botInfo = await bot.telegram.getMe();
      const isMentioned = text.includes(`@${botInfo.username}`);
      const isReply = ctx.message.reply_to_message?.from?.id === botInfo.id;

      if (!isMentioned && !isReply) return;
    }

    await ctx.sendChatAction("typing");

    try {
      const userName = ctx.from.first_name || ctx.from.username;
      // Lightweight deterministic parsing for common patterns so we don't rely
      // entirely on the AI (which can misclassify "deadline" questions).
      const cleaned = String(text || "")
        .replace(/@\w+/g, " ")
        .replace(/\s+/g, " ")
        .trim();

      const allIds = extractAllCardIds(cleaned);
      const doneCue = /\b(xong|done|hoàn\s*thành)\b/i.test(cleaned);
      const deleteCue = /\b(huỷ|hủy|xoá|xóa|remove|delete)\b/i.test(cleaned);
      if (allIds.length > 1 && doneCue) {
        const board = await boardService.getBoard(ctx);
        const r = await cardService.moveCards(board.id, {
          card_ids: allIds,
          target_list: "Done",
        });
        const ok = (r.movedIds || []).map((id) => `#${id}`);
        const miss = (r.notFoundIds || []).map((id) => `#${id}`);
        let msg = ok.length
          ? `✅ Đã hoàn thành: ${ok.join(", ")}`
          : "⚠️ Không hoàn thành được task nào.";
        if (miss.length) msg += `\n❌ Không tìm thấy: ${miss.join(", ")}`;
        return ctx.reply(msg);
      }
      if (allIds.length > 1 && deleteCue) {
        const token = setPendingDelete(ctx, allIds);
        const msg = `🗑️ Bạn chắc muốn xoá ${allIds.length} task: ${allIds.map((id) => `#${id}`).join(", ")}?`;
        return ctx.reply(msg, {
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback("🗑️ Xoá", `delc:${token}`),
              Markup.button.callback("Huỷ", `delx:${token}`),
            ],
          ]),
        });
      }

      const idMatch = cleaned.match(/#\s*(\d+)/);
      const hasDeadlineWord = /\bdeadline\b/i.test(cleaned);
      const looksLikeQuestion =
        /\b(là|bao\s*nhiêu|khi\s*nào|như\s*nào|hôm\s*nào|ra\s*sao)\b/i.test(
          cleaned,
        );
      const looksLikeSet =
        /\b(set|đặt|đổi|dời|chuyển|update|cập\s*nhật)\b/i.test(cleaned);
      const hasDatePhrase =
        /\bmai\b/i.test(cleaned) ||
        /\b(cn|chu\s*nhat|chủ\s*nhật|thu\s*\d|thứ\s*\d|t[2-7])\b/i.test(
          cleaned,
        ) ||
        /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?/.test(cleaned);

      const history = getHistory(ctx);
      let analysis;

      const botInfo = await bot.telegram.getMe();
      if (isIntroductionRequest(cleaned)) {
        const groupName = ctx.chat.title || "nhóm";
        analysis = {
          intent: "chat",
          chat_response:
            `Tui là trợ lý ảo sẵn sàng đồng hành cùng team mình, vừa giúp quản lý công việc cực kỳ chuyên nghiệp, lại vừa có thể trò chuyện, giải đáp thắc mắc đủ mọi chủ đề trên đời! 🤖✨\n\n` +
            `💡 *Mẹo:* Bạn có thể dùng lệnh / hoặc đơn giản là nhắn tin tự nhiên rồi @mention tui.\n\n` +
            `*Ví dụ:*\n` +
            `• *"@${botInfo.username} tạo task fix bug login, deadline thứ 6"*\n` +
            `⚠️ *Lưu ý:* Mã *#ID* (Vd: task #1 xong) giúp tui xử lý công việc chính xác hơn trong nhóm.\n\n` +
            `🛠 *Lưu ý:* Tui vẫn đang trong giai đoạn phát triển nên có thể có sai sót, mong cả nhà thông cảm và góp ý để tui hoàn thiện hơn nhé! 🙏\n\n` +
            `Sẵn sàng phục vụ cả nhà! 🫡`,
        };
      } else {
        // Let the user know we are thinking
        await ctx.sendChatAction("typing");

        if (hasDeadlineWord && idMatch && looksLikeQuestion) {
          analysis = {
            intent: "search_card",
            card_title: null,
            card_id: parseInt(idMatch[1]),
            target_list: null,
            target_user: null,
            deadline: null,
            priority: null,
            chat_response: `Để tui xem deadline của task #${idMatch[1]} nha.`,
          };
        } else if (
          hasDeadlineWord &&
          idMatch &&
          looksLikeSet &&
          hasDatePhrase
        ) {
          // Defer to AI for extracting the exact date phrase (deadline) from the text.
          analysis = await analyzeMessage(text, userName, history);
        } else {
          analysis = await analyzeMessage(text, userName, history);
        }
      }

      // Normalize analysis fields that commonly break downstream logic.
      analysis.target_user = normalizeTargetUser(analysis.target_user);

      // Prefer deterministic "#id" extraction over LLM card_id.
      // If LLM produced a card_id but the message doesn't explicitly mention an ID, ignore it.
      const explicitIdInText =
        /#\s*\d+/.test(cleaned) ||
        /\b(id|task|card)\s*[:#]?\s*\d+\b/i.test(cleaned);
      if (idMatch) {
        analysis.card_id = parseInt(idMatch[1]);
      } else if (!explicitIdInText) {
        analysis.card_id = null;
      }

      // Contextual resolution: "task đó/cái đó/việc đó" -> last referenced card id.
      const refersToPrevious =
        /\b(task|việc|viec|card)\s*(đó|do|đấy|day|này|nay)\b/i.test(cleaned) ||
        /\b(task|việc|viec|card)\s*(vừa|mới)\s*(tạo|tao)\b/i.test(cleaned) ||
        /\b(vừa|mới)\s*(tạo|tao)\s*(task|việc|viec|card)\b/i.test(cleaned) ||
        /\b(cái|cai)\s*(đó|do|đấy|day|này|nay)\b/i.test(cleaned) ||
        /\b(nó|no)\b/i.test(cleaned);
      // Guard against a common LLM mistake: interpreting "thứ 7/thu 7/t7" as card_id=7.
      // Only treat numbers as card_id when user explicitly marks an ID (#7, "task 7", "id 7", ...).
      const explicitIdProvided =
        /#\s*\d+/.test(cleaned) ||
        /\b(id|task|card)\s*[:#]?\s*\d+\b/i.test(cleaned);
      const looksLikeDowNumber =
        /\b(thứ|thu|t)\s*([2-7])\b/i.test(cleaned) &&
        !/#\s*[2-7]\b/.test(cleaned);

      // Extra guard: "thứ 6/thu 6/t6" is usually a date phrase, not a card id.
      if (
        hasDeadlineWord &&
        hasDatePhrase &&
        looksLikeDowNumber &&
        !explicitIdProvided &&
        Number.isFinite(analysis.card_id) &&
        analysis.card_id >= 2 &&
        analysis.card_id <= 7
      ) {
        analysis.card_id = null;
      }

      if (refersToPrevious) {
        const last = getLastCardId(ctx);
        if (last) {
          if (!analysis.card_id) {
            analysis.card_id = last;
          } else if (!explicitIdProvided && looksLikeDowNumber) {
            analysis.card_id = last;
          }
        }
      }

      // If user refers to previous task and we still don't have an id, use last context.
      if (
        !analysis.card_id &&
        (analysis.intent === "set_deadline" ||
          analysis.intent === "search_card") &&
        (refersToPrevious || (hasDeadlineWord && hasDatePhrase))
      ) {
        const last = getLastCardId(ctx);
        if (last) analysis.card_id = last;
      }

      // If user provides an explicit ID, store it as context.
      if (analysis.card_id) setLastCardId(ctx, analysis.card_id);

      switch (analysis.intent) {
        case "create_card":
          await handleCreateCard(ctx, analysis);
          break;

        case "move_card":
          await handleMoveCard(ctx, analysis);
          break;

        case "ask_my_tasks":
          await handleAskMyTasks(ctx, analysis);
          break;

        case "ask_team_tasks":
          await handleAskTeamTasks(ctx, analysis);
          break;

        case "assign_card":
          await handleAssignCard(ctx, analysis);
          break;

        case "set_deadline":
          await handleSetDeadline(ctx, analysis);
          break;

        case "search_card":
          await handleSearchCard(ctx, analysis);
          break;

        case "delete_card":
          await handleDeleteCard(ctx, analysis);
          break;

        case "chat":
        default:
          // Just respond naturally
          ctx.reply(analysis.chat_response || "👍");
          break;
      }

      // Save to history after processing
      addMessageToHistory(ctx, "user", text, userName);
      if (analysis.chat_response) {
        addMessageToHistory(ctx, "model", analysis.chat_response, "Bot");
      }
    } catch (error) {
      log.error("Message handler failed", { error: error.message });
      ctx.reply("Lỗi rồi 😅 Thử lại nha!");
    }
  });
}

async function handleCreateCard(ctx, analysis) {
  if (!analysis.card_title) {
    return ctx.reply(
      analysis.chat_response || "Tạo task gì vậy? Nói rõ hơn nha!",
    );
  }

  try {
    const board = await boardService.getBoard(ctx);
    const card = await cardService.createCard(board.id, {
      card_title: analysis.card_title,
      target_user: analysis.target_user,
      deadline: analysis.deadline,
      priority: analysis.priority,
      target_list: analysis.target_list,
    });

    // Remember last created card so follow-ups like "task đó" work.
    setLastCardId(ctx, card.displayId || card.id);

    // Assign to sender if no target user specified
    if (!analysis.target_user && card.assigneeId === null) {
      const cardRepo = require("../../db/card.repo");
      await cardRepo.assign(card.id, ctx.state.user.id);
    }

    let msg = analysis.chat_response || "Đã tạo!";
    msg += `\n📌 *#${card.displayId || card.id} ${card.title}* → ${card.list.name}`;
    if (card.assignee) msg += `\n👤 ${card.assignee.firstName}`;
    if (card.dueDate) {
      const { formatDate } = require("../../utils/formatter");
      msg += `\n⏰ ${formatDate(card.dueDate)}`;
    }

    ctx.reply(msg, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback("✅ Hoàn thành", `done:${card.id}`),
          Markup.button.callback("🔍 Chi tiết", `view:${card.id}`),
        ],
      ]),
    });
  } catch (err) {
    log.error("Create card from chat failed", { error: err.message });
    ctx.reply("Lỗi khi tạo task 😅");
  }
}

async function handleMoveCard(ctx, analysis) {
  try {
    const board = await boardService.getBoard(ctx);
    const result = await cardService.moveCard(board.id, {
      card_id: analysis.card_id,
      card_title: analysis.card_title,
      target_list: analysis.target_list || "Done",
    });

    if (result.notFound) {
      return ctx.reply(
        analysis.chat_response +
          "\n⚠️ Nhưng tui không tìm thấy task nào khớp. Check lại tên hoặc dùng #id nhé!",
      );
    }

    if (result.ambiguous) {
      let msg = "Tìm thấy nhiều task khớp, chọn 1 nhé:\n\n";
      result.matches.forEach((m) => {
        msg += `• *#${m.id}* ${m.title}\n`;
      });
      msg += `\nDùng /done #id hoặc /move #id [list]`;
      return ctx.reply(msg, { parse_mode: "Markdown" });
    }

    let msg = analysis.chat_response || "Đã chuyển!";
    msg += `\n📦 *#${result.card.displayId || result.card.id} ${result.card.title}* → ${result.listName}`;
    setLastCardId(ctx, result.card.displayId || result.card.id);
    ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    log.error("Move card from chat failed", { error: err.message });
    ctx.reply("Lỗi khi cập nhật task 😅");
  }
}

async function handleAskMyTasks(ctx, analysis) {
  try {
    const filter = analysis.target_list === "Done" ? "done" : "active";
    const cards = await cardService.getMyCards(ctx.state.user.id, filter);
    const isAskingDone = filter === "done";

    if (cards.length === 0) {
      return ctx.reply(
        isAskingDone
          ? "Bạn chưa có task nào hoàn thành cả. Cố gắng lên nhé! 💪"
          : "🎉 Hiện tại bạn không còn task nào dang dở cả! Nghỉ ngơi thôi.",
      );
    }

    const display = formatMyCards(cards);
    const intro =
      analysis.chat_response ||
      (isAskingDone
        ? "Đây là các task bạn đã hoàn thành:"
        : `Task của ${ctx.from.first_name}:`);
    const buttons = cards.slice(0, 10).map((c) => {
      return [Markup.button.callback(`✅ #${c.id}`, `done:${c.id}`)];
    });

    ctx.reply(`${intro}\n${display}`, {
      parse_mode: "Markdown",
      ...Markup.inlineKeyboard(buttons),
    });
  } catch (err) {
    log.error("Ask my tasks failed", { error: err.message });
    ctx.reply("Lỗi khi check task 😅");
  }
}

async function handleAskTeamTasks(ctx, analysis) {
  try {
    const board = await boardService.getBoard(ctx);
    const lists = await boardService.getLists(board.id);

    // Check if total cards in all lists is 0
    const totalCards = lists.reduce((sum, list) => sum + list.cards.length, 0);
    if (totalCards === 0) {
      return ctx.reply("🌟 Team mình đang sạch bóng task! Tuyệt vời quá.");
    }

    const { formatCardsByList } = require("../../utils/formatter");
    const display = formatCardsByList(lists);
    const intro = analysis.chat_response || "Đây là task của team:";
    ctx.reply(`${intro}\n${display}`, { parse_mode: "Markdown" });
  } catch (err) {
    log.error("Ask team tasks failed", { error: err.message });
    ctx.reply("Lỗi khi check task team 😅");
  }
}

async function handleAssignCard(ctx, analysis) {
  try {
    const board = await boardService.getBoard(ctx);

    // If user says "giao cho tôi", treat as assigning to sender.
    if (!analysis.target_user) {
      const cardRepo = require("../../db/card.repo");
      const id = analysis.card_id;
      if (!id)
        return ctx.reply("Bạn muốn giao task nào? Gõ `#id` (vd: `#2`) nha.", {
          parse_mode: "Markdown",
        });
      const card = await cardRepo.assign(id, ctx.state.user.id);
      let msg = analysis.chat_response || "Đã giao!";
      msg += `\n👤 *#${card.displayId || card.id} ${card.title}* → ${ctx.from.first_name}`;
      setLastCardId(ctx, card.displayId || card.id);
      return ctx.reply(msg, { parse_mode: "Markdown" });
    }

    const result = await cardService.assignCard(board.id, {
      card_id: analysis.card_id,
      card_title: analysis.card_title,
      target_user: analysis.target_user,
    });

    if (result.notFound) return ctx.reply("Không tìm thấy card 😅");
    if (result.userNotFound)
      return ctx.reply(
        `Không tìm thấy user "${analysis.target_user}". User đó đã /start bot chưa?`,
      );

    let msg = analysis.chat_response || "Đã giao!";
    msg += `\n👤 *#${result.card.displayId || result.card.id} ${result.card.title}* → ${result.card.assignee.firstName}`;
    setLastCardId(ctx, result.card.displayId || result.card.id);
    ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    log.error("Assign from chat failed", { error: err.message });
    ctx.reply("Lỗi khi giao task 😅");
  }
}

async function handleSetDeadline(ctx, analysis) {
  try {
    const board = await boardService.getBoard(ctx);
    const result = await cardService.setDeadline(board.id, {
      card_id: analysis.card_id,
      card_title: analysis.card_title,
      deadline: analysis.deadline,
    });

    if (result.notFound) return ctx.reply("Không tìm thấy card 😅");
    if (result.invalidDate)
      return ctx.reply("Ngày không hợp lệ, dùng DD/MM nha!");

    const { formatDate } = require("../../utils/formatter");
    let msg = analysis.chat_response || "Đã set deadline!";
    msg += `\n⏰ *#${result.card.displayId || result.card.id}* → ${formatDate(result.card.dueDate)}`;
    setLastCardId(ctx, result.card.displayId || result.card.id);
    ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    log.error("Set deadline from chat failed", { error: err.message });
    ctx.reply("Lỗi khi set deadline 😅");
  }
}

async function handleSearchCard(ctx, analysis) {
  try {
    const board = await boardService.getBoard(ctx);
    let cards = [];

    // If user is asking to search but provided no ID/title, don't search with chat_response.
    if (!analysis.card_id && !analysis.card_title) {
      return ctx.reply(
        "Bạn muốn xem task nào? Gõ `#id` (vd: `#2`) hoặc gửi vài từ khoá trong tên task nhé.",
        { parse_mode: "Markdown" },
      );
    }

    // Prioritize ID lookup if provided
    if (analysis.card_id) {
      const card = await cardService.getCardByDisplayId(
        board.id,
        analysis.card_id,
      );
      if (card) {
        cards = [card];
      }
    }

    // Fallback to fuzzy search if no ID or no card found by ID
    if (cards.length === 0) {
      cards = await cardService.searchCards(board.id, analysis.card_title);
    }

    if (cards.length === 0) {
      return ctx.reply(
        "🔍 Tui đã lục tung cả board nhưng không thấy task nào như bạn mô tả cả.",
      );
    }

    // If it's a specific card query (like asking "what is the deadline"),
    // and we found exactly one card, give a more detailed response.
    if (cards.length === 1 && analysis.card_id) {
      const card = cards[0];
      const { formatDate } = require("../../utils/formatter");
      let msg =
        analysis.chat_response ||
        `Đây là thông tin task *#${card.displayId || card.id}*:`;
      msg += `\n\n📌 *${card.title}*`;
      msg += `\n📋 Trạng thái: ${card.list.name}`;
      if (card.assignee) msg += `\n👤 Người làm: ${card.assignee.firstName}`;
      if (card.dueDate) msg += `\n⏰ Deadline: ${formatDate(card.dueDate)}`;
      else msg += "\n⏰ Deadline: Chưa có";

      setLastCardId(ctx, card.displayId || card.id);
      return ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [Markup.button.callback("🔍 Chi tiết", `view:${card.id}`)],
        ]),
      });
    }

    let msg = analysis.chat_response || "Tìm thấy:\n";
    cards.forEach((c) => {
      msg += `\n• *#${c.displayId || c.id}* ${c.title} (${c.list?.name || "?"})`;
      if (c.assignee) msg += ` → @${c.assignee.firstName}`;
    });
    if (cards.length === 1)
      setLastCardId(ctx, cards[0].displayId || cards[0].id);
    ctx.reply(msg, { parse_mode: "Markdown" });
  } catch (err) {
    log.error("Search from chat failed", { error: err.message });
    ctx.reply("Lỗi khi tìm 😅");
  }
}

async function handleDeleteCard(ctx, analysis) {
  try {
    const board = await boardService.getBoard(ctx);

    if (analysis.card_id) {
      const card = await cardService.getCardByDisplayId(
        board.id,
        analysis.card_id,
      );
      if (!card) return ctx.reply("Không tìm thấy card 😅");
      const token = setPendingDelete(ctx, [card.id]);
      const msg = `🗑️ Bạn chắc muốn xoá task *#${card.displayId || card.id}* không?`;
      return ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🗑️ Xoá", `delc:${token}`),
            Markup.button.callback("Huỷ", `delx:${token}`),
          ],
        ]),
      });
    }

    if (analysis.card_title) {
      const matches = await cardService.searchCards(
        board.id,
        analysis.card_title,
      );
      if (matches.length === 0) return ctx.reply("Không tìm thấy card 😅");
      if (matches.length > 1) {
        let msg = "Tìm thấy nhiều task khớp, chọn 1 nhé:\n\n";
        matches.forEach(
          (m) => (msg += `• *#${m.displayId || m.id}* ${m.title}\n`),
        );
        msg += `\nGõ: "xoá #id"`;
        return ctx.reply(msg, { parse_mode: "Markdown" });
      }
      const token = setPendingDelete(ctx, [matches[0].id]);
      const msg = `🗑️ Bạn chắc muốn xoá task *#${matches[0].displayId || matches[0].id}* ${matches[0].title} không?`;
      return ctx.reply(msg, {
        parse_mode: "Markdown",
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback("🗑️ Xoá", `delc:${token}`),
            Markup.button.callback("Huỷ", `delx:${token}`),
          ],
        ]),
      });
    }

    return ctx.reply(
      "Bạn muốn xoá task nào? Gõ `#id` (vd: `#2`) hoặc vài từ khoá trong tên task nhé.",
      {
        parse_mode: "Markdown",
      },
    );
  } catch (err) {
    log.error("Delete from chat failed", { error: err.message });
    ctx.reply("Lỗi khi xoá task 😅");
  }
}

module.exports = { registerMessageHandler };
