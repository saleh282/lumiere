# Lumière Marketplace

A React + Vite and Node.js marketplace for original paintings. All live application data, including uploaded images, is stored in MongoDB. Images use GridFS in the same cluster as listings and accounts.

## Project folders

- `client/`: React pages, styles, static images, and Vite configuration.
- `server/`: Express API, MongoDB models, authentication, and image uploads.
- `scripts/` and `tests/`: commands and integration tests shared by the project. Keep running npm commands from the project root.

## Setup

Requires Node.js 22.13 or newer and a MongoDB connection string.
The API uses a MongoDB database named `lumiere` by default, even when the connection URI omits a database name. Set `MONGO_DB_NAME` to override it.

1. Run `npm ci`.
2. Copy `.env.example` to `.env` and fill in the values.
3. Run `npm run dev` and open http://127.0.0.1:5174.

For a production build, run `npm run build` followed by `npm start`. The application is served at `HOST:PORT` (defaults to 127.0.0.1:3001). Keep `.env` private.

## Marketplace

Guests can browse available paintings, search by title, filter by category, location, and price, and sort by price. One account can both sell and buy. Registered members can publish paintings, edit or remove their own listings, mark them sold, save favorites, and request seller contact details. Sellers can see contact requests in My listings. There is no checkout or payment processing; transactions are arranged directly.

Accounts use bcrypt password hashes and seven-day JWTs in HttpOnly, SameSite cookies. Mutating requests are origin checked; account and listing writes are rate limited. Form validation and ownership checks run on the server. Uploaded images are checked for type and size before being saved to MongoDB GridFS.

The API is under `/api`: authentication at `/auth`, listings at `/paintings`, MongoDB images at `/images`, favorites at `/favorites`, and seller inquiries at `/inquiries/mine`. `/api/health` reports database, authentication, and image storage readiness.

## Verification

Run `npm test` for the isolated MongoDB integration tests and `npm run build` for the frontend build. The test suite uses mongodb-memory-server and may download its MongoDB binary on the first run.

The bundled art images in `client/public/artworks` are decorative imagery for the landing page. They are not sale listings. Actual listings come only from MongoDB.
