import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from '../utils/errors.js';
export const userDto = user => ({ id: String(user._id), name: user.name, email: user.email, createdAt: user.createdAt });
export function createAuthController(secret) {
  const requireSecret = () => { if (!secret || secret.length < 32) throw new HttpError(503, 'Sign-in is temporarily unavailable. Please try again later.'); };
  function session(user) {
    const token = jwt.sign({}, secret, { subject: String(user._id), expiresIn: '7d', algorithm: 'HS256', issuer: 'lumiere', audience: 'lumiere-web' });
    return { token, user: userDto(user) };
  }
  return {
    async register(req, res) {
      requireSecret();
      const { name, email, password } = req.validated;
      if (await User.exists({ email })) throw new HttpError(409, 'An account with this email already exists.', { email: 'This email is already registered. Please sign in.' });
      const passwordHash = await bcrypt.hash(password, 12);
      const user = await User.create({ name, email, passwordHash });
      res.status(201).json(session(user));
    },
    async login(req, res) {
      requireSecret();
      const { email, password } = req.validated;
      const user = await User.findOne({ email }).select('+passwordHash');
      if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new HttpError(401, 'The email or password is incorrect.');
      res.json(session(user));
    },
    async me(req, res) { res.json({ user: userDto(req.user) }); }
  };
}
