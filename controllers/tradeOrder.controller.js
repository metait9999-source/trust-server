const schedule = require("node-schedule");
const tradeOrderModel = require("../models/tradeOrder.model");
const userBalanceMetaModel = require("../models/userBalanceMeta.model");
const { getReceiverSocketId, io } = require("../socket/socket");

exports.getAllTradeOrders = async (req, res) => {
  try {
    const tradeOrders = await tradeOrderModel.getAllTradeOrders();
    res.status(200).json(tradeOrders);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTradeOrderById = async (req, res) => {
  try {
    const tradeOrder = await tradeOrderModel.getTradeOrderById(req.params.id);
    if (tradeOrder) res.status(200).json(tradeOrder);
    else res.status(404).json({ message: "Trade order not found" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

function parseDeliveryTime(deliveryTime) {
  const timeUnit = deliveryTime.slice(-1).toUpperCase();
  const timeValue = parseInt(deliveryTime.slice(0, -1), 10);

  const map = {
    S: 1000,
    M: 60 * 1000,
    H: 60 * 60 * 1000,
    D: 24 * 60 * 60 * 1000,
    W: 7 * 24 * 60 * 60 * 1000,
    Y: 365 * 24 * 60 * 60 * 1000,
  };

  if (!map[timeUnit]) throw new Error("Invalid delivery time format");
  return timeValue * map[timeUnit];
}

exports.createTradeOrder = async (req, res) => {
  const tradeOrderData = req.body;

  console.log("=== CREATE TRADE ===");
  console.log(
    "is_profit:",
    tradeOrderData.is_profit,
    typeof tradeOrderData.is_profit,
  );
  console.log("amount:", tradeOrderData.amount);
  console.log("====================");

  try {
    const newTradeOrderId =
      await tradeOrderModel.createTradeOrder(tradeOrderData);

    const deliveryTimeInMs = parseDeliveryTime(tradeOrderData.delivery_time);
    const updateTime = new Date(Date.now() + deliveryTimeInMs);

    schedule.scheduleJob(updateTime, async () => {
      try {
        await tradeOrderModel.updateTradeOrderStatus(
          newTradeOrderId,
          "finished",
        );

        const tradeOrder =
          await tradeOrderModel.getTradeOrderById(newTradeOrderId);

        const principal = parseFloat(tradeOrder.amount);
        const profitAmount = parseFloat(tradeOrder.profit_amount);

        // ✅ == handles string "1", number 1, Buffer from MySQL
        const isProfit = tradeOrder.is_profit == 1;

        console.log("=== TRADE SETTLE ===");
        console.log("id:", newTradeOrderId);
        console.log(
          "is_profit:",
          tradeOrder.is_profit,
          typeof tradeOrder.is_profit,
        );
        console.log("isProfit:", isProfit);
        console.log("principal:", principal);
        console.log("profitAmount:", profitAmount);
        console.log("====================");

        let payout;
        if (isProfit) {
          payout = principal + profitAmount;
          console.log("PROFIT → payout:", payout);
        } else {
          payout = Math.max(0, principal - profitAmount);
          console.log("LOSS → payout:", payout);
        }

        await userBalanceMetaModel.updateUserBalance(
          tradeOrder.user_id,
          tradeOrder.wallet_coin_id,
          payout,
        );

        const receiverSocketId = getReceiverSocketId(0);
        if (receiverSocketId) {
          io.to(receiverSocketId).emit("updateTradeStatus", { tradeOrder });
        }
      } catch (error) {
        console.error(
          `Failed to settle trade ${newTradeOrderId}:`,
          error.message,
        );
      }
    });

    if (newTradeOrderId) {
      const receiverSocketId = getReceiverSocketId(0);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("newTradeOrder", {
          id: newTradeOrderId,
          ...tradeOrderData,
        });
      }
    }

    res.status(201).json({ id: newTradeOrderId, ...tradeOrderData });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTradeOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const affectedRows = await tradeOrderModel.updateTradeOrder(id, req.body);
    if (affectedRows > 0) res.status(200).json({ id, ...req.body });
    else res.status(404).json({ message: "Trade order not found" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTradeOrder = async (req, res) => {
  const { id } = req.params;
  try {
    const affectedRows = await tradeOrderModel.deleteTradeOrder(id);
    if (affectedRows > 0)
      res.status(200).json({ message: "Trade order deleted successfully" });
    else res.status(404).json({ message: "Trade order not found" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTradeOrdersByUserId = async (req, res) => {
  const { userId } = req.params;
  const { status } = req.query;
  try {
    const tradeOrders = await tradeOrderModel.getTradeOrderByUserId(
      userId,
      status,
    );
    if (tradeOrders.length > 0) res.status(200).json(tradeOrders);
    else
      res.status(404).json({ message: "No trade orders found for this user" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
