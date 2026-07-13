const fs = require('fs')
const path = require('path')
const crypto = require('crypto')
const { spawn, spawnSync } = require('child_process')

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' }).status === 0
const hasFfprobe = spawnSync('ffprobe', ['-version'], { stdio: 'ignore' }).status === 0

// Scrub-preview sprite contract, shared with the web client: one JPEG holding
// SCRUB_COLS x SCRUB_ROWS frames sampled evenly across the video, each
// SCRUB_TILE_WIDTH px wide. The client crops tiles out with
// background-position, so a whole timeline costs a single request.
const SCRUB_COLS = 10
const SCRUB_ROWS = 10
const SCRUB_TILE_WIDTH = 160

function cachePathFor (thumbnailDir, relativePath, kind) {
  const hash = crypto.createHash('sha1').update(relativePath).digest('hex').slice(0, 16)
  const base = path.basename(relativePath).replace(/\.\w+$/, '').replace(/[^\w\- ]+/g, '_')
  return path.join(thumbnailDir, `${base}.${hash}${kind ? `.${kind}` : ''}.jpg`)
}

// Extracts a single frame as a JPEG. `fromEnd` seeks backwards from the end
// of the file (ffmpeg's -sseof) instead of forwards from the start.
function extractFrame (videoPath, outPath, seekSeconds, fromEnd) {
  return new Promise((resolve, reject) => {
    const seekArgs = fromEnd ? ['-sseof', String(-seekSeconds)] : ['-ss', String(seekSeconds)]
    const args = seekArgs.concat(['-i', videoPath, '-frames:v', '1', '-vf', 'scale=480:-2', '-y', outPath])
    const proc = spawn('ffmpeg', args, { stdio: 'ignore' })
    proc.on('error', reject)
    proc.on('close', () => {
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) resolve(outPath)
      else reject(new Error(`ffmpeg could not extract a frame from ${videoPath}`))
    })
  })
}

function probeDuration (videoPath) {
  return new Promise((resolve) => {
    const args = ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', videoPath]
    const proc = spawn('ffprobe', args, { stdio: ['ignore', 'pipe', 'ignore'] })
    let out = ''
    proc.stdout.on('data', (chunk) => { out += chunk })
    proc.on('error', () => resolve(null))
    proc.on('close', () => {
      const duration = parseFloat(out)
      resolve(isFinite(duration) && duration > 0 ? duration : null)
    })
  })
}

function extractScrubSprite (videoPath, outPath, duration) {
  return new Promise((resolve, reject) => {
    const frames = SCRUB_COLS * SCRUB_ROWS
    // Keyframe-only decoding keeps long movies cheap; short videos decode
    // fully so sparse keyframes don't leave the grid mostly black.
    const skipArgs = duration > 600 ? ['-skip_frame', 'nokey'] : []
    const args = skipArgs.concat([
      '-i', videoPath,
      '-vf', `fps=${frames}/${duration},scale=${SCRUB_TILE_WIDTH}:-2,tile=${SCRUB_COLS}x${SCRUB_ROWS}`,
      '-frames:v', '1', '-q:v', '6', '-y', outPath,
    ])
    const proc = spawn('ffmpeg', args, { stdio: 'ignore' })
    proc.on('error', reject)
    proc.on('close', () => {
      if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) resolve(outPath)
      else reject(new Error(`ffmpeg could not build a scrub sprite from ${videoPath}`))
    })
  })
}

function createThumbnailer (thumbnailDir) {
  fs.mkdirSync(thumbnailDir, { recursive: true })
  const inFlight = new Map()

  function generate (videoPath, outPath) {
    if (inFlight.has(outPath)) return inFlight.get(outPath)
    // Grab a frame a couple minutes in to skip title cards; retry near the
    // start for videos shorter than that.
    const promise = extractFrame(videoPath, outPath, 120, false)
      .catch(() => extractFrame(videoPath, outPath, 3, false))
      .finally(() => inFlight.delete(outPath))
    inFlight.set(outPath, promise)
    return promise
  }

  // Resolves to a JPEG path, or null when thumbnails can't be generated
  // (the route falls back to an SVG placeholder).
  async function getThumbnail (relativePath, videoPath) {
    const outPath = cachePathFor(thumbnailDir, relativePath)
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return outPath
    if (!hasFfmpeg) return null
    try {
      return await generate(videoPath, outPath)
    } catch {
      return null
    }
  }

  // Sprite generation can take a while on a long movie, so this never blocks:
  // 'ready' comes with the cached file, 'pending' means a build was kicked
  // off (the client retries later), 'unavailable' means it can't be built.
  const scrubInFlight = new Map()
  const scrubFailed = new Set()
  function getScrubSprite (relativePath, videoPath) {
    const outPath = cachePathFor(thumbnailDir, relativePath, 'scrub')
    if (fs.existsSync(outPath) && fs.statSync(outPath).size > 0) return { status: 'ready', path: outPath }
    if (!hasFfmpeg || !hasFfprobe || scrubFailed.has(outPath)) return { status: 'unavailable' }
    if (!scrubInFlight.has(outPath)) {
      const job = probeDuration(videoPath)
        .then((duration) => {
          if (!duration) throw new Error(`could not probe the duration of ${videoPath}`)
          return extractScrubSprite(videoPath, outPath, duration)
        })
        .catch(() => scrubFailed.add(outPath))
        .finally(() => scrubInFlight.delete(outPath))
      scrubInFlight.set(outPath, job)
    }
    return { status: 'pending' }
  }

  return { getThumbnail, getScrubSprite, hasFfmpeg }
}

function placeholderSvg (relativePath) {
  const title = path.basename(relativePath).replace(/\.\w+$/, '')
  const hue = [...relativePath].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) % 360, 0)
  const esc = title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  return `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="270" viewBox="0 0 480 270">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="hsl(${hue}, 45%, 22%)"/>
      <stop offset="1" stop-color="hsl(${(hue + 60) % 360}, 45%, 12%)"/>
    </linearGradient>
  </defs>
  <rect width="480" height="270" fill="url(#g)"/>
  <circle cx="240" cy="115" r="36" fill="rgba(255,255,255,0.15)"/>
  <path d="M230 97 L258 115 L230 133 Z" fill="rgba(255,255,255,0.7)"/>
  <text x="240" y="200" text-anchor="middle" fill="rgba(255,255,255,0.85)"
    font-family="system-ui, sans-serif" font-size="20" font-weight="600">${esc}</text>
</svg>`
}

module.exports = { createThumbnailer, placeholderSvg, cachePathFor, extractFrame, hasFfmpeg }
