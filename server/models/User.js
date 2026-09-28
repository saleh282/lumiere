import mongoose from 'mongoose';
const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
  passwordHash: { type: String, required: true, select: false },
  bio: { type: String, default: '', maxlength: 500 },
  location: { type: String, default: '', maxlength: 100 },
  phone: { type: String, default: '', maxlength: 30 },
  sessionVersion: { type: Number, default: 0 },
  resetTokenHash: { type: String, select: false },
  resetTokenExpires: { type: Date, select: false },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });
export default mongoose.model('User', userSchema);
