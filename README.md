# Manga Shelf

**A quiet place to remember what you read and where you stopped.**  
Local-first · No account · No database · Download and run

Manga Shelf is a personal, local-first manga tracker. Keep your titles, reading links, notes, covers, and last finished chapters in a collection you can arrange your way. Update chapter progress with one click using the **−** and **+** buttons. The app runs on your computer, with no account or database to set up.

The current interface is in Thai; this guide is in English.

![Manga Shelf showing the toolbar, categories, manga cards, and add tiles](docs/01-shelf-overview.webp)

## Get started

1. **Download** this repository with **Code → Download ZIP**, then extract it. If you already have the project folder, use that instead.
2. Install **Node.js 20 or newer** if it is not already installed.
3. Open a terminal in the `manga-artifact` folder and run:

   ```sh
   node server.mjs
   ```

4. Open **[http://127.0.0.1:4174](http://127.0.0.1:4174)** or **[http://localhost:4174](http://localhost:4174)** in your browser.

The ready-to-run site is included in `dist/`. Once Node.js is installed, you can start the app without running `npm install` or setting up an account or database. Keep the terminal open while using the site; stop the server with `Ctrl+C`.

### Start with an empty collection

This repository tracks the saved collection, so a clone includes its manga, categories, and covers. If you want a blank shelf, use the reset script **before starting the server**. First preview exactly which local paths it will clear:

```sh
node scripts/reset-data.mjs
```

To perform the reset, run:

```sh
node scripts/reset-data.mjs --erase-local-data
```

The second command requires an interactive terminal. It asks you to enter a deletion phrase **and** the full project path exactly; piped input will not work. It also refuses to run if the app's port is in use. The reset empties `data/manga.txt`, restores `data/config.json` to one Main category with the default card size, and removes files from `data/covers/` and `data/cover-staging/`. **This permanently deletes your local collection and covers.** Back up the data files listed below first if you may need them later.

## Use cases

These screenshots were captured from the running app with Playwright at 2× resolution. The collection was copied to a separate demo instance before the pictured edits, so the original records and settings were not changed.

### Add a manga

1. Find the category where the title belongs and click its **เพิ่มมังงะ** (Add manga) tile.
2. Enter a title and the last chapter you finished. Use `0` if you do not remember the chapter.
3. Optionally add a reading URL, personal note, and cover. Upload a PNG/JPEG/WebP file or paste an image URL for the cover.
4. Click **บันทึก** (Save). The new card appears in that category.

![The Add manga dialog filled with a title, chapter, reading URL, and note](docs/03-add-manga-filled.webp)

![The new sample manga card on the shelf](docs/04-manga-added.webp)

The server stores uploaded and URL-sourced covers locally. A title without a cover gets a built-in fallback card.

### Open, edit, or remove a manga

- Click a card to open its reading URL in a new tab. If no URL is set, clicking the card opens its editor instead.
- Click the pencil on a card cover to edit its title, chapter, URL, cover, or note at any time.
- To remove a manga, open the editor, click **ลบเรื่อง** (Delete manga), and confirm. This removes the record from the shelf.

![The Edit manga dialog with its fields and Delete manga action](docs/19-delete-manga-form.webp)

### Update chapter progress

Use the **−** and **+** buttons on the card for a one-chapter change. The number updates immediately and is saved. The minus button is disabled at chapter `0`.

![A manga card before increasing its chapter](docs/06-chapter-controls.webp)

![The same card after using the plus button](docs/07-chapter-increased.webp)

For a larger jump, click the chapter label, enter the exact number, then press **Enter** or the check button. Setting chapter `0` shows **จำไม่ได้** (unknown) in the card's chapter row.

![The inline field for entering an exact chapter number](docs/08-chapter-exact-entry.webp)

### Add, rename, and arrange categories

Click **เพิ่มหมวด** (Add category) in the sticky top bar, enter a name, and save. Every category has its own Add manga tile. The **หมวดหลัก** (Main) category always stays first.

![The Add category dialog](docs/10-add-category-form.webp)

![A newly created category with its own Add manga tile](docs/11-category-added.webp)

Use the pencil in a category header to rename it. Drag a custom category by its header to change category order; Main remains at the top.

![The Rename category dialog](docs/12-rename-category.webp)

### Reorder or move manga cards

Hold the left mouse button on a card and drag it to a new position in the same category or into another category. The order is saved after you drop it. Moving near the viewport edge scrolls the page; the mouse wheel works during a drag too. Clear the search box before dragging, because reordering is disabled during search.

![A sample manga card at the end of Main before dragging](docs/13-drag-manga-before.webp)

![The same card at the beginning of Main after dragging](docs/14-drag-manga-after.webp)

### Delete a category

Click **×** in a custom category header and confirm. Its manga move to Main, and the category disappears. Main itself cannot be deleted.

![A custom category containing a sample card before deletion](docs/17-delete-category-before.webp)

![The sample card back in Main after its category was deleted](docs/18-delete-category-after.webp)

### Find manga and change card size

Type part of a title in **ค้นหามังงะ** (Search) in the top bar. The shelf shows matching cards and their categories. Clear the field to see everything again and to enable dragging.

![Search filtering the shelf by manga title](docs/15-search.webp)

Drag the **ขนาดการ์ด** (Card size) slider at the bottom right to make cards narrower or wider. Its value is saved and restored on the next visit.

![The shelf with the card size slider set to a wider value](docs/16-card-size.webp)

## Local data and covers

| Path                  | Purpose                                                                                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `data/manga.txt`      | Manga records, chapter progress, reading links, notes, category membership, and card order. It contains JSON in a plain text file.                                                                                                                                 |
| `data/config.json`    | Category names and order, plus the selected card width.                                                                                                                                                                                                            |
| `data/covers/`        | Local copies of the covers currently used by manga in your collection. Uploaded files and images supplied by URL are copied here automatically, so the displayed cover does not depend on its original link or file path. Unused covers are removed automatically. |
| `data/cover-staging/` | Temporary uploads awaiting a save; stale files are cleaned up automatically.                                                                                                                                                                                       |

**Moving to another computer?** Copy `data/manga.txt`, `data/config.json`, and `data/covers/` together, or use a Git commit containing all three as a backup snapshot. Your collection data is stored on the computer running the server. These paths are tracked by Git, so anyone who can access the repository can also see the collection saved in its history. `data/cover-staging/` remains ignored because it only holds temporary uploads.

When you return to the browser tab after it has been hidden for at least 1.5 seconds, the page refreshes once to pick up local changes. An open editor or in-progress chapter edit is left alone.

## Develop or customize

The React + Tailwind source and prebuilt site use the same local API and data files.

```sh
npm install
npm run dev      # local API + Vite development server
npm run build    # update the ready-to-run dist/ files
npm start        # serve the built site
```

| Location                        | What's inside                                                        |
| ------------------------------- | -------------------------------------------------------------------- |
| `src/main.jsx`, `src/style.css` | React UI, interactions, layout, and theme.                           |
| `server.mjs`                    | Local HTTP server, JSON API, persistence, and managed cover storage. |
| `dev.mjs`, `vite.config.js`     | Development startup and Vite configuration.                          |
| `scripts/reset-data.mjs`        | Preview or interactively reset local collection data.                 |
| `dist/`                         | Prebuilt frontend used by `node server.mjs`.                         |
| `docs/`                         | Screenshots used in this README.                                     |

Built for the simple moment when you have several ongoing series and just need to know **what you were reading and which chapter you finished**.
