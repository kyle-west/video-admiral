const express = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')

const config = require('./getConfig')
const { createLibrary } = require('./lib/mediaFiles')
const { createThumbnailer, placeholderSvg } = require('./lib/thumbnails')

const library = createLibrary(config.mediaRoot)
const thumbnailer = createThumbnailer(config.thumbnailDir)

const LOG_ITEM = (...logData) => {
  const time = new Date()
  ;(config.log || console.log)(`[${time.toISOString()}]`, logData.join(' '))
}

const MIME_TYPES = { '.mp4': 'video/mp4', '.m4v': 'video/mp4' }

const app = express()

// ----------------------------------------------------------------------------------------
// Data Services — the library is derived entirely from the folder structure
// ----------------------------------------------------------------------------------------
app.get('/data/videos', (req, res) => res.json(library.scan().sortedVideoFiles))
app.get('/data/videos/flat', (req, res) => res.json(library.scan().videoFiles))
app.get('/data/settings', (req, res) => res.json({ clientCanShutdownServer: config.clientCanShutdownServer }))

// ----------------------------------------------------------------------------------------
// Video Serving — /video/<folder>/<file> with byte-range support
// ----------------------------------------------------------------------------------------
app.get('/video/*mediaPath', (req, res) => {
  const relativePath = req.params.mediaPath.join('/')
  const itemPath = library.resolveMediaPath(relativePath)
  if (!itemPath) {
    LOG_ITEM(`[404] ABORTING VIDEO REQUEST "${relativePath}"`)
    return res.sendStatus(404)
  }

  const { size } = fs.statSync(itemPath)
  const contentType = MIME_TYPES[path.extname(itemPath).toLowerCase()]
  const { range } = req.headers
  let streamConfig

  if (range) {
    let [start, end] = range.replace(/bytes=/, '').split('-')
    start = parseInt(start, 10) || 0
    end = end ? parseInt(end, 10) : size - 1
    end = Math.min(end, size - 1)
    if (start > end) return res.sendStatus(416)

    LOG_ITEM(`[206] SERVING VIDEO "${relativePath}" bytes ${start}-${end} to <${req.socket.remoteAddress}>`)
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Type': contentType,
    })
    streamConfig = { start, end }
  } else {
    LOG_ITEM(`[200] SERVING VIDEO "${relativePath}" to <${req.socket.remoteAddress}>`)
    res.writeHead(200, {
      'Content-Length': size,
      'Accept-Ranges': 'bytes',
      'Content-Type': contentType,
    })
  }

  const stream = fs.createReadStream(itemPath, streamConfig)
  stream.on('error', () => res.destroy())
  res.on('close', () => stream.destroy())
  stream.pipe(res)
})

app.get('/thumbnail/*mediaPath', async (req, res) => {
  const relativePath = req.params.mediaPath.join('/')
  const itemPath = library.resolveMediaPath(relativePath)
  if (!itemPath) return res.sendStatus(404)

  const jpeg = await thumbnailer.getThumbnail(relativePath, itemPath)
  res.set('Cache-Control', 'public, max-age=86400')
  if (jpeg) return res.sendFile(jpeg)
  res.type('image/svg+xml').send(placeholderSvg(relativePath))
})

// ----------------------------------------------------------------------------------------
// Command Services
// ----------------------------------------------------------------------------------------
app.post('/cmd/shutdown-server', (req, res) => {
  if (config.clientCanShutdownServer) {
    LOG_ITEM('Received command to shutdown. Method allowed, shutting server down now.')
    res.sendStatus(200)
    res.on('finish', () => process.exit(0))
  } else {
    LOG_ITEM('Received command to shutdown. Method NOT allowed, ignoring.')
    res.sendStatus(403)
  }
})

// ----------------------------------------------------------------------------------------
// Static Assets + SPA fallback
// ----------------------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')))
app.get('/{*any}', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')))

// ----------------------------------------------------------------------------------------
// Boot
// ----------------------------------------------------------------------------------------
function lanAddress () {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return 'localhost'
}

app.listen(config.port, () => {
  const suffix = config.port === 80 ? '' : `:${config.port}`
  const ipURL = `http://${lanAddress()}${suffix}/`
  LOG_ITEM(`${config.mediaRoot} media hosted at\n  http://localhost${suffix}/\n  ${ipURL}`)
  config.ready && config.ready(ipURL)
})
