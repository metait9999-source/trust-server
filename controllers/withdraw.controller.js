const Withdraw = require("../models/withdraw.model");
const { getReceiverSocketId, io } = require("../socket/socket");

exports.getAllWithdrawals = async (req, res) => {
  try {
    const withdrawals = await Withdraw.getAll();
    res.json(withdrawals);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getWithdrawalById = async (req, res) => {
  try {
    const withdrawal = await Withdraw.getById(req.params.id);
    if (!withdrawal)
      return res.status(404).json({ error: "Withdrawal not found" });
    res.json(withdrawal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getWithdrawalByUserId = async (req, res) => {
  try {
    const withdrawal = await Withdraw.getByUserId(req.params.userID);
    if (!withdrawal)
      return res.status(404).json({ error: "Withdrawal not found" });
    res.json(withdrawal);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createWithdrawal = async (req, res) => {
  try {
    const newWithdrawalId = await Withdraw.create(req.body);

    if (newWithdrawalId) {
      const unseenCount = await Withdraw.getUnseenCount();

      const receiverSocketId = getReceiverSocketId(0);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newWithdraw", {
          id: newWithdrawalId,
          ...req.body,
          unseenCount,
        });
      }
    }

    res.status(201).json({ id: newWithdrawalId, ...req.body });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateWithdrawal = async (req, res) => {
  try {
    const affectedRows = await Withdraw.update(req.params.id, req.body);
    if (affectedRows === 0)
      return res.status(404).json({ error: "Withdrawal not found" });

    const withdraw = await Withdraw.getById(req.params.id);
    const receiverSocketId = getReceiverSocketId(withdraw.user_id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("updateWithdraw", { withdraw });
    }

    res.json({ message: "Withdrawal updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteWithdrawal = async (req, res) => {
  try {
    const affectedRows = await Withdraw.delete(req.params.id);
    if (affectedRows === 0)
      return res.status(404).json({ error: "Withdrawal not found" });
    res.json({ message: "Withdrawal deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NEW
exports.getUnseenCount = async (req, res) => {
  try {
    const count = await Withdraw.getUnseenCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NEW
exports.markAllSeen = async (req, res) => {
  try {
    await Withdraw.markAllSeen();
    res.json({ message: "All withdrawals marked as seen" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
