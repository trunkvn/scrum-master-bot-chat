const cardRepo = require("../db/card.repo");
const listRepo = require("../db/list.repo");
const userRepo = require("../db/user.repo");
const labelRepo = require("../db/label.repo");
const boardService = require("./board.service");
const prisma = require("../db/prisma");
const { createLogger } = require("../utils/logger");

const log = createLogger("card-service");

const cardService = {
  /**
   * Create a new card from AI-parsed data
   */
  async createCard(boardId, data) {
    // Determine which list to put the card in
    let listId;
    if (data.target_list) {
      const list = await listRepo.findByFuzzyName(boardId, data.target_list);
      listId = list?.id;
    }
    if (!listId) {
      const todoList = await boardService.getDefaultList(boardId);
      listId = todoList.id;
    }

    // Resolve assignee
    let assigneeId = data.assignee_id || null;
    if (data.target_user) {
      const user = await userRepo.findByUsername(data.target_user);
      if (user) {
        assigneeId = user.id;
      } else {
        // If target_user was specified but NOT found, we keep it null 
        // (to allow caller to show a warning) and don't fall back to sender.
        assigneeId = null;
      }
    }

    // Parse deadline
    let dueDate = null;
    if (data.deadline) {
      const { parseViDate } = require("../utils/formatter");
      dueDate = parseViDate(data.deadline);
    }

    // Generate per-board displayId
    const maxDisplayId = await cardRepo.findMaxDisplayId(boardId);
    const displayId = maxDisplayId + 1;

    const card = await cardRepo.create({
      title: data.card_title,
      description: data.description || null,
      priority: data.priority || "medium",
      dueDate,
      displayId,
      listId,
      assigneeId,
    });

    log.info("Card created", { cardId: card.id, title: card.title });
    return card;
  },

  /**
   * Move a card to a different list.
   * Supports both card ID and fuzzy title search.
   */
  async moveCard(boardId, data) {
    let card;

    // Find card by displayId or internal ID
    if (data.card_id) {
      card = await cardRepo.findByDisplayId(boardId, data.card_id);
    } else if (data.internal_card_id) {
      card = await cardRepo.findById(data.internal_card_id);
    }

    // Fallback: search by title
    if (!card && data.card_title) {
      const results = await cardRepo.search(boardId, data.card_title);
      if (results.length === 1) {
        card = results[0];
      } else if (results.length > 1) {
        // Return multiple matches for user to pick
        return { ambiguous: true, matches: results };
      }
    }

    if (!card) return { notFound: true };

    // Authorization check: only the assignee can transition the card.
    if (data.sender_id && card.assigneeId && card.assigneeId !== data.sender_id) {
       return { unauthorized: true, assigneeName: card.assignee.firstName, card };
    }

    // Find target list
    const targetList = await listRepo.findByFuzzyName(
      boardId,
      data.target_list || "Done",
    );
    if (!targetList) return { listNotFound: true };

    const updated = await cardRepo.moveToList(card.id, targetList.id);
    log.info("Card moved", {
      cardId: card.id,
      to: targetList.name,
    });
    return { card: updated, listName: targetList.name };
  },

  /**
   * Bulk move cards by IDs (fast path for batch operations).
   * Returns which IDs were found/moved and which were missing.
   */
  async moveCards(boardId, data) {
    const ids = Array.from(new Set((data.card_ids || []).filter((n) => Number.isFinite(n) && n > 0)));
    if (ids.length === 0) return { movedIds: [], notFoundIds: [], listName: null };

    const targetList = await listRepo.findByFuzzyName(boardId, data.target_list || "Done");
    if (!targetList) return { listNotFound: true };

    const foundCards = data.is_internal
      ? await prisma.card.findMany({ where: { id: { in: ids } }, select: { id: true, displayId: true } })
      : await prisma.card.findMany({ where: { displayId: { in: ids }, list: { boardId } }, select: { id: true, displayId: true } });

    const foundIds = foundCards.map(c => c.id);
    const processedDisplayIds = foundCards.map(c => c.displayId || c.id);
    const foundInputIds = data.is_internal ? foundIds : processedDisplayIds;
    
    const foundSet = new Set(foundInputIds);
    const notFoundIds = ids.filter((id) => !foundSet.has(id));

    await cardRepo.moveManyToList(foundIds, targetList.id);
    log.info("Cards moved (bulk)", { count: foundIds.length, to: targetList.name });
    return { movedIds: foundInputIds, notFoundIds, listName: targetList.name };
  },

  /**
   * Assign a card to a user
   */
  async assignCard(boardId, data) {
    let card;
    if (data.card_id) {
      card = await cardRepo.findByDisplayId(boardId, data.card_id);
    } else if (data.internal_card_id) {
      card = await cardRepo.findById(data.internal_card_id);
    } else if (data.card_title) {
      const results = await cardRepo.search(boardId, data.card_title);
      if (results.length === 1) card = results[0];
      else if (results.length > 1) return { ambiguous: true, matches: results };
    }
    if (!card) return { notFound: true };

    const user = await userRepo.findByUsername(data.target_user);
    if (!user) return { userNotFound: true, username: data.target_user };

    const updated = await cardRepo.assign(card.id, user.id);
    return { card: updated };
  },

  /**
   * Set deadline for a card
   */
  async setDeadline(boardId, data) {
    let card;
    if (data.card_id) {
      card = await cardRepo.findByDisplayId(boardId, data.card_id);
    } else if (data.internal_card_id) {
      card = await cardRepo.findById(data.internal_card_id);
    } else if (data.card_title) {
      const results = await cardRepo.search(boardId, data.card_title);
      if (results.length === 1) card = results[0];
    }
    if (!card) return { notFound: true };

    const { parseViDate } = require("../utils/formatter");
    const dueDate = parseViDate(data.deadline);
    if (!dueDate) return { invalidDate: true };

    const updated = await cardRepo.setDueDate(card.id, dueDate);
    return { card: updated };
  },

  async getMyCards(userId, filter = "active") {
    return cardRepo.findByAssignee(userId, filter);
  },

  async getBoardCards(boardId) {
    return cardRepo.findByBoard(boardId);
  },

  async searchCards(boardId, query) {
    return cardRepo.search(boardId, query);
  },

  async getCardById(cardId) {
    return cardRepo.findById(cardId);
  },

  async getCardByDisplayId(boardId, displayId) {
    return cardRepo.findByDisplayId(boardId, displayId);
  },

  async deleteCard(cardId) {
    return cardRepo.delete(cardId);
  },

  async deleteCards(boardId, cardIds, isInternal = false) {
    const ids = Array.from(new Set((cardIds || []).filter((n) => Number.isFinite(n) && n > 0)));
    if (ids.length === 0) return { deletedIds: [], notFoundIds: [] };
    
    // If boardId is null or missing but we have internal IDs, we can still delete.
    const foundIds = isInternal
      ? await cardRepo.findIdsByIds(ids)
      : await cardRepo.findIdsByDisplayIds(boardId, ids);
      
    const foundSet = new Set(foundIds);
    const notFoundIds = ids.filter((id) => !foundSet.has(id));
    await cardRepo.deleteMany(foundIds);
    log.info("Cards deleted (bulk)", { count: foundIds.length });
    return { deletedIds: foundIds, notFoundIds };
  },
};

module.exports = cardService;
