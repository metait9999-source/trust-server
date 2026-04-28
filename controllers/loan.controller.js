const loanModel = require("../models/loan.model");
const loanPackageModel = require("../models/loanPackage.model");

// ── User: Get active packages ─────────────────────────────────
exports.getPackages = async (req, res) => {
  try {
    const packages = await loanPackageModel.getAll();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── User: Submit loan ─────────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { user_id, package_id, full_name, home_address, phone, loan_amount } =
      req.body;

    if (
      !user_id ||
      !package_id ||
      !full_name ||
      !home_address ||
      !phone ||
      !loan_amount
    ) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (
      !req.files?.credit_front ||
      !req.files?.credit_back ||
      !req.files?.id_card
    ) {
      return res.status(400).json({ error: "All three photos are required" });
    }

    // Fetch package to get rate and validate amount
    const pkg = await loanPackageModel.getById(package_id);
    if (!pkg) return res.status(404).json({ error: "Package not found" });

    const amount = parseFloat(loan_amount);
    if (
      amount < parseFloat(pkg.min_amount) ||
      amount > parseFloat(pkg.max_amount)
    ) {
      return res.status(400).json({
        error: `Amount must be between ${pkg.min_amount} and ${pkg.max_amount}`,
      });
    }

    const interestRate = parseFloat(pkg.interest_rate);
    const totalRepay = amount * (1 + interestRate / 100);

    const loanData = {
      user_id,
      package_id,
      full_name,
      home_address,
      phone,
      loan_period: pkg.period_days,
      loan_amount: amount,
      interest_rate: interestRate,
      total_repay: totalRepay,
      credit_front: req.files.credit_front[0].path,
      credit_back: req.files.credit_back[0].path,
      id_card: req.files.id_card[0].path,
    };

    const id = await loanModel.create(loanData);
    res
      .status(201)
      .json({ id, message: "Loan application submitted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── User: Get my loans ────────────────────────────────────────
exports.getMyLoans = async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id is required" });
    const loans = await loanModel.getByUserId(user_id);
    res.json(loans);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Get all packages ───────────────────────────────────
exports.getPackagesAdmin = async (req, res) => {
  try {
    const packages = await loanPackageModel.getAllForAdmin();
    res.json(packages);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Create package ─────────────────────────────────────
exports.createPackage = async (req, res) => {
  try {
    const { period_days, interest_rate, min_amount, max_amount } = req.body;
    if (!period_days || !interest_rate) {
      return res
        .status(400)
        .json({ error: "period_days and interest_rate are required" });
    }
    const id = await loanPackageModel.create({
      period_days,
      interest_rate,
      min_amount,
      max_amount,
    });
    res.status(201).json({ id, message: "Package created" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Update package ─────────────────────────────────────
exports.updatePackage = async (req, res) => {
  try {
    const affected = await loanPackageModel.update(req.params.id, req.body);
    if (!affected) return res.status(404).json({ error: "Package not found" });
    res.json({ message: "Package updated" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Delete package ─────────────────────────────────────
exports.deletePackage = async (req, res) => {
  try {
    const affected = await loanPackageModel.remove(req.params.id);
    if (!affected) return res.status(404).json({ error: "Package not found" });
    res.json({ message: "Package deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Get all loans ──────────────────────────────────────
exports.getAll = async (req, res) => {
  try {
    const { status, search, page, limit } = req.query;
    const result = await loanModel.getAll({
      status,
      search,
      page: parseInt(page) || 1,
      limit: parseInt(limit) || 25,
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Get single loan ────────────────────────────────────
exports.getById = async (req, res) => {
  try {
    const loan = await loanModel.getById(req.params.id);
    if (!loan) return res.status(404).json({ error: "Loan not found" });
    res.json(loan);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ── Admin: Approve — credits amount to user balance ───────────
exports.approve = async (req, res) => {
  try {
    await loanModel.approve(req.params.id);
    res.json({ message: "Loan approved and amount credited to user balance" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── Admin: Reject ─────────────────────────────────────────────
exports.reject = async (req, res) => {
  try {
    const { reject_reason } = req.body;
    await loanModel.reject(req.params.id, reject_reason);
    res.json({ message: "Loan rejected" });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// ── Admin: Delete ─────────────────────────────────────────────
exports.remove = async (req, res) => {
  try {
    const affected = await loanModel.remove(req.params.id);
    if (!affected) return res.status(404).json({ error: "Loan not found" });
    res.json({ message: "Loan deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
