const multer = require("multer");
const { v2: cloudinary } = require("cloudinary");

const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/svg+xml"
]);

cloudinary.config({ secure: true });

const airlineUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_IMAGE_SIZE
  },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_IMAGE_MIME_TYPES.has(file.mimetype)) {
      const error = new Error("Only image files are allowed.");
      error.statusCode = 400;
      cb(error);
      return;
    }

    cb(null, true);
  }
});

function uploadBufferToCloudinary(file, options = {}) {
  if (!file?.buffer) {
    return Promise.resolve(null);
  }

  if (!process.env.CLOUDINARY_URL) {
    const error = new Error("CLOUDINARY_URL is not configured.");
    error.statusCode = 500;
    return Promise.reject(error);
  }

  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      {
        folder: options.folder || "skyline/airlines",
        public_id: options.publicId,
        resource_type: "image"
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(result);
      }
    );

    uploadStream.end(file.buffer);
  });
}

module.exports = {
  airlineUpload,
  uploadBufferToCloudinary
};
