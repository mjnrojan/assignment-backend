const streamifier = require("streamifier");
const cloudinary = require("../config/cloudinary");

/**
 * Upload an image buffer to Cloudinary
 */
const uploadBuffer = ({ buffer, folder }) =>
  new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        transformation: [
          {
            quality: "auto",
            fetch_format: "auto",
            crop: "limit",
            width: 2000,
            height: 2000,
          },
        ],
      },
      (error, result) => {
        if (error) {
          return reject(error);
        }
        return resolve(result);
      }
    );

    streamifier.createReadStream(buffer).pipe(uploadStream);
  });

/**
 * Upload an image from a URL to Cloudinary
 */
const uploadUrl = async ({ url, folder }) => {
  try {
    const result = await cloudinary.uploader.upload(url, {
      folder,
      resource_type: "image",
      transformation: [
        {
          quality: "auto",
          fetch_format: "auto",
          crop: "limit",
          width: 1200,
          height: 1200,
        },
      ],
    });
    return result;
  } catch (error) {
    throw error;
  }
};

/**
 * Delete an image from Cloudinary
 */
const deleteAsset = async (publicId) => {
  if (!publicId) {
    return null;
  }
  return cloudinary.uploader.destroy(publicId, { invalidate: true, resource_type: "image" });
};

module.exports = {
  uploadBuffer,
  uploadUrl,
  deleteAsset,
};
