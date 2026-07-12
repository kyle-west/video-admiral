// Builds a webOS-ready app directory in ./dist from the shared web UI:
// copies the SPA, writes appinfo.json, and generates the PNG icons.
// Package it for the TV with `ares-package dist` (see README.md).
const fs = require('fs')
const path = require('path')

const { staticDir } = require('../web')
const { encodePng } = require('./lib/png')

const DIST = path.join(__dirname, 'dist')

const APP_INFO = {
  id: 'dev.kylewest.videoadmiral',
  version: '0.1.0',
  vendor: 'Kyle West',
  type: 'web',
  main: 'index.html',
  title: 'Video Admiral',
  icon: 'icon.png',
  largeIcon: 'largeIcon.png',
  bgColor: '#000000',
  iconColor: '#1a1a1a',
  resolution: '1920x1080',
  // Deliver the remote's Back button to the app as keyCode 461 instead of
  // letting the system unwind browser history.
  disableBackHistoryAPI: true,
}

// Dark rounded square with the brand-pink play triangle.
function drawIcon (size) {
  const rgba = Buffer.alloc(size * size * 4)
  const radius = size * 0.18
  const bg = [26, 26, 26, 255]
  const pink = [242, 13, 146, 255]

  const ax = 0.36 * size; const ay = 0.30 * size
  const bx = 0.36 * size; const by = 0.70 * size
  const cx = 0.76 * size; const cy = 0.50 * size
  const sign = (x, y, x1, y1, x2, y2) => (x - x2) * (y1 - y2) - (x1 - x2) * (y - y2)
  const inTriangle = (x, y) => {
    const d1 = sign(x, y, ax, ay, bx, by)
    const d2 = sign(x, y, bx, by, cx, cy)
    const d3 = sign(x, y, cx, cy, ax, ay)
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0
    return !(hasNeg && hasPos)
  }
  const inRoundedSquare = (x, y) => {
    const nearX = Math.max(radius - x, x - (size - 1 - radius), 0)
    const nearY = Math.max(radius - y, y - (size - 1 - radius), 0)
    return nearX * nearX + nearY * nearY <= radius * radius
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const offset = (y * size + x) * 4
      const color = !inRoundedSquare(x, y) ? [0, 0, 0, 0] : inTriangle(x, y) ? pink : bg
      rgba.set(color, offset)
    }
  }
  return encodePng(size, size, rgba)
}

// ---------------------------------------------------------------------------
// Chromium (and webOS's web runtime) refuses to load ES-module scripts from
// file:// origins, so the packaged app can't use <script type="module">.
// The SPA's modules only use simple static imports/exports, so bundle them by
// concatenating in dependency order inside one IIFE with imports/exports
// stripped.
// ---------------------------------------------------------------------------
const MODULE_ORDER = [
  'js/api.js',
  'js/store.js',
  'js/focus.js',
  'js/ui.js',
  'js/views/home.js',
  'js/views/folder.js',
  'js/views/player.js',
  'js/views/search.js',
  'js/views/settings.js',
  'js/main.js',
]

function bundleClassicScript () {
  const parts = MODULE_ORDER.map((file) => {
    const source = fs.readFileSync(path.join(staticDir, file), 'utf8')
      .replace(/^import\s[^\n]*\n/gm, '')
      .replace(/^export\s+(?=(async\s+)?(function|const|let|class)\b)/gm, '')
    return `// ---- ${file} ----\n${source}`
  })
  return `(function () {\n'use strict';\n${parts.join('\n')}\n})();\n`
}

// Node 12 has neither fs.rmSync nor fs.cpSync, so remove/copy by hand.
function removeDir (dir) {
  if (!fs.existsSync(dir)) return
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) removeDir(full)
    else fs.unlinkSync(full)
  }
  fs.rmdirSync(dir)
}

function copyDir (src, dest) {
  fs.mkdirSync(dest, { recursive: true })
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const from = path.join(src, entry.name)
    const to = path.join(dest, entry.name)
    if (entry.isDirectory()) copyDir(from, to)
    else fs.copyFileSync(from, to)
  }
}

removeDir(DIST)
copyDir(staticDir, DIST)

// swap the module entrypoint for the bundled classic script
removeDir(path.join(DIST, 'js'))
fs.writeFileSync(path.join(DIST, 'app.js'), bundleClassicScript())
const indexHtml = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
  .replace('<script type="module" src="/js/main.js"></script>', '<script src="app.js" defer></script>')
  .replace('href="/styles.css"', 'href="styles.css"')
  .replace('href="/favicon.svg"', 'href="favicon.svg"')
fs.writeFileSync(path.join(DIST, 'index.html'), indexHtml)

fs.writeFileSync(path.join(DIST, 'appinfo.json'), JSON.stringify(APP_INFO, null, 2))
fs.writeFileSync(path.join(DIST, 'icon.png'), drawIcon(80))
fs.writeFileSync(path.join(DIST, 'largeIcon.png'), drawIcon(130))

console.log(`webOS app built at ${DIST}`)
console.log('Next: ares-package dist --outdir out && ares-install out/*.ipk --device <tv>')
