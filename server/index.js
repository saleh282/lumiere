import express from 'express';
import { resolve } from 'node:path';
import mongoose from 'mongoose';
import { config } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { createApp } from './app.js';
try {
  if (await connectDatabase(config.mongoUri, config.mongoDbName)) console.log(`MongoDB connected to ${config.mongoDbName}.`);
  else console.log('Add MONGO_URI to .env and restart to enable accounts and listings.');
} catch (error) { console.error('MongoDB connection failed:', error.name, 'Check MONGO_URI and network access, then restart.'); }
if (config.jwtSecret.length < 32) console.log('Set a JWT_SECRET of at least 32 characters in .env.');
const app = createApp();
if (config.production) {
  const directory = resolve('client/dist');
  app.use(express.static(directory));
  app.get('/{*path}', (req, res) => res.sendFile(resolve(directory, 'index.html')));
}
const server = app.listen(config.port, config.host, () => console.log(`Lumière API ready at http://${config.host}:${config.port}`));
async function shutdown() { server.close(async () => { await mongoose.disconnect(); process.exit(0); }); }
process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
