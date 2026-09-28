// One-time, non-destructive copy of Lumière records from the old default "test" database.
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { config } from '../server/config/env.js';

if (!config.mongoUri) throw new Error('MONGO_URI is required.');
if (config.mongoDbName === 'test') throw new Error('Choose a destination database other than test.');

await mongoose.connect(config.mongoUri, { dbName: 'test', serverSelectionTimeoutMS: 10000 });
try {
  const client = mongoose.connection.getClient();
  const source = client.db('test');
  const target = client.db(config.mongoDbName);
  const users = await source.collection('users').find({ passwordHash: { $type: 'string' } }).toArray();
  const userIds = users.map(item => item._id);
  const paintings = await source.collection('paintings').find({ sellerId: { $in: userIds } }).toArray();
  const paintingIds = paintings.map(item => item._id);
  const favorites = await source.collection('favorites').find({ userId: { $in: userIds }, paintingId: { $in: paintingIds } }).toArray();
  const inquiries = await source.collection('inquiries').find({ sellerId: { $in: userIds }, paintingId: { $in: paintingIds } }).toArray();
  const imageIds = paintings.map(item => item.imagePublicId).filter(id => typeof id === 'string' && id.startsWith('mongo:')).map(id => new mongoose.Types.ObjectId(id.slice(6)));
  const files = await source.collection('paintingImages.files').find({ _id: { $in: imageIds } }).toArray();
  const chunks = await source.collection('paintingImages.chunks').find({ files_id: { $in: imageIds } }).toArray();
  if (files.length !== imageIds.length) throw new Error('Some listing images are missing in the source database.');

  const collections = { users, 'paintingImages.files': files, 'paintingImages.chunks': chunks, paintings, favorites, inquiries };
  for (const [name, docs] of Object.entries(collections)) {
    for (const doc of docs) await target.collection(name).updateOne({ _id: doc._id }, { $setOnInsert: doc }, { upsert: true });
    const count = docs.length ? await target.collection(name).countDocuments({ _id: { $in: docs.map(doc => doc._id) } }) : 0;
    if (count !== docs.length) throw new Error(`Copy verification failed for ${name}.`);
  }

  const sourceBucket = new mongoose.mongo.GridFSBucket(source, { bucketName: 'paintingImages' });
  const targetBucket = new mongoose.mongo.GridFSBucket(target, { bucketName: 'paintingImages' });
  const checksum = async (bucket, id) => {
    const hash = createHash('sha256');
    for await (const chunk of bucket.openDownloadStream(id)) hash.update(chunk);
    return hash.digest('hex');
  };
  for (const id of imageIds) {
    if (await checksum(sourceBucket, id) !== await checksum(targetBucket, id)) throw new Error('Image copy verification failed.');
  }

  await Promise.all([
    target.collection('users').createIndex({ email: 1 }, { unique: true }),
    target.collection('favorites').createIndex({ userId: 1, paintingId: 1 }, { unique: true }),
    target.collection('inquiries').createIndex({ paintingId: 1, buyerId: 1 }, { unique: true }),
    target.collection('paintingImages.files').createIndex({ filename: 1, uploadDate: 1 }),
    target.collection('paintingImages.chunks').createIndex({ files_id: 1, n: 1 }, { unique: true })
  ]);
  console.log(JSON.stringify({ source: 'test', destination: config.mongoDbName, copied: Object.fromEntries(Object.entries(collections).map(([name, docs]) => [name, docs.length])), verifiedImages: imageIds.length }, null, 2));
} finally {
  await mongoose.disconnect();
}
