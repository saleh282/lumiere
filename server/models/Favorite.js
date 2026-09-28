import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  paintingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Painting', required: true },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });
schema.index({ userId: 1, paintingId: 1 }, { unique: true });
export default mongoose.model('Favorite', schema);
