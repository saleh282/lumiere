import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { HttpError } from '../utils/errors.js';
import { config } from '../config/env.js';
export const userDto = user => ({ id: String(user._id), name: user.name, email: user.email, createdAt: user.createdAt });
const cookieOptions = `HttpOnly; SameSite=Strict; Path=/api; Max-Age=604800${config.production ? '; Secure' : ''}`;
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
