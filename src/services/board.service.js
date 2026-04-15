const boardRepo = require("../db/board.repo");
const listRepo = require("../db/list.repo");
const userRepo = require("../db/user.repo");
const { createLogger } = require("../utils/logger");

const log = createLogger("board-service");

const boardService = {
  /**
   * Get the active board for a chat context.
   * Auto-creates a default board if none exists.
   */
  async getBoard(ctx) {
    const chatId = ctx.chat.id.toString();
    const chatTitle = ctx.chat.title || "Personal Board";
    let user = ctx.state.user;
    if (!user && ctx.from) {
      // Fallback: ensure user exists even if middleware failed.
      user = await userRepo.upsert(ctx.from.id, {
        username: ctx.from.username || null,
        firstName: ctx.from.first_name || ctx.from.username || "Unknown",
      });
      ctx.state.user = user;
    }
    if (!user) throw new Error("Missing user in ctx.state");
    
    // Get topic ID (message_thread_id) if it's a forum group
    const topicId = ctx.message?.message_thread_id || ctx.callbackQuery?.message?.message_thread_id;

    return boardRepo.getOrCreateForChat(chatId, chatTitle, user.id, topicId);
  },

  async createBoard(name, ownerId, chatId, topicId, description) {
    const board = await boardRepo.create(name, ownerId, chatId, topicId, description);
    log.info("Board created", { boardId: board.id, name, topicId });
    return boardRepo.findById(board.id);
  },

  async getLists(boardId) {
    return listRepo.findByBoardId(boardId);
  },

  async getDefaultList(boardId) {
    return listRepo.findByName(boardId, "To Do");
  },

  async getDoneList(boardId) {
    return listRepo.findByName(boardId, "Done");
  },

  async getListByName(boardId, name) {
    return listRepo.findByFuzzyName(boardId, name);
  },
};

module.exports = boardService;
