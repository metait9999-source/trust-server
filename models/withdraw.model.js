// models/withdraw.model.js
const db = require("../config/db.config");

class Withdraw {
  // Get all withdrawals
  static async getAll() {
    try {
      const query = `
        SELECT d.*, u.uuid AS user_uuid, u.employee, w.coin_name
        FROM meta_ct_withdraws AS d
        JOIN meta_ct_user AS u ON d.user_id = u.id
        JOIN meta_ct_wallets AS w ON d.coin_id = w.coin_id
      `;
      const [rows] = await db.query(query);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Get a withdrawal by ID
  static async getById(id) {
    const [rows] = await db.query(
      "SELECT * FROM meta_ct_withdraws WHERE id = ?",
      [id],
    );
    return rows[0];
  }

  // Get a withdrawal by userID
  static async getByUserId(id) {
    const query = `
      SELECT w.*, mw.coin_name, mw.coin_symbol
      FROM meta_ct_withdraws AS w
      JOIN meta_ct_wallets AS mw ON w.coin_id = mw.coin_id
      WHERE w.user_id = ?
      ORDER BY w.created_at DESC
    `;

    try {
      const [rows] = await db.query(query, [id]);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // Create a new withdrawal
  static async create(withdrawData) {
    const [result] = await db.query(
      "INSERT INTO meta_ct_withdraws SET ?",
      withdrawData,
    );
    return result.insertId;
  }

  // Update a withdrawal by ID
  static async update(id, withdrawData) {
    const [result] = await db.query(
      "UPDATE meta_ct_withdraws SET ? WHERE id = ?",
      [withdrawData, id],
    );
    return result.affectedRows;
  }

  // Delete a withdrawal by ID
  static async delete(id) {
    const [result] = await db.query(
      "DELETE FROM meta_ct_withdraws WHERE id = ?",
      [id],
    );
    return result.affectedRows;
  }
}

module.exports = Withdraw;
