const Recipe = require("../models/recipe.model");
const Follow = require("../models/follow.model");
const User = require("../models/user.model");
const View = require("../models/view.model");
const Like = require("../models/like.model");
const Save = require("../models/save.model");
const { uploadBuffer, deleteAsset } = require("../services/cloudinary.service");
const { notifyFollowers } = require("../services/notification.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");

const listRecipes = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;
    const sortMap = { date: "-createdAt", cookTime: "cookTime", difficulty: "difficulty", popular: "-likeCount" };
    const sort = sortMap[req.query.sort] || "-createdAt";

    const query = { status: "published" };
    if (req.query.cuisine) query.cuisineType = req.query.cuisine;
    if (req.query.difficulty) query.difficulty = req.query.difficulty;
    
    if (req.query.category) {
      const Category = require("../models/category.model");
      const targetCategory = await Category.findById(req.query.category);
      if (targetCategory) {
        // Find all subcategories recursively (simple 2-level for now)
        const subCats = await Category.find({ parentId: targetCategory._id });
        const catIds = [targetCategory._id, ...subCats.map(c => c._id)];
        
        // Check for deeper nesting (grandchildren)
        if (subCats.length > 0) {
          const grandSubCats = await Category.find({ parentId: { $in: subCats.map(c => c._id) } });
          const grandIds = grandSubCats.map(c => c._id);
          catIds.push(...grandIds);
        }
        
        query.categoryId = { $in: catIds };
      }
    }
    
    if (req.query.q) query.$text = { $search: req.query.q };

    // Exclude recipes from private accounts unless the requester follows them
    if (req.user) {
      const following = await Follow.find({
        followerId: req.user.userId,
        status: "accepted",
      }).select("followingId");
      const followingIds = following.map((f) => f.followingId);

      // Include public accounts + private accounts the user follows + own recipes
      const privateUsers = await User.find({ isPrivate: true }).select("_id");
      const privateIds = privateUsers.map((u) => u._id);
      const blockedIds = privateIds.filter(
        (id) => !followingIds.some((fId) => fId.equals(id)) && id.toString() !== req.user.userId
      );

      if (blockedIds.length > 0) {
        query.authorId = { $nin: blockedIds };
      }
    } else {
      // Unauthenticated users only see public account recipes
      const privateUsers = await User.find({ isPrivate: true }).select("_id");
      const privateIds = privateUsers.map((u) => u._id);
      if (privateIds.length > 0) {
        query.authorId = { $nin: privateIds };
      }
    }

    const total = await Recipe.countDocuments(query);
    const recipes = await Recipe.find(query)
      .sort(sort)
      .skip(skip)
      .limit(limit)
      .populate("authorId", "firstName lastName username isProfessional");

    return successResponse(
      res,
      200,
      recipes,
      { page, limit, total, pages: Math.ceil(total / limit) },
      "Recipes list"
    );
  } catch (error) {
    next(error);
  }
};

const getRecipeById = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId)
      .populate("authorId", "firstName lastName username isProfessional isPrivate");

    if (!recipe || recipe.status !== "published") {
      return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    }

    // Privacy check: if author is private, only followers can view
    if (recipe.authorId && recipe.authorId.isPrivate) {
      if (!req.user) {
        return errorResponse(res, 403, "This account is private", "PRIVATE_ACCOUNT");
      }
      const isOwner = req.user.userId === recipe.authorId._id.toString();
      if (!isOwner) {
        const follow = await Follow.findOne({
          followerId: req.user.userId,
          followingId: recipe.authorId._id,
          status: "accepted",
        });
        
        if (!follow) {
          return errorResponse(res, 403, "This account is private", "PRIVATE_ACCOUNT");
        }
      }
    }

    // Track view count
    recipe.viewCount += 1;
    await recipe.save();

    // Track unique view for professional analytics
    if (req.user) {
      const existingView = await View.findOne({
        recipeId: recipe._id,
        userId: req.user.userId,
      });
      if (!existingView) {
        await View.create({ recipeId: recipe._id, userId: req.user.userId });
      }
    }

    // Check if requester has liked/saved this recipe
    let isLiked = false;
    let isSaved = false;
    if (req.user) {
      isLiked = Boolean(await Like.findOne({ userId: req.user.userId, recipeId: recipe._id }));
      isSaved = Boolean(await Save.findOne({ userId: req.user.userId, recipeId: recipe._id }));
    }

    return successResponse(res, 200, { recipe, isLiked, isSaved }, null, "Recipe detail");
  } catch (error) {
    next(error);
  }
};

const getRecipesByUser = async (req, res, next) => {
  try {
    const targetUser = await User.findById(req.params.userId);
    if (!targetUser) {
      return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }

    // Privacy check
    if (targetUser.isPrivate) {
      const isOwner = req.user && req.user.userId === targetUser._id.toString();
      if (!isOwner) {
        const follow = req.user
          ? await Follow.findOne({
              followerId: req.user.userId,
              followingId: targetUser._id,
              status: "accepted",
            })
          : null;
        if (!follow) {
          return errorResponse(res, 403, "This account is private", "PRIVATE_ACCOUNT");
        }
      }
    }

    const recipes = await Recipe.find({
      authorId: targetUser._id,
      status: "published",
    }).sort("-createdAt");

    return successResponse(res, 200, recipes, null, "Recipes by user");
  } catch (error) {
    next(error);
  }
};

/**
 * Personalized Recommendation Engine
 * Combines "Following Feed" with "Discover Trending"
 */
const getPersonalizedFeed = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;

    let followingIds = [];
    if (req.user) {
      const following = await Follow.find({
        followerId: req.user.userId,
        status: "accepted",
      }).select("followingId");
      followingIds = following.map(f => f.followingId);
    }

    // 1. Calculate Priority Feed (Following + Own Content)
    const priorityQuery = {
      status: "published",
      authorId: { $in: [...followingIds, req.user?.userId].filter(Boolean) }
    };

    // 2. Discover Trending (Popular content not from following)
    const discoveryQuery = {
      status: "published",
      authorId: { $nin: priorityQuery.authorId },
      likeCount: { $gte: 2 } // Only show "proven" content in trending
    };

    // Exclude private accounts from the discovery query
    const privateUsers = await User.find({ isPrivate: true }).select("_id");
    const privateIds = privateUsers.map(u => u._id);
    discoveryQuery.authorId.$nin.push(...privateIds);

    // Initial load: Mix of both
    const [followingRecipes, trendingRecipes] = await Promise.all([
      Recipe.find(priorityQuery).sort("-createdAt").limit(limit).populate("authorId", "firstName lastName username"),
      Recipe.find(discoveryQuery).sort("-likeCount -createdAt").limit(limit).populate("authorId", "firstName lastName username")
    ]);

    // Simple interleaving for a dynamic feel
    const feed = [];
    const max = Math.max(followingRecipes.length, trendingRecipes.length);
    for (let i = 0; i < max; i++) {
        if (followingRecipes[i]) feed.push(followingRecipes[i]);
        if (trendingRecipes[i]) feed.push(trendingRecipes[i]);
    }

    return successResponse(res, 200, feed.slice(0, limit), null, "Personalized feed");
  } catch (error) {
    next(error);
  }
};

const myRecipes = async (req, res, next) => {
  try {
    const recipes = await Recipe.find({ authorId: req.user.userId }).sort("-updatedAt");
    return successResponse(res, 200, recipes, null, "My recipes");
  } catch (error) {
    next(error);
  }
};

const createRecipe = async (req, res, next) => {
  try {
    // 1. Double Submit Protection (Prevent accidental rapid multiple clicks)
    const { title } = req.body;
    const authorId = req.user.userId;

    const recentDuplicate = await Recipe.findOne({
      authorId,
      title,
      createdAt: { $gte: new Date(Date.now() - 15 * 1000) }, // Last 15 seconds
    });

    if (recentDuplicate) {
      return errorResponse(res, 400, "You just posted this recipe. Please wait a moment.", "DOUBLE_SUBMIT");
    }

    const payload = { ...req.body, authorId };
    const recipe = await Recipe.create(payload);

    if (recipe.status === "published") {
      notifyFollowers(authorId, recipe);
    }

    return successResponse(res, 201, recipe, null, "Recipe created");
  } catch (error) {
    next(error);
  }
};

const updateRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) {
      return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    }
    if (recipe.authorId.toString() !== req.user.userId && req.user.role !== "admin") {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    const updated = await Recipe.findByIdAndUpdate(req.params.recipeId, req.body, {
      new: true,
      runValidators: true,
    });

    if (recipe.status !== "published" && updated.status === "published") {
      notifyFollowers(req.user.userId, updated);
    }
    
    return successResponse(res, 200, updated, null, "Recipe updated");
  } catch (error) {
    next(error);
  }
};

const deleteRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) {
      return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    }
    if (recipe.authorId.toString() !== req.user.userId && req.user.role !== "admin") {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    await Recipe.findByIdAndDelete(req.params.recipeId);
    return successResponse(res, 200, null, null, "Recipe deleted");
  } catch (error) {
    next(error);
  }
};

const shareRecipe = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) {
      return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    }
    recipe.shareCount += 1;
    await recipe.save();
    const shareUrl = `${req.protocol}://${req.get("host")}/recipes/${recipe.slug || recipe._id}`;
    return successResponse(res, 200, { shareUrl }, null, "Share URL generated");
  } catch (error) {
    next(error);
  }
};

const uploadHeroImage = async (req, res, next) => {
  try {
    const file = req.files?.hero?.[0];
    if (!file) return errorResponse(res, 400, "hero image required", "VALIDATION_ERROR");
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    if (recipe.authorId.toString() !== req.user.userId) {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    const result = await uploadBuffer({
      buffer: file.buffer,
      folder: `recipenest/recipes/${recipe._id}`,
    });
    if (recipe.mainImagePublicId) await deleteAsset(recipe.mainImagePublicId);

    recipe.mainImage = result.secure_url;
    recipe.mainImagePublicId = result.public_id;
    await recipe.save();
    return successResponse(res, 200, recipe, null, "Hero image uploaded");
  } catch (error) {
    next(error);
  }
};

const uploadStepImages = async (req, res, next) => {
  try {
    const files = req.files?.steps || [];
    if (files.length === 0) return errorResponse(res, 400, "steps images required", "VALIDATION_ERROR");
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    if (recipe.authorId.toString() !== req.user.userId) {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    for (const file of files) {
      const result = await uploadBuffer({
        buffer: file.buffer,
        folder: `recipenest/recipes/${recipe._id}`,
      });
      recipe.stepImages.push(result.secure_url);
      recipe.stepImagePublicIds.push(result.public_id);
    }
    recipe.stepImages = recipe.stepImages.slice(0, 5);
    recipe.stepImagePublicIds = recipe.stepImagePublicIds.slice(0, 5);
    await recipe.save();
    return successResponse(res, 200, recipe, null, "Step images uploaded");
  } catch (error) {
    next(error);
  }
};

const uploadResultImage = async (req, res, next) => {
  try {
    const file = req.files?.result?.[0];
    if (!file) return errorResponse(res, 400, "result image required", "VALIDATION_ERROR");
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    if (recipe.authorId.toString() !== req.user.userId) {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    const result = await uploadBuffer({
      buffer: file.buffer,
      folder: `recipenest/recipes/${recipe._id}`,
    });
    if (recipe.resultImagePublicId) await deleteAsset(recipe.resultImagePublicId);

    recipe.resultImage = result.secure_url;
    recipe.resultImagePublicId = result.public_id;
    await recipe.save();
    return successResponse(res, 200, recipe, null, "Result image uploaded");
  } catch (error) {
    next(error);
  }
};

const deleteImageSlot = async (req, res, next) => {
  try {
    const { slot } = req.params;
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    if (recipe.authorId.toString() !== req.user.userId) {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    if (slot === "hero") {
      await deleteAsset(recipe.mainImagePublicId);
      recipe.mainImage = "";
      recipe.mainImagePublicId = "";
    } else if (slot === "result") {
      await deleteAsset(recipe.resultImagePublicId);
      recipe.resultImage = "";
      recipe.resultImagePublicId = "";
    } else {
      const index = Number(slot);
      if (Number.isNaN(index) || index < 0 || index >= recipe.stepImages.length) {
        return errorResponse(res, 400, "Invalid slot", "VALIDATION_ERROR");
      }
      const publicId = recipe.stepImagePublicIds[index];
      await deleteAsset(publicId);
      recipe.stepImages.splice(index, 1);
      recipe.stepImagePublicIds.splice(index, 1);
    }

    await recipe.save();
    return successResponse(res, 200, recipe, null, "Image removed");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listRecipes,
  getRecipeById,
  getRecipesByUser,
  getPersonalizedFeed,
  myRecipes,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  shareRecipe,
  uploadHeroImage,
  uploadStepImages,
  uploadResultImage,
  deleteImageSlot,
};
