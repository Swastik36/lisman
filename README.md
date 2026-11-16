# Manga Shelf

> High-performance, offline-first, static Manga, Manhwa, and Light Novel reading list web application built with vanilla web standards and obsidian design aesthetics.

Based on the sleek dark obsidian design system of [Liswani](https://liswani.vercel.app), adapted specifically for reading metrics (chapters read, tankobon volumes, reading time calculations, and format tracking).

---

## Architecture & Principles

1. **Zero Framework Runtime**: Pure vanilla ES6+ JavaScript, semantic HTML5, and modern CSS. Zero React, Vue, Tailwind, or runtime libraries. Fast (<50ms initial load), works offline via `file://` or static hosting.
2. **Deterministic Data Pipeline**:
   - `data/source.json`: Hand-curated master list of shelves, series, progress, volumes, and personal notes.
   - `data/list.md`: Clean, human-readable markdown master list kept strictly synchronized with `source.json`.
   - `data/pins.json`: Map of slug keys to AniList Manga IDs (e.g., `{"berserk": 30002}`).
   - `data/media.json`: Cached AniList GraphQL metadata (`type: MANGA`) and local WebP image paths.
   - `scripts/fetch-media.mjs`: Script that queries AniList GraphQL API, downloads cover and banner artwork, and processes them to optimized WebP via ImageMagick.
   - `scripts/build-data.mjs`: Compiles `source.json` and `media.json` into `data.js` (`window.__DATA__ = {...}`) so the app runs without CORS restrictions or API rate limits.

---

## Directory Structure

```
manga-site/
├── index.html              # Clean semantic markup shell & accessible modal
├── styles.css              # Dark obsidian design tokens, responsive grid & animations
├── app.js                  # Vanilla JS renderer, modal cycling, search & navigation
├── data.js                 # Generated bundled asset (window.__DATA__)
├── favicon.svg             # SVG brand icon
├── package.json            # Node scripts (build, fetch-media, serve)
├── .gitignore              # Ignores .vercel, .env*, .preview/, node_modules
├── .vercelignore           # Keeps scripts/ and data/ out of production upload
├── README.md               # Setup and workflow documentation
├── data/
│   ├── source.json         # Master list of shelves and entries
│   ├── pins.json           # Slug -> AniList Manga ID mapping
│   ├── media.json          # Cached AniList metadata & image paths
│   └── list.md             # Synchronized markdown master list
├── scripts/
│   ├── fetch-media.mjs     # GraphQL fetcher & ImageMagick WebP processor
│   └── build-data.mjs      # Compiles source + media into data.js
└── assets/
    └── img/
        ├── posters/        # 700x1050 WebP covers (quality 82)
        └── banners/        # 1600x900 WebP banners (quality 80)
```

---

## Design System & Tokens

Replicating the sleek, tactile obsidian aesthetic:

```css
:root {
  --bg: #0b0c10;           /* Deep obsidian black */
  --bg-soft: #101218;      /* Slightly lifted container background */
  --panel: #141720;        /* Card & modal surface */
  --text: #f2eee6;         /* Warm off-white */
  --muted: #9ba1ad;        /* Steel gray */
  --line: rgba(255, 255, 255, 0.09); /* Subtle divider border */
  --accent: #e7b267;       /* Warm amber gold */
  --serif: "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif;
  --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
  --shadow: 0 16px 40px rgba(0, 0, 0, 0.42);
}
```

### Shelf Accent Colors
- **Currently Reading**: `#e7b267` (amber)
- **Peak / Masterpiece 10**: `#ef9a78` (coral peach)
- **Top Tier 9.5**: `#b09bea` (soft lavender)
- **Loved 9**: `#7ec9a8` (sage mint)
- **Liked 8–8.5**: `#82bcdc` (sky blue)
- **Mid / Dropped**: `#d98080` (dusty rose)
- **Queue / Plan to Read**: `#7fa8d9` (slate blue)

---

## Manga Domain Calculations & Stats

- **Chapter Reading Time Formula**: Baseline ~3.5 minutes per chapter (`~0.06h`).
  - `Chapter Hours = chapters_read × 0.06h` (customizable per title e.g. webtoon `0.045h` vs dense tankobon `0.07h`).
- **Hero Stats Bar**:
  1. Total Chapters Read
  2. Total Tankobon Volumes
  3. Total Reading Time (~X hours)
  4. Days Nonstop Reading (`Total Hours ÷ 24`)
  5. Curated Titles
- **Stacked Proportional Shelf Bar**: Interactive horizontal progress bar in the hero displaying the percentage of total reading time spent across each tier.

---

## Quick Start & Usage

### 1. View Offline
Simply open `index.html` directly in your browser:
```sh
xdg-open index.html
```
Or run a local static server:
```sh
npm run serve
# Or: python3 -m http.server 8000
```

### 2. Adding New Manga / Updating the List

1. Add your AniList manga ID to `data/pins.json`:
   ```json
   "monster": 30001
   ```
2. Fetch the metadata and generate WebP posters and banners:
   ```sh
   # Fetch all or specific keys
   node scripts/fetch-media.mjs monster
   ```
3. Add the series entry to `data/source.json` under your desired shelf:
   ```json
   {
     "id": "p10-monster",
     "media": "monster",
     "title": "Monster",
     "alt": "Naoki Urasawa's Monster",
     "badge": "10",
     "meta": "162 chapters · 18 volumes · ~9.7h",
     "chaptersRead": 162,
     "totalChapters": 162,
     "volumes": 18,
     "note": "A psychological thriller masterpiece exploring the nature of evil."
   }
   ```
4. Rebuild the bundled `data.js`:
   ```sh
   npm run build
   # Or: node scripts/build-data.mjs
   ```

---

## Keyboard Navigation & Shortcuts

- `/` : Focus real-time search input
- `Esc` : Close detail modal or clear search filter
- `←` / `→` : Cycle through previous/next series cards inside the detail modal
- `Tab` / `Shift+Tab` : Trapped keyboard focus inside modal for full accessibility
