import { DatabaseSync } from 'node:sqlite';
import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { artworks } from '../src/artworks.js';

const scrypt = promisify(scryptCallback);
const SESSION_SECONDS = 60 * 60 * 24 * 7;
const cookieName = 'lumiere_session';
const hash = value => createHash('sha256').update(value).digest('hex');
const publicUser = row => ({ id: row.id, name: row.name, email: row.email });
const validTitles = new Set(artworks.map(art => art.title));

export function createApi({ databasePath = process.env.DATABASE_PATH || resolve('data/lumiere.sqlite'), secureCookies = process.env.COOKIE_SECURE === 'true' } = {}) {
  if (databasePath !== ':memory:') mkdirSync(dirname(databasePath), { recursive: true });
  const db = new DatabaseSync(databasePath);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL, salt TEXT NOT NULL, created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      expires_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS favorites (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL, PRIMARY KEY(user_id, title)
    );
  `);
  const attempts = new Map();
  const cookie = (value, age) => `${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secureCookies ? '; Secure' : ''}`;
  function reply(res, status, body) {
    res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
    res.end(JSON.stringify(body));
  }
  function session(req) {
    const token = (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(`${cookieName}=`))?.slice(cookieName.length + 1);
    if (!token || !/^[a-f0-9]{64}$/.test(token)) return null;
    return db.prepare('SELECT users.*, sessions.token_hash FROM sessions JOIN users ON users.id = sessions.user_id WHERE token_hash = ? AND expires_at > ?').get(hash(token), Date.now());
  }
  function startSession(res, userId) {
    db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(Date.now());
    const token = randomBytes(32).toString('hex');
    db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(hash(token), userId, Date.now() + SESSION_SECONDS * 1000);
    res.setHeader('Set-Cookie', cookie(token, SESSION_SECONDS));
  }
  const favorites = id => db.prepare('SELECT title FROM favorites WHERE user_id = ? ORDER BY rowid').all(id).map(row => row.title).filter(title => validTitles.has(title));
  async function body(req) {
    if (!req.headers['content-type']?.startsWith('application/json')) throw Object.assign(new Error('Please send JSON data.'), { status: 415 });
    const chunks = []; let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 8192) throw Object.assign(new Error('Request is too large.'), { status: 413 });
      chunks.push(chunk);
    }
    try {
      const result = JSON.parse(Buffer.concat(chunks).toString('utf8'));
      if (!result || Array.isArray(result) || typeof result !== 'object') throw new Error();
      return result;
    } catch { throw Object.assign(new Error('Please check the submitted data.'), { status: 400 }); }
  }
  function allowAttempt(req, route) {
    const now = Date.now();
    for (const [key, item] of attempts) if (item.until < now) attempts.delete(key);
    const key = `${req.socket.remoteAddress}:${route}`;
    const item = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    item.count++; attempts.set(key, item);
    return item.count <= (route === '/api/register' ? 8 : 20);
  }
  async function handle(req, res) {
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (!['GET', 'HEAD'].includes(req.method) && req.headers.origin) {
        let sameOrigin = false;
        try { sameOrigin = new URL(req.headers.origin).host === req.headers.host; } catch {}
        if (!sameOrigin) return reply(res, 403, { message: 'This request is not allowed.' });
      }
      if (path === '/api/me' && req.method === 'GET') {
        const user = session(req);
        return reply(res, 200, { user: user ? publicUser(user) : null, favorites: user ? favorites(user.id) : [] });
      }
      if (['/api/register', '/api/login'].includes(path) && req.method === 'POST') {
        if (!allowAttempt(req, path)) { res.setHeader('Retry-After', '900'); return reply(res, 429, { message: 'Too many attempts. Please try again in 15 minutes.' }); }
        const input = await body(req);
        const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
        const password = typeof input.password === 'string' ? input.password : '';
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return reply(res, 400, { message: 'Enter a valid email address.', field: 'email' });
        if (password.length < 10 || password.length > 128) return reply(res, 400, { message: 'Use a password between 10 and 128 characters.', field: 'password' });
        if (path === '/api/register') {
          const name = typeof input.name === 'string' ? input.name.trim() : '';
          if (name.length < 2 || name.length > 80) return reply(res, 400, { message: 'Your name should be between 2 and 80 characters.', field: 'name' });
          if (db.prepare('SELECT id FROM users WHERE email = ?').get(email)) return reply(res, 409, { message: 'An account with this email already exists. Please sign in.', field: 'email' });
          const salt = randomBytes(16).toString('hex');
          const passwordHash = (await scrypt(password, salt, 64)).toString('hex');
          let result;
          try { result = db.prepare('INSERT INTO users (name,email,password_hash,salt,created_at) VALUES (?,?,?,?,?)').run(name, email, passwordHash, salt, Date.now()); }
          catch (error) { if (error.message.includes('UNIQUE')) return reply(res, 409, { message: 'An account with this email already exists. Please sign in.', field: 'email' }); throw error; }
          const id = Number(result.lastInsertRowid);
          startSession(res, id);
          return reply(res, 201, { user: { id, name, email }, favorites: [] });
        }
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        const computed = await scrypt(password, user?.salt || '00000000000000000000000000000000', 64);
        if (!user || !timingSafeEqual(computed, Buffer.from(user.password_hash, 'hex'))) return reply(res, 401, { message: 'The email or password is incorrect.' });
        startSession(res, user.id);
        return reply(res, 200, { user: publicUser(user), favorites: favorites(user.id) });
      }
      if (path === '/api/logout' && req.method === 'POST') {
        const user = session(req);
        if (user) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(user.token_hash);
        res.setHeader('Set-Cookie', cookie('', 0));
        return reply(res, 200, { ok: true });
      }
      if (path === '/api/favorites' && req.method === 'PUT') {
        const user = session(req);
        if (!user) return reply(res, 401, { message: 'Please sign in again to save your collection.' });
        const { favorites: titles } = await body(req);
        if (!Array.isArray(titles) || titles.length > validTitles.size || titles.some(title => typeof title !== 'string' || !validTitles.has(title))) return reply(res, 400, { message: 'Please select artworks from the collection.' });
        db.exec('BEGIN');
        try {
          db.prepare('DELETE FROM favorites WHERE user_id = ?').run(user.id);
          const insert = db.prepare('INSERT OR IGNORE INTO favorites (user_id,title) VALUES (?,?)');
          for (const title of titles) insert.run(user.id, title);
          db.exec('COMMIT');
        } catch (error) { db.exec('ROLLBACK'); throw error; }
        return reply(res, 200, { favorites: favorites(user.id) });
      }
      return reply(res, 404, { message: 'This endpoint does not exist.' });
    } catch (error) {
      if (!error.status) console.error('API request failed:', error.code || error.name);
      if (!res.headersSent) reply(res, error.status || 500, { message: error.status ? error.message : 'Something went wrong. Please try again.' });
      else res.end();
    }
  }
  return { handle, close: () => db.close() };
}
