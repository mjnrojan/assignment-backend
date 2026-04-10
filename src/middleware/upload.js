const multer = require("multer");

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ["image/jpeg", "image/png", "image/webp"];
    if (!allowed.includes(file.mimetype)) {
      const error = new Error("Invalid file type");
      error.statusCode = 400;
      error.code = "INVALID_FILE_TYPE";
      return cb(error);
    }
    return cb(null, true);
  },
});

const recipeImageUpload = upload.fields([
  { name: "hero", maxCount: 1 },
  { name: "steps", maxCount: 5 },
  { name: "result", maxCount: 1 },
]);

const avatarUpload = upload.fields([{ name: "avatar", maxCount: 1 }]);

module.exports = {
  recipeImageUpload,
  avatarUpload,
};
