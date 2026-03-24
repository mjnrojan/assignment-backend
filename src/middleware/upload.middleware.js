const multer = require("multer");
const fs = require("fs");
const path = require("path");

const UPLOADS_ROOT = path.join(__dirname, "../../uploads");
const AVATAR_DIR = path.join(UPLOADS_ROOT, "avatars");

fs.mkdirSync(AVATAR_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const base = path.basename(file.originalname, ext).replace(/\s+/g, "-");
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, `${base}-${unique}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/jpg", "image/png"];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    const err = new Error("Invalid file type. Only JPEG and PNG are allowed");
    err.statusCode = 400;
    cb(err);
  }
};

const limits = {
  fileSize: 2 * 1024 * 1024,
};

const avatarUpload = multer({ storage, fileFilter, limits }).fields([
  { name: "avatar", maxCount: 1 },
  { name: "Avatar", maxCount: 1 },
]);

const avatarUploadMiddleware = (req, res, next) => {
  avatarUpload(req, res, (err) => {
    if (err) {
      if (err.code === "LIMIT_FILE_SIZE") {
        const sizeErr = new Error("File too large. Max size is 2MB");
        sizeErr.statusCode = 413;
        return next(sizeErr);
      }
      return next(err);
    }
    if (req.files && req.files.avatar && req.files.avatar[0]) {
      req.file = req.files.avatar[0];
    } else if (req.files && req.files.Avatar && req.files.Avatar[0]) {
      req.file = req.files.Avatar[0];
    }
    next();
  });
};

module.exports = {
  avatarUploadMiddleware,
  UPLOADS_ROOT,
  AVATAR_DIR,
};
