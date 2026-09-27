import multer from 'multer';
import { HttpError } from '../utils/errors.js';
const mimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
export const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 12, fieldSize: 20000, parts: 14 },
  fileFilter(req, file, callback) {
    callback(mimeTypes.includes(file.mimetype) ? null : new HttpError(415, 'Choose a JPG, PNG, or WebP image.', { image: 'This image format is not supported.' }), mimeTypes.includes(file.mimetype));
  }
}).single('image');
export function verifyImage(req, res, next) {
  if (!req.file) return next();
  const b = req.file.buffer;
  let mime = '';
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) mime = 'image/jpeg';
  else if (b.length > 8 && b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) mime = 'image/png';
  else if (b.length > 12 && b.toString('ascii',0,4) === 'RIFF' && b.toString('ascii',8,12) === 'WEBP') mime = 'image/webp';
  if (!mime || mime !== req.file.mimetype) return next(new HttpError(415, 'The file is not a valid supported image.', { image: 'Upload an actual JPG, PNG, or WebP image.' }));
  next();
}
