import Painting, { CATEGORIES } from '../models/Painting.js';
import { HttpError } from '../utils/errors.js';
export function paintingDto(painting) {
  const value = painting.toObject ? painting.toObject() : painting;
  const seller = value.sellerId;
  const { _id, imagePublicId, sellerId, ...fields } = value;
  return { ...fields, id: String(_id), seller: seller?.name ? { id: String(seller._id), name: seller.name } : { id: String(seller), name: 'Gallery member' } };
}
export function createPaintingController(images) {
  async function removeImage(id) {
    try { await images.remove(id); } catch { console.error('Cloudinary image cleanup failed; retry cleanup for the removed asset.'); }
  }
  return {
    async list(req, res) {
      const { category, status, search, page = '1', limit = '12' } = req.query;
      const filter = {};
      if (category !== undefined && !CATEGORIES.includes(category)) throw new HttpError(400, 'Choose a valid category.');
      if (status !== undefined && !['available', 'sold'].includes(status)) throw new HttpError(400, 'Choose a valid availability status.');
      if (category) filter.category = category;
      if (status) filter.status = status;
      if (search !== undefined) {
        if (typeof search !== 'string' || search.length > 120) throw new HttpError(400, 'Keep your search under 120 characters.');
        filter.title = { $regex: search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
      }
      const number = Number(page), size = Number(limit);
      if (!Number.isInteger(number) || number < 1 || number > 100000 || !Number.isInteger(size) || size < 1 || size > 24) throw new HttpError(400, 'Invalid gallery page.');
      const [paintings, total] = await Promise.all([
        Painting.find(filter).populate('sellerId', 'name').sort({ createdAt: -1, _id: -1 }).skip((number - 1) * size).limit(size),
        Painting.countDocuments(filter)
      ]);
      res.json({ paintings: paintings.map(paintingDto), total, page: number, pages: Math.ceil(total / size) });
    },
    async mine(req, res) {
      const paintings = await Painting.find({ sellerId: req.user._id }).populate('sellerId', 'name').sort({ createdAt: -1, _id: -1 });
      res.json({ paintings: paintings.map(paintingDto) });
    },
    async detail(req, res) {
      const painting = await Painting.findById(req.params.id).populate('sellerId', 'name');
      if (!painting) throw new HttpError(404, 'This painting could not be found.');
      res.json({ painting: paintingDto(painting) });
    },
    async contact(req, res) {
      const painting = await Painting.findById(req.params.id).populate('sellerId', 'name email');
      if (!painting || !painting.sellerId) throw new HttpError(404, 'This seller could not be found.');
      if (painting.status === 'sold') throw new HttpError(409, 'This painting has already been sold.');
      res.json({ name: painting.sellerId.name, email: painting.sellerId.email, title: painting.title });
    },
    async create(req, res) {
      const uploaded = await images.upload(req.file.buffer);
      let painting;
      try { painting = await Painting.create({ ...req.validated, ...uploaded, sellerId: req.user._id }); }
      catch (error) { await removeImage(uploaded.imagePublicId); throw error; }
      await painting.populate('sellerId', 'name');
      res.status(201).json({ painting: paintingDto(painting) });
    },
    async update(req, res) {
      const painting = req.painting;
      const previousId = painting.imagePublicId;
      const uploaded = req.file ? await images.upload(req.file.buffer) : null;
      Object.assign(painting, req.validated, uploaded || {});
      try { await painting.save(); }
      catch (error) { if (uploaded) await removeImage(uploaded.imagePublicId); throw error; }
      if (uploaded && previousId !== uploaded.imagePublicId) await removeImage(previousId);
      await painting.populate('sellerId', 'name');
      res.json({ painting: paintingDto(painting) });
    },
    async remove(req, res) {
      await req.painting.deleteOne();
      await removeImage(req.painting.imagePublicId);
      res.status(204).end();
    }
  };
}
