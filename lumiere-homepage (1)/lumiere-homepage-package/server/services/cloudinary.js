import { v2 as cloudinary } from 'cloudinary';
import { HttpError } from '../utils/errors.js';
export function createImageService(credentials) {
  const ready = Boolean(credentials.cloud_name && credentials.api_key && credentials.api_secret);
  if (ready) cloudinary.config({ ...credentials, secure: true });
  return {
    ready,
    async upload(buffer) {
      if (!ready) throw new HttpError(503, 'Image uploads are temporarily unavailable. Please try again later.', undefined, 'UPLOAD_UNAVAILABLE');
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream({ folder: 'lumiere/paintings', resource_type: 'image', allowed_formats: ['jpg', 'png', 'webp'], transformation: [{ width: 2400, height: 2400, crop: 'limit' }], timeout: 60000 }, (error, result) => {
          if (error || !result?.secure_url) return reject(new HttpError(502, 'The image could not be uploaded. Please try again.', { image: 'Upload failed. Your listing has not been saved.' }));
          resolve({ imageUrl: result.secure_url, imagePublicId: result.public_id });
        });
        stream.end(buffer);
      });
    },
    async remove(publicId) {
      if (ready && publicId) await cloudinary.uploader.destroy(publicId, { resource_type: 'image', invalidate: true });
    }
  };
}
