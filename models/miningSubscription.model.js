const db = require("../config/db.config");

async function subscribe(userId, packageId, quantity) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Validate package
    const [pkgRows] = await conn.query(
      "SELECT * FROM mining_packages WHERE id = ? AND status = 1",
      [packageId],
    );
    const pkg = pkgRows[0];
    if (!pkg) throw new Error("Package not found or inactive");

    const totalCost = parseFloat(pkg.rent_amount) * quantity;

    // 2. Check USDT balance (mining always uses USDT)
    const [balRows] = await conn.query(
      `SELECT * FROM meta_ct_user_balance_meta
       WHERE user_id = ? AND coin_id = (
         SELECT coin_id FROM meta_ct_wallets WHERE coin_symbol = 'USDT' LIMIT 1
       )`,
      [userId],
    );

    if (
      balRows.length === 0 ||
      parseFloat(balRows[0].coin_amount) < totalCost
    ) {
      throw new Error(`Insufficient USDT balance. Required: ${totalCost}`);
    }

    const usdtCoinId = balRows[0].coin_id;

    // 3. Deduct USDT balance
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount - ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ?`,
      [totalCost, userId, usdtCoinId],
    );

    // 4. Calculate end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + pkg.duration_days);

    // 5. Create subscription
    const [result] = await conn.query(
      `INSERT INTO mining_subscriptions
         (user_id, package_id, quantity, rent_amount, daily_rate, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, packageId, quantity, totalCost, pkg.daily_rate, endDate],
    );

    await conn.commit();
    return result.insertId;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function getByUserId(userId) {
  const [rows] = await db.query(
    `SELECT s.*, p.name AS package_name, p.duration_days,
            p.computing, p.power, p.color
     FROM mining_subscriptions s
     JOIN mining_packages p ON s.package_id = p.id
     WHERE s.user_id = ?
     ORDER BY s.created_at DESC`,
    [userId],
  );
  return rows;
}

async function getAll() {
  const [rows] = await db.query(
    `SELECT s.*, p.name AS package_name, p.duration_days,
            u.name AS user_name, u.uuid AS user_uuid
     FROM mining_subscriptions s
     JOIN mining_packages p ON s.package_id = p.id
     JOIN meta_ct_user u ON s.user_id = u.id
     ORDER BY s.created_at DESC`,
  );
  return rows;
}

async function getActiveDue() {
  const [rows] = await db.query(
    `SELECT s.*, p.duration_days
     FROM mining_subscriptions s
     JOIN mining_packages p ON s.package_id = p.id
     WHERE s.status = 'active'
       AND (s.last_paid_at IS NULL OR DATE(s.last_paid_at) < CURDATE())
       AND s.end_date > NOW()`,
  );
  return rows;
}

async function processPayout(subscriptionId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM mining_subscriptions WHERE id = ? AND status = "active"',
      [subscriptionId],
    );
    const sub = rows[0];
    if (!sub) throw new Error("Subscription not found or inactive");

    const isComplete = new Date() >= new Date(sub.end_date);

    // Daily interest = rent_amount * daily_rate / 100
    const interest = (
      (parseFloat(sub.rent_amount) * parseFloat(sub.daily_rate)) /
      100
    ).toFixed(7);

    // Get USDT coin_id
    const [walletRows] = await conn.query(
      `SELECT coin_id FROM meta_ct_wallets WHERE coin_symbol = 'USDT' LIMIT 1`,
    );
    const usdtCoinId = walletRows[0]?.coin_id;
    if (!usdtCoinId) throw new Error("USDT wallet not configured");

    // Credit daily interest
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount + ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ?`,
      [interest, sub.user_id, usdtCoinId],
    );

    // Log interest payout
    await conn.query(
      `INSERT INTO mining_payouts (subscription_id, user_id, amount, type)
       VALUES (?, ?, ?, 'interest')`,
      [sub.id, sub.user_id, interest],
    );

    // Update total_earned
    await conn.query(
      `UPDATE mining_subscriptions SET total_earned = total_earned + ? WHERE id = ?`,
      [interest, sub.id],
    );

    // On completion — return principal
    if (isComplete) {
      await conn.query(
        `UPDATE meta_ct_user_balance_meta
         SET coin_amount = coin_amount + ?, updated_at = NOW()
         WHERE user_id = ? AND coin_id = ?`,
        [sub.rent_amount, sub.user_id, usdtCoinId],
      );

      await conn.query(
        `INSERT INTO mining_payouts (subscription_id, user_id, amount, type)
         VALUES (?, ?, ?, 'principal')`,
        [sub.id, sub.user_id, sub.rent_amount],
      );
    }

    // Update status
    await conn.query(
      `UPDATE mining_subscriptions
       SET last_paid_at = NOW(), status = ?, updated_at = NOW()
       WHERE id = ?`,
      [isComplete ? "completed" : "active", sub.id],
    );

    await conn.commit();
    return {
      interest,
      principal: isComplete ? sub.rent_amount : 0,
      isComplete,
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

async function cancel(subscriptionId, userId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM mining_subscriptions WHERE id = ? AND user_id = ? AND status = "active"',
      [subscriptionId, userId],
    );
    const sub = rows[0];
    if (!sub) throw new Error("Active subscription not found");

    // Get USDT coin_id
    const [walletRows] = await conn.query(
      `SELECT coin_id FROM meta_ct_wallets WHERE coin_symbol = 'USDT' LIMIT 1`,
    );
    const usdtCoinId = walletRows[0]?.coin_id;

    // Return principal
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount + ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ?`,
      [sub.rent_amount, sub.user_id, usdtCoinId],
    );

    await conn.query(
      `INSERT INTO mining_payouts (subscription_id, user_id, amount, type)
       VALUES (?, ?, ?, 'principal')`,
      [sub.id, sub.user_id, sub.rent_amount],
    );

    await conn.query(
      `UPDATE mining_subscriptions SET status = 'cancelled', updated_at = NOW() WHERE id = ?`,
      [sub.id],
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

async function deleteById(id) {
  const [result] = await db.query(
    "DELETE FROM mining_subscriptions WHERE id = ?",
    [id],
  );
  return result.affectedRows;
}

module.exports = {
  subscribe,
  getByUserId,
  getAll,
  getActiveDue,
  processPayout,
  cancel,
  deleteById,
};
