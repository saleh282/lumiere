import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { createApp } from '../server/app.js';
import User from '../server/models/User.js';
import Painting from '../server/models/Painting.js';
import { createMongoImageService } from '../server/services/mongoImages.js';

const secret = 'isolated-test-secret-not-used-outside-tests-2026';
const form = { title: 'Evening Light', description: 'An original oil painting of warm evening light over the sea.', price: '2450', category: 'Seascapes', medium: 'Oil on canvas', dimensions: '60 × 80 cm', location: 'Cairo, Heliopolis' };
const credentials = (name, email) => ({ name, email, password: 'Gallery-Pass-2026', confirmPassword: 'Gallery-Pass-2026' });

test('MongoDB marketplace: sessions, listings, favorites, and contact requests', async t => {
  const mongo = await MongoMemoryServer.create();
  const removed = []; let uploads = 0;
  const images = { ready: true, upload: async () => ({ imageUrl: '/artworks/great-wave.jpg', imagePublicId: 'test-' + ++uploads }), remove: async id => { removed.push(id); } };
  const app = createApp({ jwtSecret: secret, images });
  const image = await readFile('client/public/artworks/great-wave.jpg');
  const account = async input => {
    const response = await request(app).post('/api/auth/register').send(input).expect(201);
    assert.match(response.headers['set-cookie'][0], /HttpOnly/);
    assert.match(response.headers['set-cookie'][0], /SameSite=Strict/);
    assert.equal(response.body.token, undefined);
    return { ...response.body.user, cookie: response.headers['set-cookie'][0].split(';')[0] };
  };
  try {
    await mongoose.connect(mongo.getUri(), { dbName: 'lumiere_tests' });
    await User.init(); await Painting.init();
    await t.test('stores and serves images in MongoDB', async () => {
      const mongoImages = createMongoImageService();
      const uploaded = await mongoImages.upload(image, 'image/jpeg');
      try {
        assert.match(uploaded.imageUrl, /^\/api\/images\//);
        const response = await request(createApp({ jwtSecret: secret, images: mongoImages })).get(uploaded.imageUrl).expect(200);
        assert.match(response.headers['content-type'], /image\/jpeg/);
        assert.equal(response.body.length, image.length);
      } finally { await mongoImages.remove(uploaded.imagePublicId); }
    });
    const owner = await account(credentials('Artist One', 'ARTIST@example.com'));
    const buyer = await account(credentials('Collector Two', 'buyer@example.com'));
    assert.equal(owner.email, 'artist@example.com');
    assert.match((await User.findById(owner.id).select('+passwordHash')).passwordHash, /^\$2[aby]\$12\$/);
    await request(app).post('/api/auth/register').send({ ...credentials('A', 'invalid'), confirmPassword: 'wrong' }).expect(422);
    await request(app).get('/api/auth/me').expect(401);
    await request(app).get('/api/auth/me').set('Cookie', owner.cookie).expect(200);

    await t.test('server validation and ownership', async () => {
      await request(app).post('/api/paintings').field(form).attach('image', image, 'art.jpg').expect(401);
      await request(app).post('/api/paintings').set('Cookie', owner.cookie).field({ ...form, location: '' }).attach('image', image, 'art.jpg').expect(422);
      assert.equal(uploads, 0);
    });
    const created = await request(app).post('/api/paintings').set('Cookie', owner.cookie).field(form).attach('image', image, 'art.jpg').expect(201);
    const id = created.body.painting.id;
    assert.equal(created.body.painting.location, form.location);
    assert.equal(created.body.painting.imagePublicId, undefined);
    await request(app).put('/api/paintings/' + id).set('Cookie', buyer.cookie).send({ title: 'Stolen' }).expect(403);
    await request(app).delete('/api/paintings/' + id).set('Cookie', buyer.cookie).expect(403);

    await t.test('public filters and private favorites', async () => {
      assert.equal((await request(app).get('/api/paintings?location=Heliopolis&minPrice=2000&maxPrice=3000').expect(200)).body.total, 1);
      assert.equal((await request(app).get('/api/paintings?location=Alexandria').expect(200)).body.total, 0);
      await request(app).get('/api/paintings?minPrice=-1').expect(400);
      await request(app).put('/api/favorites').send({ paintingId: id, saved: true }).expect(401);
      await request(app).put('/api/favorites').set('Cookie', buyer.cookie).send({ paintingId: id, saved: true }).expect(200);
      assert.equal((await request(app).get('/api/favorites').set('Cookie', buyer.cookie).expect(200)).body.paintings.length, 1);
      assert.equal((await request(app).get('/api/favorites').set('Cookie', owner.cookie).expect(200)).body.paintings.length, 0);
    });
    await t.test('contact request reaches seller and sold work cannot be contacted', async () => {
      await request(app).get('/api/paintings/' + id + '/contact').expect(401);
      const contact = await request(app).get('/api/paintings/' + id + '/contact').set('Cookie', buyer.cookie).expect(200);
      assert.equal(contact.body.email, owner.email);
      const inquiries = await request(app).get('/api/inquiries/mine').set('Cookie', owner.cookie).expect(200);
      assert.equal(inquiries.body.inquiries[0].buyer.email, buyer.email);
      await request(app).put('/api/paintings/' + id).set('Cookie', owner.cookie).send({ status: 'sold' }).expect(200);
      assert.equal((await request(app).get('/api/paintings').expect(200)).body.total, 0);
      await request(app).get('/api/paintings/' + id + '/contact').set('Cookie', buyer.cookie).expect(409);
    });
    await request(app).delete('/api/paintings/' + id).set('Cookie', owner.cookie).expect(204);
    assert.deepEqual(removed, ['test-1']);
    assert.equal((await request(app).get('/api/favorites').set('Cookie', buyer.cookie).expect(200)).body.paintings.length, 0);
    const logout = await request(app).post('/api/auth/logout').set('Cookie', buyer.cookie).expect(200);
    assert.match(logout.headers['set-cookie'][0], /Max-Age=0/);
  } finally { await mongoose.disconnect(); await mongo.stop(); }
});
