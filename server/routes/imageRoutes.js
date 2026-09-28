import { Router } from 'express';
import mongoose from 'mongoose';
import { asyncHandler, HttpError } from '../utils/errors.js';

export function imageRoutes() {
  const router = Router();
  router.get('/:id', asyncHandler(async (req, res, next) => {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) throw new HttpError(400, 'Invalid image link.');
    const id = new mongoose.Types.ObjectId(req.params.id);
    const bucket = new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: 'paintingImages' });
    const file = await bucket.find({ _id: id }).next();
    if (!file) throw new HttpError(404, 'Image not found.');
    res.setHeader('Content-Type', file.metadata?.contentType || 'application/octet-stream');
    res.setHeader('Content-Length', file.length);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    bucket.openDownloadStream(id).on('error', next).pipe(res);
  }));
  return router;
}
