const db = require("../config/db.config");

async function create(data) {
  const [result] = await db.query("INSERT INTO loans SET ?", data);
  return result.insertId;
}

async function getByUserId(userId) {
  const [rows] = await db.query(
    `SELECT l.*, p.period_days, p.interest_rate AS package_rate
     FROM loans l
     JOIN loan_packages p ON l.package_id = p.id
     WHERE l.user_id = ?
     ORDER BY l.created_at DESC`,
    [userId],
  );
  return rows;
}

async function getById(id) {
  const [rows] = await db.query(
    `SELECT l.*, p.period_days
     FROM loans l
     JOIN loan_packages p ON l.package_id = p.id
     WHERE l.id = ?`,
    [id],
  );
  return rows[0];
}

async function getAll({ status, search, page = 1, limit = 25 } = {}) {
  const offset = (page - 1) * limit;
  const where = [];
  const params = [];

  if (status && status !== "all") {
    where.push("l.status = ?");
    params.push(status);
  }
  if (search) {
    where.push(
      "(u.name LIKE ? OR u.uuid LIKE ? OR l.full_name LIKE ? OR l.phone LIKE ?)",
    );
    const s = `%${search}%`;
    params.push(s, s, s, s);
  }

  const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await db.query(
    `SELECT l.*, u.name AS user_name, u.uuid AS user_uuid
     FROM loans l
     JOIN meta_ct_user u ON l.user_id = u.id
     ${whereClause}
     ORDER BY l.created_at DESC
     LIMIT ? OFFSET ?`,
    [...params, limit, offset],
  );

  const [[{ total }]] = await db.query(
    `SELECT COUNT(*) AS total FROM loans l
     JOIN meta_ct_user u ON l.user_id = u.id
     ${whereClause}`,
    params,
  );

  return {
    loans: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

// Approve — credit loan amount to user USDT balance
async function approve(id) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Get loan
    const [rows] = await conn.query(
      'SELECT * FROM loans WHERE id = ? AND status = "pending" LIMIT 1',
      [id],
    );
    const loan = rows[0];
    if (!loan) throw new Error("Loan not found or already processed");

    // 2. Get USDT coin_id
    const [walletRows] = await conn.query(
      `SELECT coin_id FROM meta_ct_wallets WHERE coin_symbol = 'USDT' LIMIT 1`,
    );
    const usdtCoinId = walletRows[0]?.coin_id;
    if (!usdtCoinId) throw new Error("USDT wallet not configured");

    // 3. Check if user has balance row — create if not
    const [balRows] = await conn.query(
      "SELECT * FROM meta_ct_user_balance_meta WHERE user_id = ? AND coin_id = ? LIMIT 1",
      [loan.user_id, usdtCoinId],
    );

    if (balRows.length === 0) {
      await conn.query(
        "INSERT INTO meta_ct_user_balance_meta (user_id, coin_id, coin_amount, usd_amount) VALUES (?, ?, 0, 0)",
        [loan.user_id, usdtCoinId],
      );
    }

    // 4. Credit loan amount to user balance
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount + ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ? LIMIT 1`,
      [loan.loan_amount, loan.user_id, usdtCoinId],
    );

    // 5. Update loan status
    await conn.query(
      'UPDATE loans SET status = "approved", updated_at = NOW() WHERE id = ?',
      [id],
    );

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function reject(id, rejectReason) {
  const [result] = await db.query(
    'UPDATE loans SET status = "rejected", reject_reason = ?, updated_at = NOW() WHERE id = ? AND status = "pending"',
    [rejectReason || "No reason provided", id],
  );
  if (!result.affectedRows)
    throw new Error("Loan not found or already processed");
  return true;
}

async function remove(id) {
  const [result] = await db.query("DELETE FROM loans WHERE id = ?", [id]);
  return result.affectedRows;
}

module.exports = {
  create,
  getByUserId,
  getById,
  getAll,
  approve,
  reject,
  remove,
};
