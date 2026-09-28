import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../server/app.js';

test('development client origin is accepted through the API proxy', async () => {
  const app = createApp({ jwtSecret: 'test-secret-with-at-least-thirty-two-characters', images: { ready: false } });
  const response = await request(app).post('/api/auth/logout').set('Host', '127.0.0.1:3001').set('Origin', 'http://127.0.0.1:5174');
  assert.equal(response.status, 503); // Accepted by origin guard; no MongoDB in this isolated test.
  assert.equal(response.body.code, 'DATABASE_UNAVAILABLE');
});

test('unrelated origins are rejected', async () => {
  const app = createApp({ jwtSecret: 'test-secret-with-at-least-thirty-two-characters', images: { ready: false } });
  const response = await request(app).post('/api/auth/logout').set('Host', '127.0.0.1:3001').set('Origin', 'https://untrusted.example');
  assert.equal(response.status, 403);
  assert.match(response.body.message, /Lumière/);
});
