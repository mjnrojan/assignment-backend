const Recipe = require("../models/recipe.model");
const User = require("../models/user.model");
const Follow = require("../models/follow.model");
const { uploadBuffer, deleteAsset } = require("../services/cloudinary.service");
const { successResponse, errorResponse } = require("../utils/apiResponse");

const getPublicProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }

    const recipeCount = await Recipe.countDocuments({ authorId: user._id, status: "published" });

    // Check if requester follows this user
    let isFollowing = false;
    let followStatus = null;
    if (req.user) {
      const follow = await Follow.findOne({
        followerId: req.user.userId,
        followingId: user._id,
      });
      if (follow) {
        isFollowing = follow.status === "accepted";
        followStatus = follow.status;
      }
    }

    return successResponse(res, 200, {
      user: {
        _id: user._id,
        firstName: user.firstName,
        lastName: user.lastName,
        username: user.username,
        isPrivate: user.isPrivate,
        isProfessional: user.isProfessional,
        followerCount: user.followerCount,
        followingCount: user.followingCount,
        biography: user.biography,
        profileImage: user.profileImage,
        socialLinks: user.socialLinks,
        specialisations: user.specialisations,
        businessCategory: user.businessCategory,
      },
      recipeCount,
      isFollowing,
      followStatus,
    }, null, "User profile");
  } catch (error) {
    next(error);
  }
};

const getMyProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }
    
    const recipeCount = await Recipe.countDocuments({ authorId: req.user.userId });
    const publishedCount = await Recipe.countDocuments({ authorId: req.user.userId, status: "published" });
    const draftCount = await Recipe.countDocuments({ authorId: req.user.userId, status: { $in: ["draft", "pending", "rejected"] } });

    return successResponse(
      res,
      200,
      {
        user,
        stats: { recipeCount, publishedCount, draftCount },
      },
      null,
      "My profile"
    );
  } catch (error) {
    next(error);
  }
};

const updateProfile = async (req, res, next) => {
  try {
    const { biography, socialLinks, specialisations, contactEmail, businessCategory } = req.body;
    const update = {};
    if (biography !== undefined) update.biography = biography;
    if (socialLinks !== undefined) update.socialLinks = socialLinks;
    if (specialisations !== undefined) update.specialisations = specialisations;
    if (contactEmail !== undefined) update.contactEmail = contactEmail;
    if (businessCategory !== undefined) update.businessCategory = businessCategory;

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: update },
      { new: true, runValidators: true }
    );
    if (!user) {
      return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }
    return successResponse(res, 200, user, null, "Profile updated");
  } catch (error) {
    next(error);
  }
};

const uploadAvatar = async (req, res, next) => {
  try {
    const file = req.files?.avatar?.[0];
    if (!file) {
      return errorResponse(res, 400, "Avatar file is required", "VALIDATION_ERROR");
    }

    const user = await User.findById(req.user.userId);
    if (!user) {
      return errorResponse(res, 404, "User not found", "NOT_FOUND");
    }

    const result = await uploadBuffer({
      buffer: file.buffer,
      folder: "recipenest/avatars",
    });

    if (user.profileImagePublicId) {
      await deleteAsset(user.profileImagePublicId);
    }

    user.profileImage = result.secure_url;
    user.profileImagePublicId = result.public_id;
    await user.save();

    return successResponse(res, 200, user, null, "Avatar uploaded");
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getPublicProfile,
  getMyProfile,
  updateProfile,
  uploadAvatar,
};
