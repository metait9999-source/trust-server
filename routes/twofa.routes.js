const express = require("express");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const router = express.Router();

// ── Use same db import pattern as user.model.js ──
const db = require("../config").db;

// ─────────────────────────────────────────────
// GET /api/2fa/generate/:user_id
// ─────────────────────────────────────────────
router.get("/generate/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const [rows] = await db.query(
      "SELECT twofa_secret, twofa_connected FROM meta_ct_user WHERE id = ?",
      [user_id],
    );

    if (!rows.length)
      return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    let secret = user.twofa_secret;

    // Generate new secret only if not already created
    if (!secret) {
      const generated = speakeasy.generateSecret({
        name: `YourAppName (${user_id})`,
        length: 20,
      });
      secret = generated.base32;

      await db.query("UPDATE meta_ct_user SET twofa_secret = ? WHERE id = ?", [
        secret,
        user_id,
      ]);
    }

    const otpauthUrl = speakeasy.otpauthURL({
      secret,
      label: `user_${user_id}`,
      issuer: "YourAppName",
      encoding: "base32",
    });

    const qrCode = await QRCode.toDataURL(otpauthUrl);

    res.json({
      qrCode,
      secret,
      connected: user.twofa_connected === 1,
    });
  } catch (err) {
    console.error("2FA generate error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/2fa/connect
// Body: { user_id }
// ─────────────────────────────────────────────
router.post("/connect", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: "user_id required" });

    await db.query("UPDATE meta_ct_user SET twofa_connected = 1 WHERE id = ?", [
      user_id,
    ]);

    res.json({ message: "2FA connected successfully" });
  } catch (err) {
    console.error("2FA connect error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/2fa/disconnect
// Body: { user_id }
// ─────────────────────────────────────────────
router.post("/disconnect", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: "user_id required" });

    await db.query(
      "UPDATE meta_ct_user SET twofa_secret = NULL, twofa_connected = 0 WHERE id = ?",
      [user_id],
    );

    res.json({ message: "2FA disconnected" });
  } catch (err) {
    console.error("2FA disconnect error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
