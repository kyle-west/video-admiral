# Video Admiral

A ground-up successor to [video-captain](https://github.com/kyle-west/video-captain): a home media
server whose entire library is derived from the **titles and folder structure** of a media
directory — no database, no metadata service.

## Features

- **TV-remote friendly** — every interactive element is reachable with the arrow keys
  (spatial navigation) as well as normal Tab order. `Enter` activates, `Escape`/`Backspace`
  go back, `Space` toggles playback.
- **Home page** — hero banner resumes your latest video, plus rows for Continue Watching,
  Collections (top-level folders), and Titles (loose files at the media root).
- **Folder view** — episode list with a focus-driven preview pane and a season/sub-folder
  picker. "Play Episode" resumes the next-up episode based on watch history.
- **Player** — minimal auto-hiding chrome: back, play/pause, next episode, seek bar.
  Progress is saved locally and playback auto-advances to the next episode.
- **Search** — exact matches plus "close-ish" fuzzy matches across titles and collections.
- **Settings** — dark/light mode, accent color, clear watch history, and (if enabled)
  remote server shutdown.

Watch history and settings are stored in the browser's `localStorage` — the server stays
stateless apart from a thumbnail cache.

## Running

```sh
npm install
MEDIA_ROOT=/path/to/your/videos npm start
```

Configuration comes from env vars or an optional `config.js` (see `getConfig.js`):

| env | config.js | default | |
|---|---|---|---|
| `PORT` | `port` | `5555` | HTTP port |
| `MEDIA_ROOT` | `mediaRoot` | `./dev-media` | folder scanned for `.mp4`/`.m4v` files |
| `THUMBNAIL_DIR` | `thumbnailDir` | `./thumbnails` | thumbnail cache location |
| `ALLOW_SHUTDOWN` | `clientCanShutdownServer` | `false` | allow the client Shutdown Server button |

Thumbnails are extracted with `ffmpeg` when it's installed; otherwise a generated SVG
placeholder is served.

## Endpoints

- `GET /data/videos` — `[ [folder, [{file, folder}]] ]`, same shape as video-captain
- `GET /video/<folder>/<file>` — byte-range video streaming
- `GET /thumbnail/<folder>/<file>` — cached thumbnail
- `POST /cmd/shutdown-server` — gated by `ALLOW_SHUTDOWN`

## Development

```sh
npm run make-dev-media   # builds ./dev-media from scripts/sample.mp4
npm run dev              # serves it on :5555
```
