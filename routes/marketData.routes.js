const express = require("express");
const marketDataController = require("../controllers/marketData.controller");
const checkFrozen = require("../middlewares/checkFrozen");
const router = express.Router();

router.get("/forex", marketDataController.getForexData);
router.get("/forex/:coin", marketDataController.getForexDataByCoin);
router.get("/metal", marketDataController.getMetalData);
router.get("/metal/:coin", marketDataController.getMetalDataByCoin);
router.post("/converter", checkFrozen, marketDataController.convertCurrency);

module.exports = router;
