const express = require("express");
const userController = require("../controllers/user.controller");
const router = express.Router();

router.get("/", userController.getAllUsers);
router.get("/:id", userController.getUserById);
router.get("/wallet/:walletID", userController.getUserByWalletId);
router.post("/create", userController.createUserByWallet);
router.post("/set-passcode", userController.setPasscode);
router.post("/verify-passcode", userController.verifyPasscode);
// router.post('/', userController.createUser);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);
router.post("/signup", userController.signUpUser);
router.post("/login", userController.loginUser);

module.exports = router;
