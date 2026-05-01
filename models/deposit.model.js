const db = require("../config/db.config");

class Deposit {
  static async getAll() {
    try {
      const query = `
        SELECT d.*, u.uuid AS user_uuid, w.coin_name
        FROM meta_ct_deposits AS d
        JOIN meta_ct_user AS u ON d.user_id = u.id
        JOIN meta_ct_wallets AS w ON d.coin_id = w.coin_id
      `;
      const [rows] = await db.query(query);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  static async getById(id) {
    const [rows] = await db.query(
      "SELECT * FROM meta_ct_deposits WHERE id = ?",
      [id],
    );
    return rows[0];
  }

  static async create(depositData) {
    const [result] = await db.query(
      "INSERT INTO meta_ct_deposits SET ?",
      depositData,
    );
    return result.insertId;
  }

  static async update(id, depositData) {
    const connection = await db.getConnection();
    try {
      await connection.beginTransaction();

      const [result] = await connection.query(
        "UPDATE meta_ct_deposits SET ? WHERE id = ?",
        [depositData, id],
      );

      if (result.affectedRows > 0 && depositData.status === "approved") {
        const [updatedDeposit] = await connection.query(
          "SELECT user_id, coin_id, amount FROM meta_ct_deposits WHERE id = ?",
          [id],
        );

        if (updatedDeposit.length > 0) {
          const { user_id, coin_id, amount } = updatedDeposit[0];
          const updatingAmount = parseFloat(amount);

          await connection.query(
            "UPDATE meta_ct_user_balance_meta SET coin_amount = coin_amount + ? WHERE user_id = ? AND coin_id = ?",
            [updatingAmount, user_id, coin_id],
          );

          await connection.query(
            "UPDATE meta_ct_user SET trade_limit = ? WHERE id = ?",
            [50, user_id],
          );
        }
      }

      await connection.commit();
      return result.affectedRows;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  static async delete(id) {
    const [result] = await db.query(
      "DELETE FROM meta_ct_deposits WHERE id = ?",
      [id],
    );
    return result.affectedRows;
  }

  static async getLatestDepositByUserIdAndCoinId(userId, coinId) {
    const query = `
      SELECT * FROM meta_ct_deposits
      WHERE user_id = ? AND coin_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `;
    try {
      const [rows] = await db.query(query, [userId, coinId]);
      return rows[0];
    } catch (error) {
      throw new Error(error.message);
    }
  }

  static async getLatestDepositByUserId(userId) {
    const query = `
      SELECT d.*, w.coin_name, w.coin_symbol
      FROM meta_ct_deposits AS d
      JOIN meta_ct_wallets AS w ON d.coin_id = w.coin_id
      WHERE d.user_id = ?
      ORDER BY d.created_at DESC
    `;
    try {
      const [rows] = await db.query(query, [userId]);
      return rows;
    } catch (error) {
      throw new Error(error.message);
    }
  }

  // NEW
  static async getUnseenCount() {
    const [rows] = await db.query(
      "SELECT COUNT(*) AS count FROM meta_ct_deposits WHERE is_seen = 0",
    );
    return rows[0].count;
  }

  // NEW
  static async markAllSeen() {
    await db.query("UPDATE meta_ct_deposits SET is_seen = 1 WHERE is_seen = 0");
  }
}

module.exports = Deposit;
