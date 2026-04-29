const db = require("../config/db.config");

async function getAllTradeOrders() {
  try {
    const [rows] = await db.query(`
  SELECT t.*, 
         u.uuid AS user_uuid, 
         u.employee AS asigned_employee, 
         w.coin_name AS wallet_coin_name
  FROM meta_ct_trade_order AS t
  JOIN meta_ct_user AS u ON t.user_id = u.id
  JOIN meta_ct_wallets AS w ON t.wallet_coin_id = w.coin_id
  ORDER BY t.created_at DESC
`);
    return rows;
  } catch (error) {
    throw new Error(error.message);
  }
}

// ✅ Fixed — explicitly select trade columns to avoid collision with user.is_profit
async function getTradeOrderById(id) {
  try {
    const [rows] = await db.query(
      `
      SELECT 
        t.id,
        t.user_id,
        t.wallet_coin_id,
        t.amount,
        t.profit_amount,
        t.is_profit,
        t.delivery_time,
        t.status,
        t.created_at,
        t.updated_at
      FROM meta_ct_trade_order t
      WHERE t.id = ?
    `,
      [id],
    );
    return rows[0];
  } catch (error) {
    throw new Error(error.message);
  }
}

async function getTradeOrderByUserId(userId, status) {
  try {
    let query = `
      SELECT t.*, 
             u.id AS user_id, 
             u.uuid AS user_uuid,
             w.coin_symbol AS coin_symbol,
             w.coin_name AS coin_name,
             w.coin_logo AS coin_logo
      FROM meta_ct_trade_order AS t
      JOIN meta_ct_user AS u ON t.user_id = u.id
      JOIN meta_ct_wallets AS w ON t.wallet_coin_id = w.coin_id
      WHERE t.user_id = ?
    `;
    const queryParams = [userId];
    if (status) {
      query += ` AND t.status = ?`;
      queryParams.push(status);
    }
    query += ` ORDER BY t.created_at DESC LIMIT 0, 50`;
    const [rows] = await db.query(query, queryParams);
    return rows;
  } catch (error) {
    throw new Error("Failed to retrieve trade orders");
  }
}

async function createTradeOrder(tradeOrderData) {
  try {
    const [result] = await db.query(
      "INSERT INTO meta_ct_trade_order SET ?",
      tradeOrderData,
    );
    if (result) {
      await db.query(
        "UPDATE meta_ct_user SET trade_limit = trade_limit - 1 WHERE id = ?",
        [tradeOrderData.user_id],
      );
    }
    return result.insertId;
  } catch (error) {
    throw new Error(error.message);
  }
}

async function updateTradeOrderStatus(tradeOrderId, status) {
  try {
    await db.query("UPDATE meta_ct_trade_order SET status = ? WHERE id = ?", [
      status,
      tradeOrderId,
    ]);
  } catch (error) {
    throw new Error(error.message);
  }
}

async function updateTradeOrder(id, tradeOrderData) {
  try {
    const [result] = await db.query(
      "UPDATE meta_ct_trade_order SET ? WHERE id = ?",
      [tradeOrderData, id],
    );
    return result.affectedRows;
  } catch (error) {
    throw new Error(error.message);
  }
}

async function deleteTradeOrder(id) {
  try {
    const [result] = await db.query(
      "DELETE FROM meta_ct_trade_order WHERE id = ?",
      [id],
    );
    return result.affectedRows;
  } catch (error) {
    throw new Error(error.message);
  }
}

module.exports = {
  getAllTradeOrders,
  getTradeOrderById,
  createTradeOrder,
  updateTradeOrder,
  deleteTradeOrder,
  getTradeOrderByUserId,
  updateTradeOrderStatus,
};
