const express = require("express");
const router = express.Router();
const tradeOrderController = require("../controllers/tradeOrder.controller");
const checkFrozen = require("../middlewares/checkFrozen");

router.get("/", tradeOrderController.getAllTradeOrders);
router.get("/:id", tradeOrderController.getTradeOrderById);
router.post("/", checkFrozen, tradeOrderController.createTradeOrder);
router.put("/:id", tradeOrderController.updateTradeOrder);
router.delete("/:id", tradeOrderController.deleteTradeOrder);
router.get("/user/:userId", tradeOrderController.getTradeOrdersByUserId);
module.exports = router;
