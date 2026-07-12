const fs = require('fs')
const { createLibrary } = require('../../server/lib/mediaFiles')
const { cachePathFor, extractFrame, hasFfmpeg } = require('../../server/lib/thumbnails')

// Accepts "90", "1:20" or "1:20:29"; a leading "-" measures from the end
// of the video instead of the start.
function parseTimeSpec (spec) {
  const fromEnd = spec.charAt(0) === '-'
  const parts = (fromEnd ? spec.slice(1) : spec).split(':')
  if (parts.length > 3 || parts.some((p) => !/^\d+$/.test(p))) return null
  const seconds = parts.reduce((acc, p) => acc * 60 + Number(p), 0)
  return { seconds, fromEnd }
}

const relativePathOf = (video) => (video.folder ? `${video.folder}/${video.file}` : video.file)

function fail (message) {
  console.error(message)
  process.exit(1)
}

// Finds a single video by exact relative path, falling back to a
// case-insensitive title search across the library.
function findMovie (library, query) {
  const relativePaths = library.scan().videoFiles.map(relativePathOf)
  if (relativePaths.includes(query)) return query
  const matches = relativePaths.filter((p) => p.toLowerCase().includes(query.toLowerCase()))
  if (matches.length === 0) fail(`No video matching "${query}" found in the media library.`)
  if (matches.length > 1) {
    fail(`"${query}" matches more than one video — be more specific:\n  ${matches.join('\n  ')}`)
  }
  return matches[0]
}

async function regenThumbnail ({ movie, time }) {
  if (!movie || !time) fail('Usage: video-admiral thumbnail <movie> <time>')
  if (!hasFfmpeg) fail('ffmpeg is required to generate thumbnails, but was not found on the PATH.')

  const timeSpec = parseTimeSpec(time)
  if (!timeSpec) fail(`Could not parse "${time}" as a time. Use seconds, MM:SS or HH:MM:SS (prefix with - to measure from the end).`)

  const config = require('../../server/getConfig')
  const library = createLibrary(config.mediaRoot)
  const relativePath = findMovie(library, movie)
  const videoPath = library.resolveMediaPath(relativePath)
  if (!videoPath) fail(`Could not resolve "${relativePath}" inside the media root.`)

  fs.mkdirSync(config.thumbnailDir, { recursive: true })
  const outPath = cachePathFor(config.thumbnailDir, relativePath)
  try {
    await extractFrame(videoPath, outPath, timeSpec.seconds, timeSpec.fromEnd)
  } catch (err) {
    fail(`Failed to extract a frame from ${relativePath}: ${err.message}\n` +
      'Check that the time is within the video\'s duration.')
  }
  const where = timeSpec.fromEnd ? `${time.slice(1)} before the end` : time
  console.log(`Regenerated thumbnail for ${relativePath} at ${where}:\n  ${outPath}`)
}

module.exports = { regenThumbnail }
