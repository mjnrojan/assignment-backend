const mongoose = require("mongoose");
const dotenv = require("dotenv");
const { uploadUrl } = require("../src/services/cloudinary.service");
require("../src/models/recipe.model");

dotenv.config();

const Recipe = mongoose.model("Recipe");
const DB_URL = process.env.DB_URL;

// High quality fallback food images from Unsplash
const FALLBACKS = [
  "https://images.unsplash.com/photo-1546069901-ba9599a7e63c", // Salad
  "https://images.unsplash.com/photo-1567620905732-2d1ec7bb7445", // Pancake
  "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38", // Pizza/Italian
  "https://images.unsplash.com/photo-1482049016688-2d3e1b311543", // Toast/Breakfast
  "https://images.unsplash.com/photo-1504674900247-0877df9cc836", // General Food
];

async function migrate() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(DB_URL);
    console.log("Connected.");

    const recipes = await Recipe.find({
      mainImage: { $exists: true, $ne: "" },
      $or: [
        { mainImagePublicId: { $exists: false } },
        { mainImagePublicId: "" }
      ]
    });

    console.log(`Found ${recipes.length} recipes to migrate images for.`);

    for (let i = 0; i < recipes.length; i++) {
      const recipe = recipes[i];
      console.log(`[${i + 1}/${recipes.length}] Migrating: ${recipe.title}`);

      try {
        const result = await uploadUrl({
          url: recipe.mainImage,
          folder: "recipenest/recipes",
        });

        recipe.mainImage = result.secure_url;
        recipe.mainImagePublicId = result.public_id;
        await recipe.save();
        console.log("   ✅ Success");
      } catch (err) {
        console.warn(`   ⚠️  Failed to migrate original image. Using high-quality fallback.`);
        try {
          const fallbackUrl = FALLBACKS[Math.floor(Math.random() * FALLBACKS.length)];
          const result = await uploadUrl({
            url: fallbackUrl,
            folder: "recipenest/recipes",
          });
          recipe.mainImage = result.secure_url;
          recipe.mainImagePublicId = result.public_id;
          await recipe.save();
          console.log("   ✅ Fallback applied");
        } catch (fError) {
          console.error("   ❌ Even fallback failed!");
        }
      }
    }

    console.log("Migration complete!");
    process.exit(0);
  } catch (err) {
    console.error("Migration fatal error:", err);
    process.exit(1);
  }
}

migrate();
