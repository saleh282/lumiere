import mongoose from 'mongoose';
export const CATEGORIES = ['Abstract', 'Landscapes', 'Seascapes', 'Portraits', 'Still life', 'Other'];
const paintingSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, maxlength: 120 },
  description: { type: String, required: true, trim: true, maxlength: 5000 },
  price: { type: Number, required: true, min: 0.01, max: 1000000000 },
  category: { type: String, required: true, enum: CATEGORIES },
  medium: { type: String, required: true, trim: true, maxlength: 100 },
  dimensions: { type: String, required: true, trim: true, maxlength: 100 },
  location: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
  year: { type: Number, min: 1000, validate: { validator: value => value == null || (Number.isInteger(value) && value <= new Date().getFullYear() + 1), message: 'Enter a valid four-digit year.' } },
  imageUrl: { type: String, required: true },
  imagePublicId: { type: String, required: true, select: false },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['available', 'sold'], default: 'available', index: true },
  createdAt: { type: Date, default: Date.now, immutable: true }
}, { versionKey: false });
paintingSchema.index({ status: 1, category: 1, createdAt: -1 });
export default mongoose.model('Painting', paintingSchema);

