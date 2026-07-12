#!/usr/bin/env node
const path = require('path')

const USAGE = `video-admiral — folder-structure media server

Usage:
  video-admiral start [options]      Start the media server (default command)
  video-admiral thumbnail <movie> <time>
                                     Regenerate a movie's thumbnail from a frame at <time>
  video-admiral make-dev-media       Build a sample media library for development
  video-admiral help                 Show this help

Start options:
  --media-root <path>   Folder to scan for .mp4/.m4v files (default: ./dev-media, or MEDIA_ROOT)
  --port <n>            HTTP port (default: 5555, or PORT)
  --thumbnails <path>   Thumbnail cache dir (default: ./thumbnails, or THUMBNAIL_DIR)
  --allow-shutdown      Let clients shut the server down from the settings page

Thumbnail arguments:
  <movie>               Path relative to the media root, or part of a title to search for
  <time>                Seconds, MM:SS or HH:MM:SS (e.g. 1:20); prefix with "-" (e.g. -1:20:29)
                        to measure backwards from the end of the video
  --media-root <path>   Folder to scan for .mp4/.m4v files (default: ./dev-media, or MEDIA_ROOT)
  --thumbnails <path>   Thumbnail cache dir (default: ./thumbnails, or THUMBNAIL_DIR)

Make-dev-media options:
  --out <path>          Where to create the library (default: ./dev-media)
  --sample <file>       Sample video to copy (default: bundled Big Buck Bunny clip)
`

function parseArgs (argv) {
  const args = { _: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = argv[i + 1]
      if (next !== undefined && !next.startsWith('--')) { args[key] = next; i++ } else { args[key] = true }
    } else {
      args._.push(arg)
    }
  }
  return args
}

const args = parseArgs(process.argv.slice(2))
const command = args._[0] || 'start'

if (command === 'help' || args.help) {
  console.log(USAGE)
} else if (command === 'start') {
  if (args['media-root']) process.env.MEDIA_ROOT = path.resolve(args['media-root'])
  if (args.port) process.env.PORT = String(args.port)
  if (args.thumbnails) process.env.THUMBNAIL_DIR = path.resolve(args.thumbnails)
  if (args['allow-shutdown']) process.env.ALLOW_SHUTDOWN = 'true'
  const config = require('../../server/getConfig')
  const { startServer } = require('../../server/lib/app')
  startServer(config)
} else if (command === 'thumbnail') {
  if (args['media-root']) process.env.MEDIA_ROOT = path.resolve(args['media-root'])
  if (args.thumbnails) process.env.THUMBNAIL_DIR = path.resolve(args.thumbnails)
  const { regenThumbnail } = require('../lib/regen-thumbnail')
  regenThumbnail({ movie: args._[1], time: args._[2] })
} else if (command === 'make-dev-media') {
  const { makeDevMedia } = require('../lib/make-dev-media')
  makeDevMedia({ out: args.out, sample: args.sample })
} else {
  console.error(`Unknown command "${command}"\n`)
  console.log(USAGE)
  process.exit(1)
}
