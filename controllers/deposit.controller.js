const Deposit = require("../models/deposit.model");
const { getReceiverSocketId, io } = require("../socket/socket");

exports.getAllDeposits = async (req, res) => {
  try {
    const deposits = await Deposit.getAll();
    res.json(deposits);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getDepositById = async (req, res) => {
  try {
    const deposit = await Deposit.getById(req.params.id);
    if (!deposit) return res.status(404).json({ error: "Deposit not found" });
    res.json(deposit);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createDeposit = async (req, res) => {
  const depositData = {
    user_id: req.body.user_id,
    wallet_to: req.body.wallet_to,
    wallet_from: req.body.wallet_from,
    coin_id: req.body.coin_id,
    trans_hash: req.body.trans_hash,
    amount: req.body.amount,
    documents: req.file ? req.file.path : null,
  };

  try {
    const newDepositId = await Deposit.create(depositData);

    if (newDepositId) {
      // NEW: get fresh unseen count after insert
      const unseenCount = await Deposit.getUnseenCount();

      const receiverSocketId = getReceiverSocketId(0);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newDeposit", {
          id: newDepositId,
          ...depositData,
          unseenCount, // NEW: send total count
        });
      }
    }

    res.status(201).json({ id: newDepositId, ...depositData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.updateDeposit = async (req, res) => {
  try {
    const affectedRows = await Deposit.update(req.params.id, req.body);
    if (affectedRows === 0)
      return res.status(404).json({ error: "Deposit not found" });

    const deposit = await Deposit.getById(req.params.id);
    const receiverSocketId = getReceiverSocketId(deposit.user_id);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("updateDeposit", { deposit });
    }

    res.json({ message: "Deposit updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteDeposit = async (req, res) => {
  try {
    const affectedRows = await Deposit.delete(req.params.id);
    if (affectedRows === 0)
      return res.status(404).json({ error: "Deposit not found" });
    res.json({ message: "Deposit deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getLatestDepositByUserIdAndCoinId = async (req, res) => {
  const { userId, coinId } = req.params;
  try {
    const latestDeposit = await Deposit.getLatestDepositByUserIdAndCoinId(
      userId,
      coinId,
    );
    if (latestDeposit) {
      res.status(200).json(latestDeposit);
    } else {
      res
        .status(404)
        .json({
          message: "No deposit found for the given User ID and Coin ID",
        });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLatestDepositByUserId = async (req, res) => {
  const { userId } = req.params;
  try {
    const latestDeposit = await Deposit.getLatestDepositByUserId(userId);
    if (latestDeposit) {
      res.status(200).json(latestDeposit);
    } else {
      res
        .status(404)
        .json({ message: "No deposit found for the given User ID" });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// NEW
exports.getUnseenCount = async (req, res) => {
  try {
    const count = await Deposit.getUnseenCount();
    res.json({ count });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// NEW
exports.markAllSeen = async (req, res) => {
  try {
    await Deposit.markAllSeen();
    res.json({ message: "All deposits marked as seen" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
