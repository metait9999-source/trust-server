const db = require("../config/db.config");

async function subscribe(userId, packageId, coinId, amount) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1. Validate package
    const [pkgRows] = await conn.query(
      "SELECT * FROM arbitrage_packages WHERE id = ? AND status = 1",
      [packageId],
    );
    const pkg = pkgRows[0];
    if (!pkg) throw new Error("Package not found or inactive");

    // 2. Parse all DB values to float
    const minAmount = parseFloat(pkg.min_amount);
    const maxAmount = parseFloat(pkg.max_amount);
    const rateMin = parseFloat(pkg.daily_rate_min);
    const rateMax = parseFloat(pkg.daily_rate_max);

    // 3. Validate amount range
    if (amount < minAmount || amount > maxAmount) {
      throw new Error(`Amount must be between ${minAmount} and ${maxAmount}`);
    }

    // 4. Check user balance
    const [balRows] = await conn.query(
      "SELECT * FROM meta_ct_user_balance_meta WHERE user_id = ? AND coin_id = ? LIMIT 1",
      [userId, coinId],
    );

    if (balRows.length === 0) {
      await conn.query(
        "INSERT INTO meta_ct_user_balance_meta (user_id, coin_id, coin_amount, usd_amount) VALUES (?, ?, 0, 0)",
        [userId, coinId],
      );
      throw new Error("Insufficient balance");
    }

    const currentBalance = parseFloat(balRows[0].coin_amount);
    if (currentBalance < amount) {
      throw new Error(`Insufficient balance. Available: ${currentBalance}`);
    }

    // 5. Deduct principal from user balance
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount - ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ? LIMIT 1`,
      [amount, userId, coinId],
    );

    // 6. Pick random daily rate within package range
    const dailyRate = (Math.random() * (rateMax - rateMin) + rateMin).toFixed(
      2,
    );

    // 7. Calculate end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + pkg.duration_days);

    // 8. Create subscription record
    const [result] = await conn.query(
      `INSERT INTO arbitrage_subscriptions
         (user_id, package_id, coin_id, amount, daily_rate, end_date)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [userId, packageId, coinId, amount, dailyRate, endDate],
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
  try {
    const [rows] = await db.query(
      `SELECT s.*, p.name AS package_name, p.duration_days
       FROM arbitrage_subscriptions s
       JOIN arbitrage_packages p ON s.package_id = p.id
       WHERE s.user_id = ?
       ORDER BY s.created_at DESC`,
      [userId],
    );
    return rows;
  } catch (error) {
    throw new Error(error.message);
  }
}

async function getAll() {
  try {
    const [rows] = await db.query(
      `SELECT s.*, p.name AS package_name, p.duration_days,
              u.name AS user_name, u.uuid AS user_uuid
       FROM arbitrage_subscriptions s
       JOIN arbitrage_packages p ON s.package_id = p.id
       JOIN meta_ct_user u ON s.user_id = u.id
       ORDER BY s.created_at DESC`,
    );
    return rows;
  } catch (error) {
    throw new Error(error.message);
  }
}

async function getActiveDue() {
  try {
    const [rows] = await db.query(
      `SELECT s.*, p.duration_days
       FROM arbitrage_subscriptions s
       JOIN arbitrage_packages p ON s.package_id = p.id
       WHERE s.status = 'active'
         AND (s.last_paid_at IS NULL OR DATE(s.last_paid_at) < CURDATE())
         AND s.end_date > NOW()`,
    );
    return rows;
  } catch (error) {
    throw new Error(error.message);
  }
}

async function processPayout(subscriptionId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM arbitrage_subscriptions WHERE id = ? AND status = "active" LIMIT 1',
      [subscriptionId],
    );
    const sub = rows[0];
    if (!sub) throw new Error("Subscription not found or inactive");

    const isComplete = new Date() >= new Date(sub.end_date);

    // Parse to float before math
    const principal = parseFloat(sub.amount);
    const dailyRate = parseFloat(sub.daily_rate);
    const interest = ((principal * dailyRate) / 100).toFixed(7);

    // 1. Credit daily interest to user balance
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount + ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ? LIMIT 1`,
      [interest, sub.user_id, sub.coin_id],
    );

    // 2. Log interest payout
    await conn.query(
      `INSERT INTO arbitrage_payouts (subscription_id, user_id, coin_id, amount, type)
       VALUES (?, ?, ?, ?, 'interest')`,
      [sub.id, sub.user_id, sub.coin_id, interest],
    );

    // 3. Update total_earned on subscription
    await conn.query(
      `UPDATE arbitrage_subscriptions
       SET total_earned = total_earned + ?
       WHERE id = ?`,
      [interest, sub.id],
    );

    // 4. On completion — return original principal
    if (isComplete) {
      await conn.query(
        `UPDATE meta_ct_user_balance_meta
         SET coin_amount = coin_amount + ?, updated_at = NOW()
         WHERE user_id = ? AND coin_id = ? LIMIT 1`,
        [principal, sub.user_id, sub.coin_id],
      );

      await conn.query(
        `INSERT INTO arbitrage_payouts (subscription_id, user_id, coin_id, amount, type)
         VALUES (?, ?, ?, ?, 'principal')`,
        [sub.id, sub.user_id, sub.coin_id, principal],
      );
    }

    // 5. Update subscription status and last_paid_at
    await conn.query(
      `UPDATE arbitrage_subscriptions
       SET last_paid_at = NOW(),
           status = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [isComplete ? "completed" : "active", sub.id],
    );

    await conn.commit();
    return { interest, principal: isComplete ? principal : 0, isComplete };
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
      'SELECT * FROM arbitrage_subscriptions WHERE id = ? AND user_id = ? AND status = "active" LIMIT 1',
      [subscriptionId, userId],
    );
    const sub = rows[0];
    if (!sub) throw new Error("Active subscription not found");

    const principal = parseFloat(sub.amount);

    // Return principal to user balance
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount + ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ? LIMIT 1`,
      [principal, sub.user_id, sub.coin_id],
    );

    // Log principal return
    await conn.query(
      `INSERT INTO arbitrage_payouts (subscription_id, user_id, coin_id, amount, type)
       VALUES (?, ?, ?, ?, 'principal')`,
      [sub.id, sub.user_id, sub.coin_id, principal],
    );

    // Mark as cancelled
    await conn.query(
      `UPDATE arbitrage_subscriptions
       SET status = 'cancelled', updated_at = NOW()
       WHERE id = ?`,
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

module.exports = {
  subscribe,
  getByUserId,
  getAll,
  getActiveDue,
  processPayout,
  cancel,
};
