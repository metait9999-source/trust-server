const User = require("../models/user.model");

const checkFrozen = async (req, res, next) => {
  try {
    const userId =
      req.body.userId || req.body.user_id || req.params.userId || req.params.id;

    if (!userId) return next();

    const user = await User.getById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.is_frozen) {
      return res.status(403).json({
        error: "Account is frozen. Please contact support.",
        frozen: true,
      });
    }

    next();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = checkFrozen;
