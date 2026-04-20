const User = require("../models/user.model");
const Recipe = require("../models/recipe.model");
const AuditLog = require("../models/auditLog.model");
const { writeAuditLog } = require("../services/audit.service");
const { sendModerationEmail } = require("../services/email.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");

const listUsers = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;
    const q = (req.query.q || "").trim();
    const status = req.query.status;

    const query = {};
    if (q) query.$or = [{ firstName: { $regex: q, $options: "i" } }, { lastName: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }];
    if (status === "active") query.isActive = true;
    if (status === "suspended") query.isActive = false;

    const total = await User.countDocuments(query);
    const users = await User.find(query).select("-passwordHash").sort("-createdAt").skip(skip).limit(limit);
    return successResponse(
      res,
      200,
      users,
      { page, limit, total, pages: Math.ceil(total / limit) },
      "Users list"
    );
  } catch (error) {
    next(error);
  }
};

const getUserById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId).select("-passwordHash");
    if (!user) return errorResponse(res, 404, "User not found", "NOT_FOUND");
    return successResponse(res, 200, user, null, "User detail");
  } catch (error) {
    next(error);
  }
};

const suspendUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, { isActive: false }, { new: true });
    if (!user) return errorResponse(res, 404, "User not found", "NOT_FOUND");
    await writeAuditLog({
      adminId: req.user.userId,
      action: "SUSPEND_USER",
      targetType: "User",
      targetId: user._id,
      details: "Admin suspended user account",
    });
    return successResponse(res, 200, user, null, "User suspended");
  } catch (error) {
    next(error);
  }
};

const reinstateUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndUpdate(req.params.userId, { isActive: true }, { new: true });
    if (!user) return errorResponse(res, 404, "User not found", "NOT_FOUND");
    await writeAuditLog({
      adminId: req.user.userId,
      action: "REINSTATE_USER",
      targetType: "User",
      targetId: user._id,
      details: "Admin reinstated user account",
    });
    return successResponse(res, 200, user, null, "User reinstated");
  } catch (error) {
    next(error);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findByIdAndDelete(req.params.userId);
    if (!user) return errorResponse(res, 404, "User not found", "NOT_FOUND");


    await Recipe.deleteMany({ authorId: user._id });

    await writeAuditLog({
      adminId: req.user.userId,
      action: "DELETE_USER",
      targetType: "User",
      targetId: user._id,
      details: "Admin permanently deleted user and related data",
    });
    return successResponse(res, 200, null, null, "User deleted");
  } catch (error) {
    next(error);
  }
};

const listContent = async (req, res, next) => {
  try {
    const status = req.query.status || "all";
    const query = {};
    if (status === "pending") query.status = "pending";
    if (status === "flagged") query.isFlagged = true;

    const content = await Recipe.find(query)
      .sort("-updatedAt")
      .populate("authorId", "firstName lastName username");
    return successResponse(res, 200, content, null, "Moderation content");
  } catch (error) {
    next(error);
  }
};

const approveContent = async (req, res, next) => {
  try {
    const recipe = await Recipe.findByIdAndUpdate(
      req.params.contentId,
      { status: "published", isFlagged: false },
      { new: true }
    );
    if (!recipe) return errorResponse(res, 404, "Content not found", "NOT_FOUND");
    await writeAuditLog({
      adminId: req.user.userId,
      action: "APPROVE_RECIPE",
      targetType: "Recipe",
      targetId: recipe._id,
      details: "Admin approved content",
    });
    return successResponse(res, 200, recipe, null, "Content approved");
  } catch (error) {
    next(error);
  }
};

const rejectContent = async (req, res, next) => {
  try {
    const recipe = await Recipe.findByIdAndUpdate(
      req.params.contentId,
      { status: "rejected", isFlagged: false },
      { new: true }
    ).populate("authorId", "firstName lastName email");

    if (!recipe) return errorResponse(res, 404, "Content not found", "NOT_FOUND");

    await writeAuditLog({
      adminId: req.user.userId,
      action: "REJECT_RECIPE",
      targetType: "Recipe",
      targetId: recipe._id,
      details: "Admin rejected content",
    });

    if (req.body.notifyAuthor && recipe.authorId) {
      await sendModerationEmail(recipe.authorId, "rejected");
    }
    return successResponse(res, 200, recipe, null, "Content rejected");
  } catch (error) {
    next(error);
  }
};

const deleteContent = async (req, res, next) => {
  try {
    const recipe = await Recipe.findByIdAndDelete(req.params.contentId);
    if (!recipe) return errorResponse(res, 404, "Content not found", "NOT_FOUND");
    await writeAuditLog({
      adminId: req.user.userId,
      action: "DELETE_CONTENT",
      targetType: "Recipe",
      targetId: recipe._id,
      details: "Admin deleted content",
    });
    return successResponse(res, 200, null, null, "Content deleted");
  } catch (error) {
    next(error);
  }
};

const auditLog = async (req, res, next) => {
  try {
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 10);
    const skip = (page - 1) * limit;
    const query = {};
    if (req.query.action) query.action = req.query.action;
    if (req.query.userId) query.adminId = req.query.userId;
    if (req.query.from || req.query.to) {
      query.createdAt = {};
      if (req.query.from) query.createdAt.$gte = new Date(req.query.from);
      if (req.query.to) query.createdAt.$lte = new Date(req.query.to);
    }

    const total = await AuditLog.countDocuments(query);
    const logs = await AuditLog.find(query).sort("-createdAt").skip(skip).limit(limit);
    return successResponse(
      res,
      200,
      logs,
      { page, limit, total, pages: Math.ceil(total / limit) },
      "Audit log"
    );
  } catch (error) {
    next(error);
  }
};

const dashboardStats = async (req, res, next) => {
  try {
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 7);

    const [totalUsers, totalRecipes, flaggedItems, newSignupsThisWeek, professionalUsers] = await Promise.all([
      User.countDocuments({}),
      Recipe.countDocuments({}),
      Recipe.countDocuments({ isFlagged: true }),
      User.countDocuments({ createdAt: { $gte: startOfWeek } }),
      User.countDocuments({ isProfessional: true }),
    ]);

    return successResponse(
      res,
      200,
      { totalUsers, totalRecipes, flaggedItems, newSignupsThisWeek, professionalUsers },
      null,
      "Dashboard stats"
    );
  } catch (error) {
    next(error);
  }
};

const Dispute = require("../models/dispute.model");

const listDisputes = async (req, res, next) => {
  try {
    const status = req.query.status || "pending";
    const disputes = await Dispute.find({ status })
      .populate("reporterId", "firstName lastName username")
      .populate("recipeId", "title slug status")
      .sort("-createdAt");
    
    return successResponse(res, 200, disputes, null, "Dispute list");
  } catch (error) {
    next(error);
  }
};

const resolveDispute = async (req, res, next) => {
  try {
    const { disputeId } = req.params;
    const { actionTaken, notes } = req.body;

    const dispute = await Dispute.findById(disputeId);
    if (!dispute) return errorResponse(res, 404, "Dispute not found", "NOT_FOUND");

    dispute.status = "resolved";
    dispute.resolution = {
      actionTaken,
      notes,
      resolvedBy: req.user.userId,
      resolvedAt: new Date(),
    };

    await dispute.save();

    // If action was content removal, update the recipe or comment
    if (actionTaken === "Content Removed") {
      if (dispute.targetType === "Comment") {
        const comment = await Comment.findByIdAndDelete(dispute.commentId);
        if (comment) {
          await Recipe.findByIdAndUpdate(comment.recipeId, { $inc: { commentCount: -1 } });
        }
      } else {
        await Recipe.findByIdAndUpdate(dispute.recipeId, { status: "rejected", isFlagged: false });
      }
    }

    await writeAuditLog({
      adminId: req.user.userId,
      action: "RESOLVE_DISPUTE",
      targetType: "Dispute",
      targetId: dispute._id,
      details: `Dispute resolved with action: ${actionTaken}`,
    });

    return successResponse(res, 200, dispute, null, "Dispute resolved");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  listUsers,
  getUserById,
  suspendUser,
  reinstateUser,
  deleteUser,
  listContent,
  approveContent,
  rejectContent,
  deleteContent,
  auditLog,
  dashboardStats,
  listDisputes,
  resolveDispute,
};
