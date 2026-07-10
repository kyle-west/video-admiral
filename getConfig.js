const { resolve } = require('path')
const { existsSync } = require('fs')

// Config resolution order:
//   1. VA_CONFIG env var pointing at a config file
//   2. ./config.js next to this file
//   3. environment variables / defaults
let fileConfig = {}
const configPath = process.env.VA_CONFIG || resolve(__dirname, 'config.js')
if (existsSync(configPath)) {
  fileConfig = require(configPath)
}

const config = {
  port: Number(process.env.PORT || fileConfig.port || 5555),
  mediaRoot: resolve(process.env.MEDIA_ROOT || fileConfig.mediaRoot || './dev-media'),
  thumbnailDir: resolve(process.env.THUMBNAIL_DIR || fileConfig.thumbnailDir || './thumbnails'),
  clientCanShutdownServer: process.env.ALLOW_SHUTDOWN
    ? process.env.ALLOW_SHUTDOWN === 'true'
    : (fileConfig.clientCanShutdownServer ?? false),
  log: fileConfig.log || null,
  ready: fileConfig.ready || null,
}

if (!existsSync(config.mediaRoot)) {
  console.error(`Expected to find a media root at "${config.mediaRoot}", but no such folder exists.`)
  console.error('Set MEDIA_ROOT (or mediaRoot in config.js), or run `npm run make-dev-media` for a local dev library.')
  process.exit(30)
}

module.exports = config
