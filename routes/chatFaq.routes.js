const router = require("express").Router();
const ctrl = require("../controllers/chatFaq.controller");

// User routes
router.get("/root", ctrl.getRootFaqs);
router.get("/:parentId/children", ctrl.getChildren);

// Admin routes
router.get("/admin/all", ctrl.getAll);
router.post("/admin", ctrl.create);
router.put("/admin/:id", ctrl.update);
router.delete("/admin/:id", ctrl.delete);

module.exports = router;
