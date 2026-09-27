import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { requireDatabase } from './config/database.js';
import { authMiddleware } from './middleware/auth.js';
import { createImageService } from './services/cloudinary.js';
import { authRoutes } from './routes/authRoutes.js';
import { paintingRoutes } from './routes/paintingRoutes.js';
import { errorHandler } from './utils/errors.js';
export function createApp({ jwtSecret = config.jwtSecret, images = createImageService(config.cloudinary) } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'https://res.cloudinary.com', 'data:', 'blob:'], 'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], 'font-src': ["'self'", 'https://fonts.gstatic.com'], 'connect-src': ["'self'"], 'upgrade-insecure-requests': null } } }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => { res.setHeader('Cache-Control', 'no-store'); next(); });
  app.get('/api/health', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ databaseReady: mongoose.connection.readyState === 1, uploadsReady: images.ready, authReady: jwtSecret.length >= 32 }));
  const authenticate = authMiddleware(jwtSecret);
  app.use('/api/auth', requireDatabase, authRoutes(jwtSecret, authenticate));
  app.use('/api/paintings', requireDatabase, paintingRoutes(authenticate, images));
  app.use('/api', (req, res) => res.status(404).json({ message: 'This API endpoint does not exist.' }));
  app.use(errorHandler);
  return app;
}
