# Lumière

A React + Vite art gallery with a local Node.js/SQLite account service.

## Run

Requires Node.js 22.13 or newer (tested with 22.23.2).

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5174/. Vite serves both the React app and `/api` endpoints. Opening `index.html` directly or hosting only `dist/` will not provide account features.

```sh
npm test
npm run build
npm start
```

`npm start` serves the production build and account API at http://127.0.0.1:3000/. `npm run preview` also includes the account API for local preview.

## Features

- Nine paintings with local images, artists, descriptions, and illustrative EGP print prices.
- Category edits, artist spotlights, searchable collection, price sorting, and illustrated journal articles.
- Registration with full name, email, password, and matching password confirmation.
- Sign-in, persistent seven-day sessions, account view, and sign-out.
- Private, server-stored favorites for each signed-in account. Guest favorites remain local to the browser and are kept separate from account favorites.
- Responsive layouts, keyboard-accessible dialogs, field errors, loading states, and empty-state recovery.

## Account service

`server/api.mjs` uses SQLite and asynchronous scrypt password derivation with a random salt per account. Sessions use random tokens, store only token hashes in the database, and are sent using HttpOnly, SameSite=Strict cookies. Mutations check request origins. Authentication endpoints have per-IP attempt limits and validate data on the server.

The database is created automatically at `data/lumiere.sqlite`. The `data/` directory is excluded from Git. Preserve this directory across restarts/deployments to retain accounts. `DATABASE_PATH` can select a different persistent database file. Do not place the database in `public/`.

For public hosting, run the Node service with persistent storage behind HTTPS and set `COOKIE_SECURE=true`. `HOST` and `PORT` configure the production listener (defaults: `127.0.0.1`, `3000`). This is a single-server implementation; production scale and distributed rate limiting are not configured. Email verification, password recovery, payments, and checkout are not implemented. No messages are sent to registered email addresses.

## Source layout

- `src/artworks.js`: catalog, prices, image paths, and source filenames.
- `src/App.jsx`: gallery, search, filters, and account/favorites state.
- `src/components/AuthDialog.jsx`: registration, login, and account UI.
- `src/components/Discover.jsx`: illustrated edits, artists, journal, and membership sections.
- `src/styles.css` and `src/expanded.css`: responsive styling.
- `server/api.mjs`: account API and database schema.
- `server/start.mjs`: production static server and API.
- `tests/auth.test.mjs`: isolated account, validation, session, and privacy tests.

## Images

Artwork files are included in `public/artworks/`. Sources are listed in `public/artworks/SOURCES.md` and linked from each artwork detail. Gallery images load without external image services. Google Fonts is optional; system fonts are the fallback. Category and editorial images are crops of the catalog artworks; full artwork details preserve the whole image.

Prices and availability are sample print data, not offers to sell historic originals.
