const db = require("../config/db.config");

// Subscribe — deducts principal from user balance immediately
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

    // 2. Validate amount range
    if (
      amount < parseFloat(pkg.min_amount) ||
      amount > parseFloat(pkg.max_amount)
    ) {
      throw new Error(
        `Amount must be between ${pkg.min_amount} and ${pkg.max_amount}`,
      );
    }

    // 3. Check user balance
    const [balRows] = await conn.query(
      "SELECT * FROM meta_ct_user_balance_meta WHERE user_id = ? AND coin_id = ?",
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
      throw new Error(
        `Insufficient balance. Available: ${currentBalance} ${coinId}`,
      );
    }

    // 4. Deduct principal from user balance
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount - ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ?`,
      [amount, userId, coinId],
    );

    // 5. Pick random daily rate within package range
    const dailyRate = (
      Math.random() * (pkg.daily_rate_max - pkg.daily_rate_min) +
      pkg.daily_rate_min
    ).toFixed(2);

    // 6. Calculate end date
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + pkg.duration_days);

    // 7. Create subscription record
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

// Get all subscriptions for a user
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

// Get all subscriptions (admin)
async function getAll() {
  try {
    const [rows] = await db.query(
      `SELECT s.*, p.name AS package_name,
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

// Get active subscriptions due for payout (used by cron)
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

// Process daily payout — credits interest every day, returns principal on last day
async function processPayout(subscriptionId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM arbitrage_subscriptions WHERE id = ? AND status = "active"',
      [subscriptionId],
    );
    const sub = rows[0];
    if (!sub) throw new Error("Subscription not found or inactive");

    const isComplete = new Date() >= new Date(sub.end_date);

    // Calculate daily interest
    const interest = (
      (parseFloat(sub.amount) * parseFloat(sub.daily_rate)) /
      100
    ).toFixed(7);

    // 1. Credit daily interest to user balance
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount + ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ?`,
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

    // 4. On last day — return original principal to user balance
    if (isComplete) {
      await conn.query(
        `UPDATE meta_ct_user_balance_meta
         SET coin_amount = coin_amount + ?, updated_at = NOW()
         WHERE user_id = ? AND coin_id = ?`,
        [sub.amount, sub.user_id, sub.coin_id],
      );

      // Log principal return
      await conn.query(
        `INSERT INTO arbitrage_payouts (subscription_id, user_id, coin_id, amount, type)
         VALUES (?, ?, ?, ?, 'principal')`,
        [sub.id, sub.user_id, sub.coin_id, sub.amount],
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
    return { interest, principal: isComplete ? sub.amount : 0, isComplete };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
}

// Cancel a subscription — returns principal if cancelled early
async function cancel(subscriptionId, userId) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      'SELECT * FROM arbitrage_subscriptions WHERE id = ? AND user_id = ? AND status = "active"',
      [subscriptionId, userId],
    );
    const sub = rows[0];
    if (!sub) throw new Error("Active subscription not found");

    // Return principal to user balance on cancellation
    await conn.query(
      `UPDATE meta_ct_user_balance_meta
       SET coin_amount = coin_amount + ?, updated_at = NOW()
       WHERE user_id = ? AND coin_id = ?`,
      [sub.amount, sub.user_id, sub.coin_id],
    );

    // Log principal return
    await conn.query(
      `INSERT INTO arbitrage_payouts (subscription_id, user_id, coin_id, amount, type)
       VALUES (?, ?, ?, ?, 'principal')`,
      [sub.id, sub.user_id, sub.coin_id, sub.amount],
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
