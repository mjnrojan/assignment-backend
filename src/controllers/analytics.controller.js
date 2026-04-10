const Recipe = require("../models/recipe.model");
const View = require("../models/view.model");
const Follow = require("../models/follow.model");
const User = require("../models/user.model");
const { successResponse, errorResponse } = require("../utils/apiResponse");

/**
 * Professional analytics — only available to users with isProfessional = true
 */

const profileAnalytics = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isProfessional) {
      return errorResponse(res, 403, "Professional mode required", "PROFESSIONAL_REQUIRED");
    }

    const totalRecipes = await Recipe.countDocuments({ authorId: req.user.userId, status: "published" });
    const recipes = await Recipe.find({ authorId: req.user.userId, status: "published" });
    const recipeIds = recipes.map((r) => r._id);

    // Total views across all recipes
    const totalViews = recipes.reduce((sum, r) => sum + r.viewCount, 0);

    // Unique viewers (distinct users who viewed any of your recipes)
    const uniqueViewers = await View.distinct("userId", { recipeId: { $in: recipeIds } });

    // Total engagement
    const totalLikes = recipes.reduce((sum, r) => sum + r.likeCount, 0);
    const totalComments = recipes.reduce((sum, r) => sum + r.commentCount, 0);
    const totalSaves = recipes.reduce((sum, r) => sum + r.saveCount, 0);
    const totalShares = recipes.reduce((sum, r) => sum + r.shareCount, 0);

    // New followers in the last 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const newFollowers = await Follow.countDocuments({
      followingId: req.user.userId,
      status: "accepted",
      createdAt: { $gte: thirtyDaysAgo },
    });

    // Top 5 performing recipes by views
    const topRecipes = recipes
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 5)
      .map((r) => ({
        _id: r._id,
        title: r.title,
        viewCount: r.viewCount,
        likeCount: r.likeCount,
        commentCount: r.commentCount,
        saveCount: r.saveCount,
      }));

    return successResponse(res, 200, {
      overview: {
        totalRecipes,
        totalViews,
        uniqueViewers: uniqueViewers.length,
        totalLikes,
        totalComments,
        totalSaves,
        totalShares,
        followerCount: user.followerCount,
        newFollowersLast30Days: newFollowers,
      },
      topRecipes,
    }, null, "Professional analytics");
  } catch (error) {
    next(error);
  }
};

const recipeAnalytics = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user.isProfessional) {
      return errorResponse(res, 403, "Professional mode required", "PROFESSIONAL_REQUIRED");
    }

    const recipe = await Recipe.findById(req.params.recipeId);
    if (!recipe || recipe.authorId.toString() !== req.user.userId) {
      return errorResponse(res, 404, "Recipe not found", "NOT_FOUND");
    }

    // Unique viewers for this recipe
    const uniqueViewers = await View.distinct("userId", { recipeId: recipe._id });

    // Views over the last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recentViewCount = await View.countDocuments({
      recipeId: recipe._id,
      viewedAt: { $gte: sevenDaysAgo },
    });

    return successResponse(res, 200, {
      recipeId: recipe._id,
      title: recipe.title,
      totalViews: recipe.viewCount,
      uniqueViewers: uniqueViewers.length,
      recentViews7d: recentViewCount,
      likeCount: recipe.likeCount,
      commentCount: recipe.commentCount,
      saveCount: recipe.saveCount,
      shareCount: recipe.shareCount,
    }, null, "Recipe analytics");
  } catch (error) {
    next(error);
  }
};

// Admin dashboard stats (kept from original)
const dashboardStats = async (req, res, next) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRecipes = await Recipe.countDocuments();
    const publishedRecipes = await Recipe.countDocuments({ status: "published" });
    const flaggedRecipes = await Recipe.countDocuments({ isFlagged: true });
    const professionalUsers = await User.countDocuments({ isProfessional: true });

    return successResponse(res, 200, {
      totalUsers,
      totalRecipes,
      publishedRecipes,
      flaggedRecipes,
      professionalUsers,
    }, null, "Dashboard stats");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  profileAnalytics,
  recipeAnalytics,
  dashboardStats,
};
