const packageModel = require("../models/arbitragePackage.model");
const subscriptionModel = require("../models/arbitrageSubscription.model");

// ── Admin: Package Management ─────────────────────────────────

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
      daily_rate_min,
      daily_rate_max,
      min_amount,
      max_amount,
    } = req.body;
    if (!name || !duration_days || !daily_rate_min || !daily_rate_max) {
      return res
        .status(400)
        .json({
          error:
            "name, duration_days, daily_rate_min, daily_rate_max are required",
        });
    }
    const id = await packageModel.create({
      name,
      duration_days,
      daily_rate_min,
      daily_rate_max,
      min_amount,
      max_amount,
    });
    res.status(201).json({ id, message: "Package created successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.updatePackage = async (req, res) => {
  try {
    const affected = await packageModel.update(req.params.id, req.body);
    if (!affected) return res.status(404).json({ error: "Package not found" });
    res.json({ message: "Package updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.deletePackage = async (req, res) => {
  try {
    const affected = await packageModel.remove(req.params.id);
    if (!affected) return res.status(404).json({ error: "Package not found" });
    res.json({ message: "Package deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Subscription Overview ─────────────────────────────

exports.getAllSubscriptionsAdmin = async (req, res) => {
  try {
    const subs = await subscriptionModel.getAll();
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── User: Get Active Packages ─────────────────────────────────

exports.getAllPackages = async (req, res) => {
  try {
    const packages = await packageModel.getAll();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── User: Subscribe ───────────────────────────────────────────

exports.subscribe = async (req, res) => {
  try {
    const { userId, packageId, coinId, amount } = req.body;
    if (!userId || !packageId || !coinId || !amount) {
      return res
        .status(400)
        .json({ error: "userId, packageId, coinId, amount are required" });
    }
    const id = await subscriptionModel.subscribe(
      userId,
      packageId,
      coinId,
      parseFloat(amount),
    );
    res.status(201).json({ id, message: "Subscribed successfully" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── User: Get My Subscriptions ────────────────────────────────

exports.getUserSubscriptions = async (req, res) => {
  try {
    const subs = await subscriptionModel.getByUserId(req.params.userId);
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── User: Cancel Subscription ─────────────────────────────────

exports.cancelSubscription = async (req, res) => {
  try {
    const { subscriptionId, userId } = req.body;
    if (!subscriptionId || !userId) {
      return res
        .status(400)
        .json({ error: "subscriptionId and userId are required" });
    }
    await subscriptionModel.cancel(subscriptionId, userId);
    res.json({
      message: "Subscription cancelled and principal returned to balance",
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};
