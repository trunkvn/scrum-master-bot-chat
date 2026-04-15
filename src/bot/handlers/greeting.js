const boardService = require("../../services/board.service");
const { createLogger } = require("../../utils/logger");

const log = createLogger("greeting");

function registerGreetingHandler(bot) {
  bot.on("new_chat_members", async (ctx) => {
    const newMembers = ctx.message.new_chat_members;
    const botInfo = await bot.telegram.getMe();

    // Check if the bot itself was added to the group
    const botWasAdded = newMembers.some((m) => m.id === botInfo.id);
    if (!botWasAdded) return;

    const groupName = ctx.chat.title || "nhóm";
    const topicId = ctx.message?.message_thread_id;

    log.info("Bot added to group", {
      chatId: ctx.chat.id,
      groupName,
      topicId,
    });

    // Auto-create a board for this group
    try {
      const user = ctx.state?.user;
      if (user) {
        await boardService.createBoard(
          groupName,
          user.id,
          ctx.chat.id.toString(),
          topicId,
        );
      }
    } catch (err) {
      log.warn("Auto-create board on join failed", { error: err.message });
    }

    // Send introduction
    await ctx.reply(
      `Chào cả nhà *${groupName}*! 👋\n\n` +
        `Tui là trợ lý ảo sẵn sàng đồng hành cùng team mình, vừa giúp quản lý công việc cực kỳ chuyên nghiệp, lại vừa có thể trò chuyện, giải đáp thắc mắc đủ mọi chủ đề trên đời! 🤖✨\n\n` +
        `💡 *Mẹo:* Bạn có thể dùng lệnh / hoặc đơn giản là nhắn tin tự nhiên rồi @mention tui.\n\n` +
        `*Ví dụ:*\n` +
        `• *"@${botInfo.username} tạo task fix bug login, deadline thứ 6"*\n` +
        `⚠️ *Lưu ý:* Mã *#ID* (Vd: task #1 xong) giúp tui xử lý công việc chính xác hơn trong nhóm.\n\n` +
        `🛠 *Lưu ý:* Tui vẫn đang trong giai đoạn phát triển nên có thể có sai sót, mong cả nhà thông cảm và góp ý để tui hoàn thiện hơn nhé! 🙏\n\n` +
        `Sẵn sàng phục vụ cả nhà! 🫡`,
      {
        parse_mode: "Markdown",
        message_thread_id: topicId,
      },
    );
  });
}

module.exports = { registerGreetingHandler };
