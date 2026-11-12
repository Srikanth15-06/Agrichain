const crypto = require('crypto');
const { v2: cloudinary } = require('cloudinary');

const isConfigured = () => Boolean(
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
);

if (isConfigured()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true
  });
}

const notConfiguredError = () => {
  const error = new Error('Cloudinary image storage is not configured');
  error.code = 'CLOUDINARY_NOT_CONFIGURED';
  return error;
};

const uploadImage = file => {
  if (!isConfigured()) {
    return Promise.reject(notConfiguredError());
  }

  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: 'agrichain/produce',
        public_id: crypto.randomUUID(),
        resource_type: 'image'
      },
      (error, result) => {
        if (error) {
          const uploadError = new Error('Cloudinary image upload failed');
          uploadError.code = 'CLOUDINARY_UPLOAD_FAILED';
          return reject(uploadError);
        }
        if (!result || !result.secure_url || !result.public_id) {
          const uploadError = new Error('Cloudinary returned an incomplete image result');
          uploadError.code = 'CLOUDINARY_UPLOAD_FAILED';
          return reject(uploadError);
        }
        return resolve({ url: result.secure_url, publicId: result.public_id });
      }
    );
    stream.end(file.buffer);
  });
};

const deleteImage = async publicId => {
  if (!isConfigured()) {
    throw notConfiguredError();
  }

  const result = await cloudinary.uploader.destroy(publicId, { resource_type: 'image' });
  if (!result || !['ok', 'not found'].includes(result.result)) {
    const error = new Error('Cloudinary image deletion failed');
    error.code = 'CLOUDINARY_DELETE_FAILED';
    throw error;
  }
};

module.exports = { deleteImage, isConfigured, uploadImage };
