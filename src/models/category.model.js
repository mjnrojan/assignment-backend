const mongoose = require("mongoose");
const slugify = require("../utils/slugify");

const CategorySchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, trim: true },
    parentId: { type: mongoose.Schema.Types.ObjectId, ref: "Category", default: null },
  },
  { timestamps: false }
);

// Unique constraint on name + parentId to allow same subcategory name under different parents
CategorySchema.index({ name: 1, parentId: 1 }, { unique: true });

CategorySchema.pre("save", function saveSlug() {
  if (this.isModified("name")) {
    this.slug = slugify(this.name);
  }
});

module.exports = mongoose.models.Category || mongoose.model("Category", CategorySchema);
