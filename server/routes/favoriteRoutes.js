import { Router } from 'express';
import mongoose from 'mongoose';
import Favorite from '../models/Favorite.js';
import Painting from '../models/Painting.js';
import { paintingDto } from '../controllers/paintingController.js';
import { asyncHandler, HttpError } from '../utils/errors.js';
export function favoriteRoutes(authenticate) {
  const router = Router();
  router.use(authenticate);
  router.get('/', asyncHandler(async (req, res) => {
    const records = await Favorite.find({ userId: req.user._id }).sort({ createdAt: -1 }).populate({ path: 'paintingId', populate: { path: 'sellerId', select: 'name' } });
    res.json({ paintings: records.filter(item => item.paintingId).map(item => paintingDto(item.paintingId)) });
  }));
  router.put('/', asyncHandler(async (req, res) => {
    const { paintingId, saved } = req.body || {};
    if (!mongoose.isObjectIdOrHexString(paintingId) || typeof saved !== 'boolean') throw new HttpError(422, 'Choose a valid painting and favorite action.');
    if (saved) {
      if (!await Painting.exists({ _id: paintingId })) throw new HttpError(404, 'This painting could not be found.');
      await Favorite.updateOne({ userId: req.user._id, paintingId }, { $setOnInsert: { userId: req.user._id, paintingId } }, { upsert: true });
    } else await Favorite.deleteOne({ userId: req.user._id, paintingId });
    res.json({ paintingId, saved });
  }));
  return router;
}
