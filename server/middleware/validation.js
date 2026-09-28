import { HttpError } from '../utils/errors.js';
import { CATEGORIES } from '../models/Painting.js';
const string = value => typeof value === 'string' ? value.trim() : '';
export function validateAuth(register = false) {
  return (req, res, next) => {
    const input = req.body || {};
    const email = string(input.email).toLowerCase();
    const name = string(input.name);
    const password = typeof input.password === 'string' ? input.password : '';
    const fields = {};
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) fields.email = 'Enter a valid email address.';
    if (register && (name.length < 2 || name.length > 80)) fields.name = 'Enter your name (2–80 characters).';
    if (register && input.confirmPassword !== password) fields.confirmPassword = 'Passwords do not match.';
    // bcrypt only processes the first 72 bytes: reject longer inputs instead of silently truncating.
    if (password.length < 10 || Buffer.byteLength(password, 'utf8') > 72) fields.password = 'Use at least 10 characters and no more than 72 UTF-8 bytes.';
    if (Object.keys(fields).length) return next(new HttpError(422, 'Please check the highlighted fields.', fields));
    req.validated = { name, email, password }; next();
  };
}
export function validatePainting(req, res, next) {
  const input = req.body || {};
  const update = req.method === 'PUT';
  const fields = {}, values = {};
  for (const [name, min, max] of [['title', 2, 120], ['description', 10, 5000], ['medium', 2, 100], ['dimensions', 2, 100], ['location', 2, 100]]) {
    if (update && !Object.hasOwn(input, name)) continue;
    const value = string(input[name]);
    if (value.length < min || value.length > max) fields[name] = `Use ${min}–${max} characters.`;
    else values[name] = value;
  }
  if (!update || Object.hasOwn(input, 'price')) {
    const price = typeof input.price === 'number' || typeof input.price === 'string' ? Number(input.price) : NaN;
    if (!Number.isFinite(price) || price <= 0 || price > 1000000000 || Math.abs(price * 100 - Math.round(price * 100)) > 0.00001) fields.price = 'Enter a price greater than zero, with up to two decimal places.';
    else values.price = price;
  }
  if (Object.hasOwn(input, 'year') && input.year !== '') {
    const year = typeof input.year === 'number' || typeof input.year === 'string' ? Number(input.year) : NaN;
    if (!Number.isInteger(year) || year < 1000 || year > new Date().getFullYear() + 1) fields.year = 'Enter a valid four-digit year.';
    else values.year = year;
  } else if (update && Object.hasOwn(input, 'year')) {
    values.year = undefined;
  }
  if (!update || Object.hasOwn(input, 'category')) {
    if (!CATEGORIES.includes(input.category)) fields.category = 'Choose a category from the list.';
    else values.category = input.category;
  }
  if (update && Object.hasOwn(input, 'status')) {
    if (!['available', 'sold'].includes(input.status)) fields.status = 'Choose Available or Sold.';
    else values.status = input.status;
  }
  if (!update && !req.file) fields.image = 'Upload a photo of the painting.';
  if (Object.keys(fields).length) return next(new HttpError(422, 'Please check the highlighted fields.', fields));
  // No sellerId, imageUrl, imagePublicId, or createdAt from the client is ever assigned.
  if (update && !Object.keys(values).length && !req.file) return next(new HttpError(422, 'No changes were submitted.'));
  req.validated = values; next();
}
