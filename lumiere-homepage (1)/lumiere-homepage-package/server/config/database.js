import mongoose from 'mongoose';
mongoose.set('bufferTimeoutMS', 2000);
export async function connectDatabase(uri) {
  if (!uri) return false;
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  return true;
}
export function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) return res.status(503).json({ message: 'The gallery is temporarily unavailable. Please try again shortly.', code: 'DATABASE_UNAVAILABLE' });
  next();
}

