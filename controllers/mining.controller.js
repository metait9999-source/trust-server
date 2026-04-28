const packageModel = require("../models/miningPackage.model");
const subscriptionModel = require("../models/miningSubscription.model");

// ── User ──────────────────────────────────────────────────────

exports.getAllPackages = async (req, res) => {
  try {
    const packages = await packageModel.getAll();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.subscribe = async (req, res) => {
  try {
    const { userId, packageId, quantity } = req.body;
    if (!userId || !packageId) {
      return res
        .status(400)
        .json({ error: "userId and packageId are required" });
    }
    const id = await subscriptionModel.subscribe(
      userId,
      packageId,
      parseInt(quantity) || 1,
    );
    res.status(201).json({ id, message: "Mining subscription created" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

exports.getUserSubscriptions = async (req, res) => {
  try {
    const subs = await subscriptionModel.getByUserId(req.params.userId);
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId, userId } = req.body;
    if (!subscriptionId || !userId) {
      return res
        .status(400)
        .json({ error: "subscriptionId and userId are required" });
    }
    await subscriptionModel.cancel(subscriptionId, userId);
    res.json({ message: "Subscription cancelled and principal returned" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── Admin ─────────────────────────────────────────────────────

exports.getAllPackagesAdmin = async (req, res) => {
  try {
    const packages = await packageModel.getAllForAdmin();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.createPackage = async (req, res) => {
  try {
    const {
      name,
      duration_days,
      daily_rate,
      rent_amount,
      computing,
      power,
      color,
      stars,
    } = req.body;
    if (!name || !duration_days || !daily_rate || !rent_amount) {
      return res
        .status(400)
        .json({
          error: "name, duration_days, daily_rate, rent_amount are required",
        });
    }
    const id = await packageModel.create({
      name,
      duration_days,
      daily_rate,
      rent_amount,
      computing,
      power,
      color,
      stars,
    });
    res.status(201).json({ id, message: "Package created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const affected = await packageModel.update(req.params.id, req.body);
    if (!affected) return res.status(404).json({ error: "Package not found" });
    res.json({ message: "Package updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const affected = await packageModel.remove(req.params.id);
    if (!affected) return res.status(404).json({ error: "Package not found" });
    res.json({ message: "Package deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getAllSubscriptionsAdmin = async (req, res) => {
  try {
    const subs = await subscriptionModel.getAll();
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.runPayoutManually = async (req, res) => {
  try {
    const dueSubs = await subscriptionModel.getActiveDue();
    if (dueSubs.length === 0) {
      return res.json({ message: "No subscriptions due", processed: 0 });
    }
    const results = [];
    for (const sub of dueSubs) {
      try {
        const { interest, principal, isComplete } =
          await subscriptionModel.processPayout(sub.id);
        results.push({
          subscription_id: sub.id,
          user_id: sub.user_id,
          interest_paid: interest,
          principal_returned: isComplete ? principal : 0,
          status: isComplete ? "completed" : "active",
          success: true,
        });
      } catch (err) {
        results.push({
          subscription_id: sub.id,
          success: false,
          error: err.message,
        });
      }
    }
    res.json({
      message: "Payout complete",
      processed: results.length,
      results,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
