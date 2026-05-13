// routes/withdraw.routes.js
const express = require("express");
const withdrawController = require("../controllers/withdraw.controller");
const checkFrozen = require("../middlewares/checkFrozen");

const router = express.Router();

router.get("/unseen-count", withdrawController.getUnseenCount);
router.put("/mark-seen", withdrawController.markAllSeen);
router.get("/", withdrawController.getAllWithdrawals);
router.get("/:id", withdrawController.getWithdrawalById);
router.get("/user/:userID", withdrawController.getWithdrawalByUserId);
router.post("/", checkFrozen, withdrawController.createWithdrawal);
router.put("/:id", withdrawController.updateWithdrawal);
router.delete("/:id", withdrawController.deleteWithdrawal);

module.exports = router;
