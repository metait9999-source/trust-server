// message.mode.js file
const db = require("../config/db.config");

class Message {
  // Create a new message
  static async createMessage(messageData) {
    const insertQuery = `
    INSERT INTO messages 
      (conversation_id, sender_id, anonymous_sender_id, message_text, message_image, seen, sender_type, faq_options)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;

    const selectQuery = `SELECT * FROM messages WHERE id = ?`;

    try {
      const [insertResult] = await db.query(insertQuery, [
        messageData.conversation_id,
        messageData.sender_id || null,
        messageData.anonymous_sender_id || null,
        messageData.message_text,
        messageData.message_image || null,
        messageData.seen || 0,
        messageData.sender_type || "user",
        messageData.faq_options || null, // ✅ new field
      ]);

      const [rows] = await db.query(selectQuery, [insertResult.insertId]);
      return rows[0];
    } catch (error) {
      console.log(error);
      throw new Error(error.message);
    }
  }

  // Get all messages for a conversation with seen status
  static async getMessagesByConversationId(conversation_id, user_id) {
    const query = `
      SELECT m.*, 
             IF(m.sender_id = ?, 'sent', 'received') AS direction
      FROM messages AS m
      WHERE m.conversation_id = ?
      ORDER BY m.created_at ASC
    `;

    try {
      const [rows] = await db.query(query, [user_id, conversation_id]);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Mark all messages as seen in a conversation
  static async markMessagesAsSeen(conversation_id, user_id) {
    const query = `
      UPDATE messages 
      SET seen = 1 
      WHERE conversation_id = ? AND sender_id != ?
    `;

    try {
      await db.query(query, [conversation_id, user_id]);
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Get the last message of a conversation
  static async getLastMessageByConversationId(conversation_id) {
    const query = `
      SELECT * 
      FROM messages 
      WHERE conversation_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;

    try {
      const [rows] = await db.query(query, [conversation_id]);
      return rows[0];
    } catch (error) {
      throw new Error(error.message);
    }
  }

  //get the count of unread messages by user and conversation
  static async getUnreadMessagesCount(conversation_id) {
    const query = `
    SELECT COUNT(*) AS unread_count
    FROM messages
    WHERE conversation_id = ? AND sender_type != 'admin' AND seen = 0
  `;

    try {
      const [rows] = await db.query(query, [conversation_id]);
      return rows[0].unread_count;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Get total unread conversations for a user
  static async getUnreadConversationsCount() {
    const query = `
    SELECT COUNT(DISTINCT conversation_id) AS unread_conversations
    FROM messages
    WHERE seen = 0 AND sender_type != 'admin'
  `;

    try {
      const [rows] = await db.query(query);
      return rows[0].unread_conversations;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  static async deleteByConversationId(conversationId) {
    const query = `DELETE FROM messages WHERE conversation_id = ?`;
    return db.query(query, [conversationId]);
  }
}

module.exports = Message;
