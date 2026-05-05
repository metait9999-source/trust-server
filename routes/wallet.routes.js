const express = require("express");
const router = express.Router();
const walletController = require("../controllers/wallet.controller");
const walletUpload = require("../middlewares/walletMiddleware");

// Route to get all wallets
router.get("/", walletController.getAllWallets);
router.get("/:id", walletController.getWalletById);
router.get("/user/:userId", walletController.getAllWalletsWithUserBalance);
router.post("/", walletUpload, walletController.createWallet);
router.put("/:id", walletUpload, walletController.updateWallet);
router.delete("/:id", walletController.deleteWallet);

module.exports = router;
