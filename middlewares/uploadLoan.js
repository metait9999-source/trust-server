const multer = require("multer");
const path = require("path");
const fs = require("fs");

const uploadDir = path.join(process.cwd(), "uploads");
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
  const allowed = /jpeg|jpg|png|webp/;
  const ext = allowed.test(path.extname(file.originalname).toLowerCase());
  const mime = allowed.test(file.mimetype);
  if (ext && mime) cb(null, true);
  else cb(new Error("Only images allowed"));
};

const multerUpload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

// Wrap to fix file paths
const uploadLoan = (req, res, next) => {
  multerUpload.fields([
    { name: "credit_front", maxCount: 1 },
    { name: "credit_back", maxCount: 1 },
    { name: "id_card", maxCount: 1 },
  ])(req, res, (err) => {
    if (err) return next(err);
    if (req.files) {
      Object.keys(req.files).forEach((key) => {
        req.files[key][0].path = `uploads/${req.files[key][0].filename}`;
      });
    }
    next();
  });
};

module.exports = uploadLoan;
