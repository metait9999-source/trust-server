const router = require("express").Router();
const ctrl = require("../controllers/arbitrage.controller");

router.get("/packages", ctrl.getAllPackages);
router.post("/subscribe", ctrl.subscribe);
router.get("/subscriptions/:userId", ctrl.getUserSubscriptions);
router.post("/cancel", ctrl.cancelSubscription);

router.get("/admin/packages", ctrl.getAllPackagesAdmin);
router.post("/admin/packages", ctrl.createPackage);
router.put("/admin/packages/:id", ctrl.updatePackage);
router.delete("/admin/packages/:id", ctrl.deletePackage);
router.get("/admin/subscriptions", ctrl.getAllSubscriptionsAdmin);

module.exports = router;
