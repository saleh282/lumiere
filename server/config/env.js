import dotenv from 'dotenv';
import { resolve } from 'node:path';
dotenv.config({ path: resolve('.env') });
export const config = {
  port: Number(process.env.PORT || 3001),
  host: process.env.HOST || '127.0.0.1',
  mongoUri: process.env.MONGO_URI || '',
  mongoDbName: process.env.MONGO_DB_NAME || 'lumiere',
  jwtSecret: process.env.JWT_SECRET || '',
  production: process.env.NODE_ENV === 'production'
};
