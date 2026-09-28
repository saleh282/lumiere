import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateAuth } from '../middleware/validation.js';
import { createAuthController } from '../controllers/authController.js';
import { asyncHandler } from '../utils/errors.js';
export function authRoutes(secret, authenticate) {
  const router = Router(), controller = createAuthController(secret);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again in 15 minutes.' } });
  router.post('/register', limiter, validateAuth(true), asyncHandler(controller.register));
  router.post('/login', limiter, validateAuth(false), asyncHandler(controller.login));
  router.get('/me', authenticate, asyncHandler(controller.me));
  return router;
}
