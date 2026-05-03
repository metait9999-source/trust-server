const router = require("express").Router();
const ctrl = require("../controllers/mining.controller");
const checkFrozen = require("../middlewares/checkFrozen");

router.get("/packages", ctrl.getAllPackages);
router.post("/subscribe", checkFrozen, ctrl.subscribe);
router.get("/subscriptions/:userId", ctrl.getUserSubscriptions);
router.post("/cancel", checkFrozen, ctrl.cancelSubscription);

router.get("/admin/packages", ctrl.getAllPackagesAdmin);
router.post("/admin/packages", ctrl.createPackage);
router.put("/admin/packages/:id", ctrl.updatePackage);
router.delete("/admin/packages/:id", ctrl.deletePackage);
router.get("/admin/subscriptions", ctrl.getAllSubscriptionsAdmin);
router.post("/admin/run-payout", ctrl.runPayoutManually);

module.exports = router;
