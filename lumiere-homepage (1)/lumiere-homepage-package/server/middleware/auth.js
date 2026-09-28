import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import Painting from '../models/Painting.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
export function authMiddleware(secret) {
  return asyncHandler(async (req, res, next) => {
    if (!secret || secret.length < 32) throw new HttpError(503, 'Sign-in is temporarily unavailable. Please try again later.');
    const header = req.headers.authorization || '';
    if (!header.startsWith('Bearer ')) throw new HttpError(401, 'Please sign in to continue.', undefined, 'TOKEN_INVALID');
    let decoded;
    try { decoded = jwt.verify(header.slice(7), secret, { algorithms: ['HS256'], issuer: 'lumiere', audience: 'lumiere-web' }); }
    catch { throw new HttpError(401, 'Your session has expired. Please sign in again.', undefined, 'TOKEN_INVALID'); }
    if (!mongoose.isObjectIdOrHexString(decoded.sub)) throw new HttpError(401, 'Please sign in again.', undefined, 'TOKEN_INVALID');
    req.user = await User.findById(decoded.sub);
    if (!req.user) throw new HttpError(401, 'Please sign in again.', undefined, 'TOKEN_INVALID');
    next();
  });
}
export function validateId(req, res, next) {
  if (!mongoose.isObjectIdOrHexString(req.params.id)) return next(new HttpError(400, 'This painting link is not valid.'));
  next();
}
export const requireOwner = asyncHandler(async (req, res, next) => {
  const painting = await Painting.findById(req.params.id).select('+imagePublicId');
  if (!painting) throw new HttpError(404, 'This painting could not be found.');
  if (String(painting.sellerId) !== String(req.user._id)) throw new HttpError(403, 'Only the owner can change this listing.');
  req.painting = painting; next();
});
