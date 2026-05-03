const express = require("express");
const depositController = require("../controllers/deposit.controller");
const uploadMiddleware = require("../middlewares/uploadMiddleware");
const checkFrozen = require("../middlewares/checkFrozen");

const router = express.Router();

router.get("/", depositController.getAllDeposits);
router.get("/unseen-count", depositController.getUnseenCount);
router.get("/:id", depositController.getDepositById);
router.post(
  "/",
  uploadMiddleware,
  checkFrozen,
  depositController.createDeposit,
);
router.put("/mark-seen", depositController.markAllSeen);
router.put("/:id", depositController.updateDeposit);
router.delete("/:id", depositController.deleteDeposit);
router.get(
  "/latest/:userId/coin/:coinId",
  depositController.getLatestDepositByUserIdAndCoinId,
);
router.get("/user/:userId", depositController.getLatestDepositByUserId);

module.exports = router;
