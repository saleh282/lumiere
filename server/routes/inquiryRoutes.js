import { Router } from 'express';
import Inquiry from '../models/Inquiry.js';
import { asyncHandler } from '../utils/errors.js';
export function inquiryRoutes(authenticate) {
  const router = Router();
  router.get('/mine', authenticate, asyncHandler(async (req, res) => {
    const inquiries = await Inquiry.find({ sellerId: req.user._id }).sort({ createdAt: -1 }).limit(100).populate('buyerId', 'name email').populate('paintingId', 'title');
    res.json({ inquiries: inquiries.filter(item => item.buyerId && item.paintingId).map(item => ({ id: String(item._id), createdAt: item.createdAt, buyer: { name: item.buyerId.name, email: item.buyerId.email }, painting: { id: String(item.paintingId._id), title: item.paintingId.title } })) });
  }));
  return router;
}
