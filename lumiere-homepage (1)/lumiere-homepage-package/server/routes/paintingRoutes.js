import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { createPaintingController } from '../controllers/paintingController.js';
import { requireOwner, validateId } from '../middleware/auth.js';
import { uploadImage, verifyImage } from '../middleware/upload.js';
import { validatePainting } from '../middleware/validation.js';
import { asyncHandler } from '../utils/errors.js';
export function paintingRoutes(authenticate, images) {
  const router = Router(), controller = createPaintingController(images);
  const writes = rateLimit({ windowMs: 15 * 60 * 1000, limit: 60, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Please wait a few minutes before changing more listings.' } });
  router.get('/', asyncHandler(controller.list));
  // Static routes must precede /:id.
  router.get('/mine', authenticate, asyncHandler(controller.mine));
  router.post('/', authenticate, writes, uploadImage, verifyImage, validatePainting, asyncHandler(controller.create));
  router.get('/:id', validateId, asyncHandler(controller.detail));
  router.get('/:id/contact', authenticate, validateId, asyncHandler(controller.contact));
  // Ownership is checked before reading an upload or making any external request.
  router.put('/:id', authenticate, validateId, requireOwner, writes, uploadImage, verifyImage, validatePainting, asyncHandler(controller.update));
  router.delete('/:id', authenticate, validateId, requireOwner, writes, asyncHandler(controller.remove));
  return router;
}
