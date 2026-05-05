// middlewares/walletUploadMiddleware.js
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(process.cwd(), "uploads/wallets");

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, unique + path.extname(file.originalname));
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = /jpeg|jpg|png|webp|gif/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else cb(new Error("Only image files are allowed for wallet uploads"));
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 2 * 1024 * 1024 },
});

const walletUpload = (req, res, next) => {
  multerUpload.fields([
    { name: "coin_logo", maxCount: 1 },
    { name: "wallet_qr", maxCount: 1 },
  ])(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ message: `Upload error: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ message: err.message });
    }

    // Normalize paths onto req object for easy access in controller
    if (req.files) {
      req.walletFiles = {
        coin_logo: req.files["coin_logo"]?.[0]
          ? `uploads/wallets/${req.files["coin_logo"][0].filename}`
          : null,
        wallet_qr: req.files["wallet_qr"]?.[0]
          ? `uploads/wallets/${req.files["wallet_qr"][0].filename}`
          : null,
      };
    } else {
      req.walletFiles = { coin_logo: null, wallet_qr: null };
    }

    next();
  });
};

module.exports = walletUpload;
