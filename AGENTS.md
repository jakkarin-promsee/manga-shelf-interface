# Agent guide — Manga Shelf

This file is a handoff for agents working in this folder. Start with `README.md` for the user-facing product tour and setup instructions.

## Project map

- `src/main.jsx` — React UI and client-side behavior: category/card editing, search, drag and drop, chapter controls, card-size slider, and tab-return refresh.
- `src/style.css` — the responsive dark-blue theme and layout.
- `server.mjs` — Node HTTP server, JSON API, persistence, static files, and managed cover images.
- `dev.mjs` and `vite.config.js` — development server and API/cover proxy.
- `dist/` — prebuilt frontend served by `server.mjs`. Update it with `npm run build` after changing `src/`.
- `docs/` — actual UI screenshots embedded in `README.md`; refresh them if the documented interface changes substantially.

## Run and verify

- Ready-to-run app: `node server.mjs`, then open `http://127.0.0.1:4174/`. The server binds to `127.0.0.1` and needs Node.js 20+; the included build does not need `npm install`.
- Source development: `npm install` if dependencies are absent, then `npm run dev`. This starts the API on port 4174 and Vite with `/api` and `/covers` proxied to it.
- Before finishing a source change, run `npm run build` and check the relevant flow in the browser. There is no automated test suite at present. For server changes, `node --check server.mjs` is a useful quick syntax check.
- If port 4174 is already occupied, inspect the existing process before starting another server. The user commonly keeps the app open there.

## Data model and care

- `data/manga.txt` is a JSON array containing manga records and card order. It is ignored by Git and contains the user's live collection. Do not reset, replace, or commit it.
- `data/config.json` stores category names/order and card width. Treat the current file as user state; do not replace it with sample settings.
- `data/covers/` holds local copies of covers in use. Uploaded and URL-sourced images are managed by the server. Cover cleanup removes unreferenced files, so avoid manually deleting or renaming files here. `data/cover-staging/` holds temporary uploads and is ignored by Git.
- When backing up or moving a collection, preserve `data/manga.txt`, `data/config.json`, and `data/covers/` together.
- Prefer a disposable data copy or read-only checks for experiments. Do not create test manga or categories in the user's live collection unless the task requires it, and clean up any test data you add.

## Product behavior to preserve

- The UI is currently in Thai; `README.md` is intentionally in English.
- The main category has id `main`, stays first, and cannot be deleted. Custom categories can be renamed, reordered by dragging their headers, and deleted; deleting one moves its cards to main.
- Cards can be dragged within or across categories. During a drag, scrolling near the viewport edge and using the mouse wheel should work. Reordering is disabled while search is active.
- Clicking a card opens its reading URL in a new tab, or opens its editor when no URL is set. The cover pencil always opens the editor. Chapter controls support `−`, `+`, and exact entry; chapter `0` displays an unknown-chapter label in the chapter row only.
- The add-manga tile belongs to each category. The sticky top bar contains Add Category and Search. The bottom-right slider changes card width and persists it in config.
- Returning to the browser tab after at least 1.5 seconds hidden refreshes the page, except while a modal or inline chapter edit is open.
- The server stores uploaded and URL-sourced covers locally and removes unused covers. Keep cover validation and safe remote fetching intact when changing this code.

## Repository boundary

On this machine, `git rev-parse --show-toplevel` resolves to `C:/Users/BTCOM`, above this project. Avoid broad Git operations that could include unrelated files from the home directory. Check project paths explicitly before staging, moving, or deleting anything.
