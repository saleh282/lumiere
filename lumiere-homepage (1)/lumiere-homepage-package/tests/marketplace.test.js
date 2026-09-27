import test from 'node:test';
import assert from 'node:assert/strict';
import { resolve } from 'node:path';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../server/app.js';
import User from '../server/models/User.js';
import Painting from '../server/models/Painting.js';

const secret = 'isolated-test-secret-not-used-outside-tests-2026';
const form = { title: 'Evening Light', description: 'An original oil painting of warm evening light over the sea.', price: '2450', category: 'Seascapes', medium: 'Oil on canvas', dimensions: '60 × 80 cm', year: '2025' };

test('MERN marketplace authentication and owner-only painting lifecycle', async t => {
  const mongo = await MongoMemoryServer.create({ binary: { version: '7.0.14', downloadDir: resolve('.qa/mongodb') } });
  const removed = []; let uploads = 0;
  const media = { ready: true, upload: async () => ({ imageUrl: '/artworks/great-wave.jpg', imagePublicId: `test-upload-${++uploads}` }), remove: async id => { removed.push(id); } };
  const app = createApp({ jwtSecret: secret, images: media });
  const image = await readFile('public/artworks/great-wave.jpg');
  let owner, buyer, paintingId;
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'lumiere_tests' });
    await User.init(); await Painting.init();
    await t.test('registers one account type, returns a JWT, and stores bcrypt hashes', async () => {
      const response = await request(app).post('/api/auth/register').send({ name: 'Artist One', email: 'ARTIST@example.com', password: 'Gallery-Pass-2026', role: 'admin' }).expect(201);
      owner = response.body;
      assert.equal(owner.user.email, 'artist@example.com');
      assert.equal(owner.user.role, undefined);
      assert.equal(owner.user.passwordHash, undefined);
      const decoded = jwt.verify(owner.token, secret, { algorithms: ['HS256'], issuer: 'lumiere', audience: 'lumiere-web' });
      assert.equal(decoded.sub, owner.user.id);
      const stored = await User.findById(owner.user.id).select('+passwordHash');
      assert.match(stored.passwordHash, /^\$2[aby]\$12\$/);
      buyer = (await request(app).post('/api/auth/register').send({ name: 'Collector Two', email: 'buyer@example.com', password: 'Another-Pass-2026' }).expect(201)).body;
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${owner.token}`).expect(200);
    });
    await t.test('validates registration, duplicate emails, passwords, and JWTs', async () => {
      await request(app).post('/api/auth/register').send({ name: '', email: 'invalid', password: 'short' }).expect(422);
      await request(app).post('/api/auth/register').send({ name: 'New User', email: 'new@example.com', password: '😀'.repeat(20) }).expect(422);
      await request(app).post('/api/auth/register').send({ name: 'Duplicate', email: 'artist@example.com', password: 'Another-Pass-2026' }).expect(409);
      await request(app).post('/api/auth/login').send({ email: 'artist@example.com', password: 'Incorrect-Pass-2026' }).expect(401);
      await request(app).post('/api/auth/login').send({ email: 'artist@example.com', password: 'Gallery-Pass-2026' }).expect(200);
      await request(app).get('/api/auth/me').expect(401);
      await request(app).get('/api/auth/me').set('Authorization', 'Bearer forged-token').expect(401);
      const expired = jwt.sign({}, secret, { subject: owner.user.id, expiresIn: -1, issuer: 'lumiere', audience: 'lumiere-web' });
      await request(app).get('/api/auth/me').set('Authorization', `Bearer ${expired}`).expect(401);
    });
    await t.test('requires auth and validates uploads and prices before Cloudinary', async () => {
      await request(app).post('/api/paintings').field(form).attach('image', image, { filename: 'art.jpg', contentType: 'image/jpeg' }).expect(401);
      await request(app).post('/api/paintings').set('Authorization', `Bearer ${owner.token}`).send(form).expect(422);
      await request(app).post('/api/paintings').set('Authorization', `Bearer ${owner.token}`).field({ ...form, price: '0' }).attach('image', image, 'art.jpg').expect(422);
      await request(app).post('/api/paintings').set('Authorization', `Bearer ${owner.token}`).field(form).attach('image', Buffer.from('not a real image'), { filename: 'fake.jpg', contentType: 'image/jpeg' }).expect(415);
      await request(app).post('/api/paintings').set('Authorization', `Bearer ${owner.token}`).field(form).attach('image', Buffer.alloc(8 * 1024 * 1024 + 1), { filename: 'large.jpg', contentType: 'image/jpeg' }).expect(413);
      assert.equal(uploads, 0);
    });
    await t.test('creates a listing and ignores forged owner and asset fields', async () => {
      const result = await request(app).post('/api/paintings').set('Authorization', `Bearer ${owner.token}`).field({ ...form, sellerId: buyer.user.id, imageUrl: 'https://untrusted.example/file', imagePublicId: 'another-users-file' }).attach('image', image, 'art.jpg').expect(201);
      paintingId = result.body.painting.id;
      assert.equal(result.body.painting.seller.id, owner.user.id);
      assert.equal(result.body.painting.seller.name, 'Artist One');
      assert.equal(result.body.painting.imagePublicId, undefined);
      assert.equal(result.body.painting.imageUrl, '/artworks/great-wave.jpg');
      assert.equal(result.body.painting.price, 2450);
    });
    await t.test('public gallery, filters, detail, and /mine routing work', async () => {
      const list = await request(app).get('/api/paintings?category=Seascapes&status=available').expect(200);
      assert.equal(list.body.total, 1);
      assert.equal((await request(app).get('/api/paintings?status=sold').expect(200)).body.total, 0);
      assert.equal((await request(app).get('/api/paintings?search=%5B').expect(200)).body.total, 0);
      await request(app).get('/api/paintings?status=invalid').expect(400);
      await request(app).get('/api/paintings?page=-1').expect(400);
      const detail = await request(app).get(`/api/paintings/${paintingId}`).expect(200);
      assert.equal(detail.body.painting.seller.email, undefined);
      assert.equal((await request(app).get('/api/paintings/mine').set('Authorization', `Bearer ${owner.token}`).expect(200)).body.paintings.length, 1);
      assert.equal((await request(app).get('/api/paintings/mine').set('Authorization', `Bearer ${buyer.token}`).expect(200)).body.paintings.length, 0);
    });
    await t.test('rejects non-owner edits, deletes, and replacement uploads', async () => {
      await request(app).put(`/api/paintings/${paintingId}`).set('Authorization', `Bearer ${buyer.token}`).send({ title: 'Stolen title' }).expect(403);
      await request(app).delete(`/api/paintings/${paintingId}`).set('Authorization', `Bearer ${buyer.token}`).expect(403);
      await request(app).put(`/api/paintings/${paintingId}`).set('Authorization', `Bearer ${buyer.token}`).attach('image', image, 'replacement.jpg').expect(403);
      assert.equal(uploads, 1);
    });
    await t.test('exposes contact only on request to signed-in users', async () => {
      await request(app).get(`/api/paintings/${paintingId}/contact`).expect(401);
      const contact = await request(app).get(`/api/paintings/${paintingId}/contact`).set('Authorization', `Bearer ${buyer.token}`).expect(200);
      assert.equal(contact.body.email, 'artist@example.com');
    });
    await t.test('owner edits, replaces image, and marks sold or available', async () => {
      const updated = await request(app).put(`/api/paintings/${paintingId}`).set('Authorization', `Bearer ${owner.token}`).field({ title: 'New Evening Light', price: '2800' }).attach('image', image, 'replacement.jpg').expect(200);
      assert.equal(updated.body.painting.title, 'New Evening Light');
      assert.equal(updated.body.painting.seller.id, owner.user.id);
      assert.deepEqual(removed, ['test-upload-1']);
      await request(app).put(`/api/paintings/${paintingId}`).set('Authorization', `Bearer ${owner.token}`).send({ status: 'sold' }).expect(200);
      assert.equal((await request(app).get('/api/paintings?status=sold').expect(200)).body.total, 1);
      await request(app).get(`/api/paintings/${paintingId}/contact`).set('Authorization', `Bearer ${buyer.token}`).expect(409);
      await request(app).put(`/api/paintings/${paintingId}`).set('Authorization', `Bearer ${owner.token}`).send({ status: 'available' }).expect(200);
    });
    await t.test('a second account can also sell: no buyer/seller role split', async () => {
      await request(app).post('/api/paintings').set('Authorization', `Bearer ${buyer.token}`).field({ ...form, title: 'A Second Painting' }).attach('image', image, 'art.jpg').expect(201);
      assert.equal((await request(app).get('/api/paintings/mine').set('Authorization', `Bearer ${buyer.token}`).expect(200)).body.paintings.length, 1);
    });
    await t.test('deletes owned listings and cleans up image references', async () => {
      await request(app).delete(`/api/paintings/${paintingId}`).set('Authorization', `Bearer ${owner.token}`).expect(204);
      assert.ok(removed.includes('test-upload-2'));
      await request(app).get(`/api/paintings/${paintingId}`).expect(404);
      await request(app).get('/api/paintings/invalid-id').expect(400);
    });
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});
