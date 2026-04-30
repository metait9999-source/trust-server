const db = require("../config/db.config");

class ChatFaq {
  // Get all root questions (parent_id = NULL)
  static async getRootFaqs() {
    const [rows] = await db.query(
      "SELECT * FROM chat_faqs WHERE parent_id IS NULL AND status = 1 ORDER BY order_num ASC",
    );
    return rows;
  }

  // Get children of a question
  static async getChildFaqs(parentId) {
    const [rows] = await db.query(
      "SELECT * FROM chat_faqs WHERE parent_id = ? AND status = 1 ORDER BY order_num ASC",
      [parentId],
    );
    return rows;
  }

  // Get all FAQs (admin)
  static async getAll() {
    const [rows] = await db.query(
      `SELECT f.*, p.question AS parent_question
       FROM chat_faqs f
       LEFT JOIN chat_faqs p ON f.parent_id = p.id
       ORDER BY f.parent_id IS NULL DESC, f.parent_id ASC, f.order_num ASC`,
    );
    return rows;
  }

  // Get by ID
  static async getById(id) {
    const [rows] = await db.query("SELECT * FROM chat_faqs WHERE id = ?", [id]);
    return rows[0];
  }

  // Create
  static async create(data) {
    const [result] = await db.query("INSERT INTO chat_faqs SET ?", data);
    return result.insertId;
  }

  // Update
  static async update(id, data) {
    const [result] = await db.query("UPDATE chat_faqs SET ? WHERE id = ?", [
      data,
      id,
    ]);
    return result.affectedRows;
  }

  // Delete
  static async delete(id) {
    const [result] = await db.query("DELETE FROM chat_faqs WHERE id = ?", [id]);
    return result.affectedRows;
  }

  // Get FAQ by ID with its children
  static async getFaqWithChildren(id) {
    const faq = await ChatFaq.getById(id);
    const children = await ChatFaq.getChildFaqs(id);
    return { ...faq, children };
  }
}

module.exports = ChatFaq;
