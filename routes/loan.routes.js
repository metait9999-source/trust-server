const router = require("express").Router();
const ctrl = require("../controllers/loan.controller");
const uploadLoan = require("../middlewares/uploadLoan");

// ── User routes ───────────────────────────────────────────────
router.get("/packages", ctrl.getPackages);
router.post("/", uploadLoan, ctrl.create);
router.get("/", ctrl.getMyLoans);

// ── Admin routes ──────────────────────────────────────────────
router.get("/admin/packages", ctrl.getPackagesAdmin);
router.post("/admin/packages", ctrl.createPackage);
router.put("/admin/packages/:id", ctrl.updatePackage);
router.delete("/admin/packages/:id", ctrl.deletePackage);
router.get("/admin/loans", ctrl.getAll);
router.get("/admin/loans/:id", ctrl.getById);
router.put("/admin/loans/:id/approve", ctrl.approve);
router.put("/admin/loans/:id/reject", ctrl.reject);
router.delete("/admin/loans/:id", ctrl.remove);

module.exports = router;
