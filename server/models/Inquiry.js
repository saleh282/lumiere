import mongoose from 'mongoose';
const schema = new mongoose.Schema({
  paintingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Painting', required: true, index: true },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });
schema.index({ paintingId: 1, buyerId: 1 }, { unique: true });
export default mongoose.model('Inquiry', schema);
