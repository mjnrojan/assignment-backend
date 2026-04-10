const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");
const mongoose = require("mongoose");
const dotenv = require("dotenv");

// Load models
require("../src/models/user.model");
require("../src/models/profile.model");
require("../src/models/category.model");
require("../src/models/recipe.model");

const User = mongoose.model("RNUser");
const Profile = mongoose.model("Profile");
const Category = mongoose.model("Category");
const Recipe = mongoose.model("Recipe");

dotenv.config();

const DB_URI = process.env.DB_URL;
const DATASETS_PATH = "c:/Users/dell/Downloads/datasets";

const RECIPE_PER_FILE_LIMIT = 40; 

async function seed() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(DB_URI);
    console.log("Connected.");

    // 1. Create a set of seed authors
    console.log("Creating seed authors...");
    const authors = [
      { firstName: "Grandma", lastName: "Ople", username: "grandma_ople", email: "grandma@recipenest.com", passwordHash: "Seed123!" },
      { firstName: "Chef", lastName: "Kapoor", username: "chef_kapoor", email: "kapoor@recipenest.com", passwordHash: "Seed123!" },
      { firstName: "Gordon", lastName: "Ram", username: "gordon_ram", email: "gordon@recipenest.com", passwordHash: "Seed123!" },
      { firstName: "Food", lastName: "Blogger", username: "blogger", email: "blogger@recipenest.com", passwordHash: "Seed123!" },
    ];

    const savedAuthors = [];
    for (const a of authors) {
      let user = await User.findOne({ email: a.email });
      if (!user) {
        user = await User.create(a);
        await Profile.create({ userId: user._id });
      }
      savedAuthors.push(user);
    }

    // Helper to get/create category hierarchy
    const categoryCache = new Map();
    async function getCategoryChain(pathArr) {
      let parentId = null;
      let leafCategoryId = null;

      for (const name of pathArr) {
        if (!name || name.trim() === "") continue;
        const cleanName = name.trim();
        const key = `${cleanName}_${parentId || "root"}`;

        if (categoryCache.has(key)) {
          parentId = categoryCache.get(key);
        } else {
          let cat = await Category.findOne({ name: cleanName, parentId });
          if (!cat) {
            cat = await Category.create({ name: cleanName, parentId });
          }
          categoryCache.set(key, cat._id);
          parentId = cat._id;
        }
        leafCategoryId = parentId;
      }
      return leafCategoryId;
    }

    // Process file helper
    async function processFile(filename, rowHandler) {
      console.log(`Processing ${filename}...`);
      const fullPath = path.join(DATASETS_PATH, filename);
      if (!fs.existsSync(fullPath)) return;

      const rows = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(fullPath)
          .pipe(csv())
          .on("data", (row) => rows.push(row))
          .on("end", resolve)
          .on("error", reject);
      });

      const sample = rows.slice(0, RECIPE_PER_FILE_LIMIT);
      for (const row of sample) {
        try { await rowHandler(row); } catch (e) { /* skip */ }
      }
    }

    // A. Indian Food
    await processFile("Cleaned_Indian_Food_Dataset.csv", async (row) => {
      const catId = await getCategoryChain(["Indian", row.Cuisine || "Vegetarian"]);
      await Recipe.create({
        title: row.TranslatedRecipeName,
        authorId: savedAuthors[1]._id,
        categoryId: catId,
        cuisineType: row.Cuisine,
        difficulty: row["Ingredient-count"] > 10 ? "Hard" : "Medium",
        cookTime: parseInt(row.TotalTimeInMins) || 45,
        ingredients: (row["Cleaned-Ingredients"] || row.TranslatedIngredients || "").split(",").map(i => ({ name: i.trim() })),
        steps: (row.TranslatedInstructions || "").split("\n").filter(s => s.trim().length > 2).map((s, index) => ({ order: index + 1, instruction: s.trim() })),
        mainImage: row["image-url"],
        status: "published"
      });
    });

    // B. Global Recipes
    await processFile("recipes.csv", async (row) => {
      const pathParts = (row.cuisine_path || "/Global/").split("/").filter(p => p.length > 0).slice(0, 3);
      const catId = await getCategoryChain(pathParts);
      await Recipe.create({
        title: row.recipe_name,
        authorId: savedAuthors[0]._id,
        categoryId: catId,
        cuisineType: pathParts[0] || "Global",
        difficulty: "Medium",
        cookTime: parseInt(row.cook_time) || 30,
        ingredients: (row.ingredients || "").split(",").map(i => ({ name: i.trim() })),
        steps: (row.directions || "").split(".").filter(s => s.trim().length > 5).map((s, index) => ({ order: index + 1, instruction: s.trim() })),
        mainImage: row.img_src,
        status: "published"
      });
    });

    // C. Cocktails
    await processFile("final_cocktails.csv", async (row) => {
      const catId = await getCategoryChain(["Drinks", row.alcoholic || "Soft Drink", row.category || "General"]);
      let ings = [];
      try { ings = JSON.parse(row.ingredients.replace(/'/g, '"')); } catch (e) { ings = (row.ingredients || "").split(",").map(i => i.trim().replace(/[\[\]']/g, "")); }
      
      await Recipe.create({
        title: row.name,
        description: `Served in a ${row.glassType}.`,
        authorId: savedAuthors[2]._id,
        categoryId: catId,
        cuisineType: "Drinks",
        cookTime: 5,
        ingredients: ings.map(name => ({ name })),
        steps: (row.instructions || "").split(".").filter(s => s.trim().length > 5).map((s, index) => ({ order: index + 1, instruction: s.trim() })),
        mainImage: row.drinkThumbnail,
        status: "published"
      });
    });

    console.log("Seeding complete!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seed();
