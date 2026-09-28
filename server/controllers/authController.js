import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import { createMailer } from '../services/mail.js';
import User from '../models/User.js';
import { HttpError } from '../utils/errors.js';
import { config } from '../config/env.js';
export const userDto = user => ({ id: String(user._id), name: user.name, email: user.email, bio: user.bio || '', location: user.location || '', phone: user.phone || '', createdAt: user.createdAt });
const cookieOptions = `HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800${config.production ? '; Secure' : ''}`;
export function createAuthController(secret, mailer = createMailer()) {
  const requireSecret = () => { if (!secret || secret.length < 32) throw new HttpError(503, 'Sign-in is temporarily unavailable. Please try again later.'); };
  function session(user) {
    const token = jwt.sign({ version: user.sessionVersion || 0 }, secret, { subject: String(user._id), expiresIn: '7d', algorithm: 'HS256', issuer: 'lumiere', audience: 'lumiere-web' });
    return { token, user: userDto(user) };
  }
  return {
    async updateProfile(req, res) {
      const fields = {}, values = {};
      for (const [key, min, max] of [['name', 2, 80], ['bio', 0, 500], ['location', 0, 100], ['phone', 0, 30]]) {
        if (!Object.hasOwn(req.body || {}, key)) continue;
        const value = typeof req.body[key] === 'string' ? req.body[key].trim() : null;
        if (value === null || value.length < min || value.length > max) fields[key] = `Use ${min}–${max} characters.`;
        else values[key] = value;
      }
      if (values.phone && (!/^\+?[\d\s().-]{7,30}$/.test(values.phone) || values.phone.replace(/\D/g, '').length < 7 || values.phone.replace(/\D/g, '').length > 15)) fields.phone = 'Enter a valid phone number.';
      if (Object.keys(fields).length) throw new HttpError(422, 'Please check your profile details.', fields);
      const user = await User.findByIdAndUpdate(req.user._id, { $set: values }, { new: true, runValidators: true });
      res.json({ user: userDto(user) });
    },
    async forgotPassword(req, res) {
      const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) throw new HttpError(422, 'Enter a valid email address.');
      if (!mailer.ready) throw new HttpError(503, 'Password recovery email is not configured yet. Please contact the site owner.');
      const user = await User.findOne({ email });
      if (user) {
        const token = randomBytes(32).toString('hex');
        const hash = createHash('sha256').update(token).digest('hex');
        await User.updateOne({ _id: user._id }, { $set: { resetTokenHash: hash, resetTokenExpires: new Date(Date.now() + 30 * 60 * 1000) } });
        try { await mailer.sendReset(user.email, token); }
        catch {
          await User.updateOne({ _id: user._id, resetTokenHash: hash }, { $unset: { resetTokenHash: 1, resetTokenExpires: 1 } });
          // Keep the response identical for known and unknown accounts.
          console.error('Password reset email delivery failed. Check SMTP configuration.');
        }
      }
      res.json({ message: 'If an account exists for this email, a reset link will arrive shortly. Check your inbox and spam folder.' });
    },
    async resetPassword(req, res) {
      const { token, password, confirmPassword } = req.body || {};
      if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) throw new HttpError(400, 'This reset link is invalid or expired. Request a new link.');
      if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72 || password !== confirmPassword) throw new HttpError(422, 'Use at least 10 characters (maximum 72 UTF-8 bytes) and matching passwords.');
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.findOneAndUpdate({ resetTokenHash: createHash('sha256').update(token).digest('hex'), resetTokenExpires: { $gt: new Date() } }, { $set: { passwordHash }, $inc: { sessionVersion: 1 }, $unset: { resetTokenHash: 1, resetTokenExpires: 1 } });
      if (!user) throw new HttpError(400, 'This reset link is invalid or expired. Request a new link.');
      res.json({ message: 'Password updated. Sign in with your new password.' });
    },
    async changePassword(req, res) {
      const { currentPassword, password, confirmPassword } = req.body || {};
      if (typeof password !== 'string' || password.length < 10 || Buffer.byteLength(password, 'utf8') > 72 || password !== confirmPassword) throw new HttpError(422, 'Use at least 10 characters (maximum 72 UTF-8 bytes) and matching passwords.');
      const user = await User.findById(req.user._id).select('+passwordHash');
      if (typeof currentPassword !== 'string' || !(await bcrypt.compare(currentPassword, user.passwordHash))) throw new HttpError(401, 'Your current password is incorrect.');
      const updated = await User.findOneAndUpdate({ _id: user._id, passwordHash: user.passwordHash }, { $set: { passwordHash: await bcrypt.hash(password, 12) }, $inc: { sessionVersion: 1 }, $unset: { resetTokenHash: 1, resetTokenExpires: 1 } }, { new: true });
      if (!updated) throw new HttpError(409, 'Your password changed. Please sign in again.');
      const { token } = session(updated);
      res.setHeader('Set-Cookie', `lumiere_session=${token}; ${cookieOptions}`);
      res.json({ message: 'Password changed. Other sessions have been signed out.' });
    },
    async register(req, res) {
      requireSecret();
      const { name, email, password } = req.validated;
      if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists.', { email: 'This email is already registered. Please sign in.' });
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ name, email, passwordHash });
      const { token, user: safeUser } = session(user);
      res.setHeader('Set-Cookie', `lumiere_session=${token}; ${cookieOptions}`);
      res.status(201).json({ user: safeUser });
    },
    async login(req, res) {
      requireSecret();
      const { email, password } = req.validated;
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'The email or password is incorrect.');
      const { token, user: safeUser } = session(user);
      res.setHeader('Set-Cookie', `lumiere_session=${token}; ${cookieOptions}`);
      res.json({ user: safeUser });
    },
    async me(req, res) { res.json({ user: userDto(req.user) }); },
    async logout(req, res) {
      res.setHeader('Set-Cookie', `lumiere_session=; HttpOnly; SameSite=Strict; Path=/api; Max-Age=0${config.production ? '; Secure' : ''}`);
      res.json({ success: true });
    }
  };
}
