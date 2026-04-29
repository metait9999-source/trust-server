// ─────────────────────────────────────────────
// STEP 1 — Run this SQL to add columns:
//
// ALTER TABLE meta_ct_user
//   ADD COLUMN twofa_secret VARCHAR(255) NULL DEFAULT NULL,
//   ADD COLUMN twofa_connected TINYINT(1) NOT NULL DEFAULT 0;
//
// STEP 2 — npm install speakeasy qrcode
//
// STEP 3 — In app.js:
//   app.use("/api/2fa", require("./routes/twofa.routes"));
// ─────────────────────────────────────────────

const express = require("express");
const speakeasy = require("speakeasy");
const QRCode = require("qrcode");
const router = express.Router();

const db = require("../config/db.config");

const query = (sql, params) =>
  new Promise((resolve, reject) => {
    db.query(sql, params, (err, results) => {
      if (err) return reject(err);
      resolve(results);
    });
  });

// ─────────────────────────────────────────────
// GET /api/2fa/generate/:user_id
// Generate (or return existing) QR code for user
// ─────────────────────────────────────────────
router.get("/generate/:user_id", async (req, res) => {
  try {
    const { user_id } = req.params;

    const rows = await query(
      "SELECT email, twofa_secret, twofa_connected FROM meta_ct_user WHERE id = ?",
      [user_id],
    );
    if (!rows.length)
      return res.status(404).json({ message: "User not found" });

    const user = rows[0];
    let secret = user.twofa_secret;

    // Generate new secret only if not already created
    if (!secret) {
      const generated = speakeasy.generateSecret({
        name: `YourAppName (${user.email || user_id})`,
        length: 20,
      });
      secret = generated.base32;
      await query("UPDATE meta_ct_user SET twofa_secret = ? WHERE id = ?", [
        secret,
        user_id,
      ]);
    }

    // Build otpauth URL for QR
    const otpauthUrl = speakeasy.otpauthURL({
      secret,
      label: user.email || `user_${user_id}`,
      issuer: "YourAppName",
      encoding: "base32",
    });

    const qrCode = await QRCode.toDataURL(otpauthUrl);

    res.json({
      qrCode, // base64 PNG
      secret, // manual entry key
      connected: user.twofa_connected === 1,
    });
  } catch (err) {
    console.error("2FA generate error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─────────────────────────────────────────────
// POST /api/2fa/connect
// Mark 2FA as connected (called once after user scans)
// Body: { user_id }
// ─────────────────────────────────────────────
router.post("/connect", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ message: "user_id required" });

    await query("UPDATE meta_ct_user SET twofa_connected = 1 WHERE id = ?", [
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
    await query(
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
