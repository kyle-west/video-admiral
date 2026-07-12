const fs = require('fs')
const path = require('path')

const SUPPORTED_TYPES = ['.m4v', '.mp4']
const isSupportedMediaType = (file) => SUPPORTED_TYPES.includes(path.extname(file).toLowerCase())

// Sort ignoring extensions ("The Dark Knight.m4v" before "The Dark Knight Rises.m4v")
// and comparing digit runs numerically ("2 Episode" before "10 Episode").
const byTitle = (a, b) => {
  const stripExt = (name) => name.replace(/\.\w+$/, '')
  return stripExt(a.name).localeCompare(stripExt(b.name), undefined, { numeric: true, sensitivity: 'base' })
}

function walkMediaFiles (root, dir = root, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort(byTitle)) {
    if (entry.name.startsWith('.')) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      walkMediaFiles(root, full, files)
    } else if (isSupportedMediaType(entry.name)) {
      files.push({ file: entry.name, folder: path.relative(root, dir).split(path.sep).filter(Boolean).join('/') })
    }
  }
  return files
}

// Scans are cached briefly so new files appear without a restart,
// but browsing doesn't hit the disk on every request.
const CACHE_TTL_MS = 30 * 1000

function createLibrary (mediaRoot) {
  let cache = null
  let scannedAt = 0

  function scan () {
    if (!cache || Date.now() - scannedAt > CACHE_TTL_MS) {
      const videoFiles = walkMediaFiles(mediaRoot)
      const byFolder = {}
      for (const video of videoFiles) {
        (byFolder[video.folder] = byFolder[video.folder] || []).push(video)
      }
      const sorted = Object.keys(byFolder)
        .sort()
        .filter(Boolean)
        .map((folder) => [folder, byFolder[folder]])
      if (byFolder['']) sorted.push(['', byFolder['']])
      cache = { videoFiles, sortedVideoFiles: sorted }
      scannedAt = Date.now()
    }
    return cache
  }

  // Resolves a "folder/file" relative path to an absolute path,
  // refusing anything that escapes the media root.
  function resolveMediaPath (relativePath) {
    const full = path.resolve(mediaRoot, relativePath)
    if (full !== mediaRoot && !full.startsWith(mediaRoot + path.sep)) return null
    if (!isSupportedMediaType(full)) return null
    if (!fs.existsSync(full) || !fs.statSync(full).isFile()) return null
    return full
  }

  return { scan, resolveMediaPath }
}

module.exports = { createLibrary, isSupportedMediaType }
