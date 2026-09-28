import express from 'express';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { requireDatabase } from './config/database.js';
import { authMiddleware } from './middleware/auth.js';
import { createMongoImageService } from './services/mongoImages.js';
import { authRoutes } from './routes/authRoutes.js';
import { paintingRoutes } from './routes/paintingRoutes.js';
import { favoriteRoutes } from './routes/favoriteRoutes.js';
import { inquiryRoutes } from './routes/inquiryRoutes.js';
import { imageRoutes } from './routes/imageRoutes.js';
import { errorHandler } from './utils/errors.js';

export function createApp({ jwtSecret = config.jwtSecret, images = createMongoImageService(), mailer } = {}) {
  const app = express();
  app.disable('x-powered-by');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet({ contentSecurityPolicy: { directives: { 'img-src': ["'self'", 'data:', 'blob:'], 'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'], 'font-src': ["'self'", 'https://fonts.gstatic.com'], 'connect-src': ["'self'"], 'upgrade-insecure-requests': null } } }));
  app.use(express.json({ limit: '32kb' }));
  app.use('/api', (req, res, next) => {
    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.headers.origin) {
      try {
        const origin = new URL(req.headers.origin);
        const sameHost = origin.host === req.headers.host;
        const localClient = !config.production && ['http://127.0.0.1:5174', 'http://127.0.0.1:4173', 'http://localhost:5174', 'http://localhost:4173'].includes(origin.origin);
        if (!sameHost && !localClient) return res.status(403).json({ message: 'This request must come from Lumière.' });
      }
      catch { return res.status(403).json({ message: 'Invalid request origin.' }); }
    }
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.get('/api/health', (req, res) => res.status(mongoose.connection.readyState === 1 ? 200 : 503).json({ databaseReady: mongoose.connection.readyState === 1, databaseName: mongoose.connection.readyState === 1 ? mongoose.connection.name : null, uploadsReady: images.ready, imageStorage: images.storage, authReady: jwtSecret.length >= 32 }));
  const authenticate = authMiddleware(jwtSecret);
  app.use('/api/images', requireDatabase, imageRoutes());
  app.use('/api/auth', requireDatabase, authRoutes(jwtSecret, authenticate, mailer));
  app.use('/api/paintings', requireDatabase, paintingRoutes(authenticate, images));
  app.use('/api/favorites', requireDatabase, favoriteRoutes(authenticate));
  app.use('/api/inquiries', requireDatabase, inquiryRoutes(authenticate));
  app.use('/api', (req, res) => res.status(404).json({ message: 'This API endpoint does not exist.' }));
  app.use(errorHandler);
  return app;
}
