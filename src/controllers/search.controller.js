const Recipe = require("../models/recipe.model");
const User = require("../models/user.model");
const Category = require("../models/category.model");
const { successResponse } = require("../utils/apiResponse");

const search = async (req, res, next) => {
  try {
    const q = (req.query.q || "").trim();
    const type = req.query.type || "all";
    if (!q) {
      return successResponse(res, 200, [], null, "Search results");
    }

    let results = [];
    if (type === "recipe" || type === "all") {
      const recipes = await Recipe.find({
        status: "published",
        $text: { $search: q },
      })
        .select("title slug description ingredients mainImage authorId")
        .populate("authorId", "firstName lastName username");

      results = results.concat(recipes.map((r) => ({ type: "recipe", item: r })));
    }

    if (type === "user" || type === "all") {
      const users = await User.find({
        $or: [
          { firstName: { $regex: q, $options: "i" } },
          { lastName: { $regex: q, $options: "i" } },
          { username: { $regex: q, $options: "i" } },
        ],
      }).select("firstName lastName username isProfessional profileImage");

      const userResults = users.map((u) => ({
        type: "user",
        item: {
          userId: u._id,
          name: `${u.firstName} ${u.lastName}`.trim(),
          username: u.username,
          isProfessional: u.isProfessional,
          profileImage: u.profileImage || "",
        },
      }));
      results = results.concat(userResults);
    }

    return successResponse(res, 200, results, null, "Search results");
  } catch (error) {
    next(error);
  }
};

const listCategories = async (req, res, next) => {
  try {
    const categories = await Category.find().lean();
    
    // Build tree
    const categoryMap = {};
    categories.forEach(cat => {
      categoryMap[cat._id] = { ...cat, children: [] };
    });
    
    const tree = [];
    categories.forEach(cat => {
      if (cat.parentId && categoryMap[cat.parentId]) {
        categoryMap[cat.parentId].children.push(categoryMap[cat._id]);
      } else {
        tree.push(categoryMap[cat._id]);
      }
    });
    
    return successResponse(res, 200, tree, null, "Category tree");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  search,
  listCategories,
};
