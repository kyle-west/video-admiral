# Video Admiral

A ground-up successor to [video-captain](https://github.com/kyle-west/video-captain): a home media
server whose entire library is derived from the **titles and folder structure** of a media
directory — no database, no metadata service.

## Packages

This is an npm-workspaces monorepo:

| package | what it is |
|---|---|
| [`@video-admiral/server`](packages/server) | Express server: folder scan, byte-range streaming, thumbnails, serves the web UI |
| [`@video-admiral/web`](packages/web) | The UI — a no-build vanilla-JS SPA shared by the server and the TV app |
| [`@video-admiral/cli`](packages/cli) | `video-admiral` command: `start`, `make-dev-media`, `help` |
| [`@video-admiral/webos`](packages/webos) | Packages the web UI as a native LG webOS TV app ([instructions](packages/webos/README.md)) |

## Features

- **TV-remote friendly** — every interactive element is reachable with the arrow keys
  (spatial navigation) as well as normal Tab order. `Enter` activates, `Escape`/`Backspace`/
  webOS Back go back, `Space` toggles playback, and LG media keys work in the player.
- **Home page** — hero banner resumes your latest video, plus rows for Continue Watching,
  Collections (top-level folders), and Titles (loose files at the media root).
- **Folder view** — episode list with a focus-driven preview pane and a season/sub-folder
  picker. "Play Episode" resumes the next-up episode based on watch history.
- **Player** — minimal auto-hiding chrome: back, play/pause, next episode, seek bar.
  Progress is saved locally and playback auto-advances to the next episode.
- **Search** — exact matches plus "close-ish" fuzzy matches across titles and collections.
- **Settings** — dark/light mode, accent color, clear watch history, change server
  (TV builds), and (if enabled) remote server shutdown.

Watch history and settings are stored in the browser's `localStorage` — the server stays
stateless apart from a thumbnail cache.

## Running

```sh
npm install
MEDIA_ROOT=/path/to/your/videos npm start
# or: npx video-admiral start --media-root /path/to/your/videos --port 5555
```

Configuration comes from env vars, CLI flags, or an optional `config.js`
(see `packages/server/getConfig.js`):

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

CORS is enabled so packaged apps (webOS's `file://` origin) can talk to the server directly.

## Development

```sh
npm run make-dev-media   # builds ./dev-media from a bundled sample clip
npm run dev              # serves it on :5555
npm run build:webos      # builds the LG TV app into packages/webos/dist
```
