import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { validateAuth } from '../middleware/validation.js';
import { createAuthController } from '../controllers/authController.js';
import { asyncHandler } from '../utils/errors.js';
export function authRoutes(secret, authenticate, mailer) {
  const router = Router(), controller = createAuthController(secret, mailer);
  const limiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many attempts. Please try again in 15 minutes.' } });
  router.post('/register', limiter, validateAuth(true), asyncHandler(controller.register));
  router.post('/login', limiter, validateAuth(false), asyncHandler(controller.login));
  const recoveryLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false, message: { message: 'Too many recovery attempts. Please try again in 15 minutes.' } });
  router.post('/forgot-password', recoveryLimiter, asyncHandler(controller.forgotPassword));
  router.post('/reset-password', recoveryLimiter, asyncHandler(controller.resetPassword));
  router.put('/profile', authenticate, asyncHandler(controller.updateProfile));
  router.post('/change-password', limiter, authenticate, asyncHandler(controller.changePassword));
  router.post('/logout', asyncHandler(controller.logout));
  router.get('/me', authenticate, asyncHandler(controller.me));
  return router;
}
