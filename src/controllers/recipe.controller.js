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
      .populate("authorId", "firstName lastName username isProfessional profileImage");

    // Enrich with per-user isLiked / isSaved flags
    let likedSet = new Set();
    let savedSet = new Set();
    if (req.user) {
      const recipeIds = recipes.map((r) => r._id);
      const [userLikes, userSaves] = await Promise.all([
        Like.find({ userId: req.user.userId, recipeId: { $in: recipeIds } }).select("recipeId"),
        Save.find({ userId: req.user.userId, recipeId: { $in: recipeIds } }).select("recipeId"),
      ]);
      likedSet = new Set(userLikes.map((l) => l.recipeId.toString()));
      savedSet = new Set(userSaves.map((s) => s.recipeId.toString()));
    }

    const enriched = recipes.map((r) => ({
      ...r.toObject(),
      isLiked: likedSet.has(r._id.toString()),
      isSaved: savedSet.has(r._id.toString()),
    }));

    return successResponse(
      res,
      200,
      enriched,
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

    // Enrich with per-user isLiked / isSaved flags
    let likedSet = new Set();
    let savedSet = new Set();
    if (req.user) {
      const recipeIds = recipes.map((r) => r._id);
      const [userLikes, userSaves] = await Promise.all([
        Like.find({ userId: req.user.userId, recipeId: { $in: recipeIds } }).select("recipeId"),
        Save.find({ userId: req.user.userId, recipeId: { $in: recipeIds } }).select("recipeId"),
      ]);
      likedSet = new Set(userLikes.map((l) => l.recipeId.toString()));
      savedSet = new Set(userSaves.map((s) => s.recipeId.toString()));
    }

    const enriched = recipes.map((r) => ({
      ...r.toObject(),
      isLiked: likedSet.has(r._id.toString()),
      isSaved: savedSet.has(r._id.toString()),
    }));

    return successResponse(res, 200, enriched, null, "Recipes by user");
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
    const limit = Number(req.query.limit || 20);
    const populate = "firstName lastName username isProfessional profileImage";

    // IDs to exclude from the discovery tier (private accounts)
    const privateUsers = await User.find({ isPrivate: true }).select("_id");
    const privateIds = privateUsers.map((u) => u._id.toString());

    let followingIds = [];
    if (req.user) {
      const following = await Follow.find({
        followerId: req.user.userId,
        status: "accepted",
      }).select("followingId");
      followingIds = following.map((f) => f.followingId.toString());
    }

    const ownId = req.user?.userId?.toString();

    // Tier 1 — following + own recipes
    const priorityIds = [...followingIds, ownId].filter(Boolean);
    const priorityQuery = { status: "published", authorId: { $in: priorityIds } };

    // Tier 2 — everyone else who is not private
    const excludeFromDiscovery = [...new Set([...priorityIds, ...privateIds])];
    const discoveryQuery = {
      status: "published",
      authorId: { $nin: excludeFromDiscovery },
    };

    const [followingRecipes, trendingRecipes] = await Promise.all([
      Recipe.find(priorityQuery)
        .sort("-createdAt")
        .limit(limit)
        .populate("authorId", populate),
      Recipe.find(discoveryQuery)
        .sort("-likeCount -createdAt")
        .limit(limit)
        .populate("authorId", populate),
    ]);

    // Interleave both tiers for variety
    const rawFeed = [];
    const max = Math.max(followingRecipes.length, trendingRecipes.length);
    for (let i = 0; i < max; i++) {
      if (followingRecipes[i]) rawFeed.push(followingRecipes[i]);
      if (trendingRecipes[i]) rawFeed.push(trendingRecipes[i]);
    }
    const sliced = rawFeed.slice(0, limit);

    // Enrich with per-user isLiked / isSaved flags (same as listRecipes)
    let likedSet = new Set();
    let savedSet = new Set();
    if (req.user) {
      const recipeIds = sliced.map((r) => r._id);
      const [userLikes, userSaves] = await Promise.all([
        Like.find({ userId: req.user.userId, recipeId: { $in: recipeIds } }).select("recipeId"),
        Save.find({ userId: req.user.userId, recipeId: { $in: recipeIds } }).select("recipeId"),
      ]);
      likedSet = new Set(userLikes.map((l) => l.recipeId.toString()));
      savedSet = new Set(userSaves.map((s) => s.recipeId.toString()));
    }

    const feed = sliced.map((r) => ({
      ...r.toObject(),
      isLiked: likedSet.has(r._id.toString()),
      isSaved: savedSet.has(r._id.toString()),
    }));

    return successResponse(res, 200, feed, null, "Personalized feed");
  } catch (error) {
    next(error);
  }
};

const myRecipes = async (req, res, next) => {
  try {
    const recipes = await Recipe.find({ authorId: req.user.userId }).sort("-updatedAt");
    const recipeIds = recipes.map((r) => r._id);
    const [userLikes, userSaves] = await Promise.all([
      Like.find({ userId: req.user.userId, recipeId: { $in: recipeIds } }).select("recipeId"),
      Save.find({ userId: req.user.userId, recipeId: { $in: recipeIds } }).select("recipeId"),
    ]);
    const likedSet = new Set(userLikes.map((l) => l.recipeId.toString()));
    const savedSet = new Set(userSaves.map((s) => s.recipeId.toString()));
    const enriched = recipes.map((r) => ({
      ...r.toObject(),
      isLiked: likedSet.has(r._id.toString()),
      isSaved: savedSet.has(r._id.toString()),
    }));
    return successResponse(res, 200, enriched, null, "My recipes");
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

// Upload multiple final-dish gallery images (up to 5). Sets mainImage to first if not yet set.
const uploadGalleryImages = async (req, res, next) => {
  try {
    const files = req.files?.gallery || [];
    if (files.length === 0) return errorResponse(res, 400, "At least one gallery image required", "VALIDATION_ERROR");
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    if (recipe.authorId.toString() !== req.user.userId) {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    for (const file of files) {
      const result = await uploadBuffer({
        buffer: file.buffer,
        folder: `recipenest/recipes/${recipe._id}/gallery`,
      });
      recipe.galleryImages.push(result.secure_url);
      recipe.galleryImagePublicIds.push(result.public_id);
    }
    recipe.galleryImages = recipe.galleryImages.slice(0, 5);
    recipe.galleryImagePublicIds = recipe.galleryImagePublicIds.slice(0, 5);

    // Auto-set cover to first gallery image if not yet set
    if (!recipe.mainImage && recipe.galleryImages.length > 0) {
      recipe.mainImage = recipe.galleryImages[0];
      recipe.mainImagePublicId = recipe.galleryImagePublicIds[0];
    }

    await recipe.save();
    return successResponse(res, 200, recipe, null, "Gallery images uploaded");
  } catch (error) {
    next(error);
  }
};

// Set which gallery image is the cover (detail hero + feed thumbnail)
const setCoverImage = async (req, res, next) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    if (recipe.authorId.toString() !== req.user.userId) {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    const index = Number(req.body.index);
    if (Number.isNaN(index) || index < 0 || index >= recipe.galleryImages.length) {
      return errorResponse(res, 400, "Invalid gallery index", "VALIDATION_ERROR");
    }

    recipe.mainImage = recipe.galleryImages[index];
    recipe.mainImagePublicId = recipe.galleryImagePublicIds[index];
    await recipe.save();
    return successResponse(res, 200, recipe, null, "Cover image updated");
  } catch (error) {
    next(error);
  }
};

// Upload step images. stepMap (JSON array) maps file index → step array index.
// e.g. files=[img0, img1], stepMap=[0, 2] means img0→steps[0], img1→steps[2]
const uploadStepImages = async (req, res, next) => {
  try {
    const files = req.files?.steps || [];
    if (files.length === 0) return errorResponse(res, 400, "Step images required", "VALIDATION_ERROR");
    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe) return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    if (recipe.authorId.toString() !== req.user.userId) {
      return errorResponse(res, 403, "Not authorized", "FORBIDDEN");
    }

    let stepMap;
    try {
      stepMap = JSON.parse(req.body.stepMap || "[]");
    } catch {
      stepMap = files.map((_, i) => i);
    }

    for (let i = 0; i < files.length; i++) {
      const stepIndex = stepMap[i] ?? i;
      if (stepIndex < 0 || stepIndex >= recipe.steps.length) continue;
      const result = await uploadBuffer({
        buffer: files[i].buffer,
        folder: `recipenest/recipes/${recipe._id}/steps`,
      });
      recipe.steps[stepIndex].imageUrl = result.secure_url;
    }

    recipe.markModified("steps");
    await recipe.save();
    return successResponse(res, 200, recipe, null, "Step images uploaded");
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

    if (slot.startsWith("gallery_")) {
      const index = Number(slot.replace("gallery_", ""));
      if (Number.isNaN(index) || index < 0 || index >= recipe.galleryImages.length) {
        return errorResponse(res, 400, "Invalid slot", "VALIDATION_ERROR");
      }
      await deleteAsset(recipe.galleryImagePublicIds[index]);
      recipe.galleryImages.splice(index, 1);
      recipe.galleryImagePublicIds.splice(index, 1);
      // If deleted image was the cover, reset to first remaining or clear
      if (recipe.mainImage === recipe.galleryImages[index]) {
        recipe.mainImage = recipe.galleryImages[0] || "";
        recipe.mainImagePublicId = recipe.galleryImagePublicIds[0] || "";
      }
    } else if (slot.startsWith("step_")) {
      const stepIndex = Number(slot.replace("step_", ""));
      if (stepIndex >= 0 && stepIndex < recipe.steps.length) {
        recipe.steps[stepIndex].imageUrl = "";
        recipe.markModified("steps");
      }
    }

    await recipe.save();
    return successResponse(res, 200, recipe, null, "Image removed");
  } catch (error) {
    next(error);
  }
};

const archiveRecipe = async (req, res, next) => {
  try {
    const { recipeId } = req.params;
    const recipe = await Recipe.findOne({ _id: recipeId, authorId: req.user.userId });
    if (!recipe) return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");

    const isArchived = recipe.status === "archived";
    if (isArchived) {
      recipe.status = recipe.preArchiveStatus || "published";
      recipe.preArchiveStatus = "";
    } else {
      recipe.preArchiveStatus = recipe.status;
      recipe.status = "archived";
    }
    await recipe.save();
    return successResponse(res, 200, recipe, null,
      isArchived ? `Recipe restored to ${recipe.status}` : "Recipe archived"
    );
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
  uploadGalleryImages,
  setCoverImage,
  uploadStepImages,
  deleteImageSlot,
  archiveRecipe,
};
