import mongoose from 'mongoose';
import { HttpError } from '../utils/errors.js';

export function createMongoImageService() {
  const bucket = () => {
    if (!mongoose.connection.db) throw new HttpError(503, 'Image storage is temporarily unavailable.', undefined, 'UPLOAD_UNAVAILABLE');
    return new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'paintingImages' });
  };
  return {
    get ready() { return mongoose.connection.readyState === 1; },
    storage: 'mongodb',
    async upload(buffer, contentType) {
      const id = new mongoose.Types.ObjectId();
      await new Promise((resolve, reject) => {
        const stream = bucket().openUploadStreamWithId(id, String(id), { metadata: { contentType } });
        stream.once('finish', resolve).once('error', reject);
        stream.end(buffer);
      });
      return { imageUrl: '/api/images/' + id, imagePublicId: 'mongo:' + id };
    },
    async remove(publicId) {
      if (!publicId?.startsWith('mongo:')) return;
      const id = publicId.slice(6);
      if (mongoose.isObjectIdOrHexString(id)) await bucket().delete(new mongoose.Types.ObjectId(id));
    }
  };
}
