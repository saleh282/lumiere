import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { once } from 'node:events';
import { mkdir, unlink } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createApi } from '../server/api.mjs';

// Each run gets an isolated database; no real accounts are touched.
test('registration, sessions, and account-private favorites', async t => {
  await mkdir('.qa', { recursive: true });
  const file = resolve('.qa', `auth-${randomUUID()}.sqlite`);
  let api, server, origin;
  async function start() {
    api = createApi({ databasePath: file });
    server = http.createServer(api.handle);
    server.listen(0, '127.0.0.1');
    await once(server, 'listening');
    origin = `http://127.0.0.1:${server.address().port}`;
  }
  async function stop() { await new Promise(done => server.close(done)); api.close(); }
  async function request(path, { method = 'GET', body, cookie, headers = {} } = {}) {
    const response = await fetch(origin + path, { method, headers: { 'Content-Type': 'application/json', Origin: origin, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: body === undefined ? undefined : JSON.stringify(body) });
    return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie') };
  }
  let cookie, secondCookie;
  try {
    await start();
    await t.test('validates data on the server', async () => {
      const invalid = await request('/api/register', { method: 'POST', body: { name: 'A', email: 'not-an-email', password: '123' } });
      assert.equal(invalid.status, 400);
      assert.equal((await request('/api/favorites', { method: 'PUT', body: { favorites: [] } })).status, 401);
    });
    await t.test('registers and issues a private cookie without exposing credentials', async () => {
      const result = await request('/api/register', { method: 'POST', body: { name: 'Gallery Tester', email: 'FIRST@example.com ', password: 'Correct-Horse-2026' } });
      assert.equal(result.status, 201);
      assert.equal(result.body.user.email, 'first@example.com');
      assert.match(result.cookie, /HttpOnly/);
      assert.match(result.cookie, /SameSite=Strict/);
      assert.deepEqual(Object.keys(result.body.user).sort(), ['email', 'id', 'name']);
      cookie = result.cookie.split(';')[0];
      const inspect = new DatabaseSync(file);
      const row = inspect.prepare('SELECT * FROM users WHERE email = ?').get('first@example.com');
      assert.notEqual(row.password_hash, 'Correct-Horse-2026');
      assert.equal(row.password_hash.length, 128);
      assert.equal(row.salt.length, 32);
      inspect.close();
    });
    await t.test('rejects duplicate emails and wrong passwords', async () => {
      const duplicate = await request('/api/register', { method: 'POST', body: { name: 'Another name', email: 'First@Example.com', password: 'Different-Password' } });
      assert.equal(duplicate.status, 409);
      const invalid = await request('/api/login', { method: 'POST', body: { email: 'first@example.com', password: 'Wrong-Password-123' } });
      assert.equal(invalid.status, 401);
    });
    await t.test('protects mutations and validates favorite titles', async () => {
      assert.equal((await request('/api/favorites', { method: 'PUT', cookie, headers: { Origin: 'https://untrusted.example' }, body: { favorites: [] } })).status, 403);
      assert.equal((await request('/api/favorites', { method: 'PUT', cookie, body: { favorites: ['Nonexistent painting'] } })).status, 400);
      assert.equal((await request('/api/favorites', { method: 'PUT', cookie, body: { favorites: ['The Starry Night'] } })).status, 200);
      assert.deepEqual((await request('/api/me', { cookie })).body.favorites, ['The Starry Night']);
    });
    await t.test('keeps collections private to each account', async () => {
      const result = await request('/api/register', { method: 'POST', body: { name: 'Second Tester', email: 'second@example.com', password: 'Another-Password-2026' } });
      secondCookie = result.cookie.split(';')[0];
      assert.deepEqual((await request('/api/me', { cookie: secondCookie })).body.favorites, []);
      assert.deepEqual((await request('/api/me', { cookie })).body.favorites, ['The Starry Night']);
    });
    await t.test('persists sessions and favorites across server restarts', async () => {
      await stop(); await start();
      const result = await request('/api/me', { cookie });
      assert.equal(result.body.user.email, 'first@example.com');
      assert.deepEqual(result.body.favorites, ['The Starry Night']);
    });
    await t.test('logs out, invalidates the session, and permits signing back in', async () => {
      assert.equal((await request('/api/logout', { method: 'POST', cookie, body: {} })).status, 200);
      assert.equal((await request('/api/me', { cookie })).body.user, null);
      const login = await request('/api/login', { method: 'POST', body: { email: 'first@example.com', password: 'Correct-Horse-2026' } });
      assert.equal(login.status, 200);
      assert.deepEqual(login.body.favorites, ['The Starry Night']);
    });
  } finally {
    if (server?.listening) await stop();
    for (const suffix of ['', '-wal', '-shm']) await unlink(file + suffix).catch(() => {});
  }
});
