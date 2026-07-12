const express = require('express')
const fs = require('fs')
const path = require('path')
const os = require('os')

const { staticDir } = require('../../web')
const { createLibrary } = require('./mediaFiles')
const { createThumbnailer, placeholderSvg } = require('./thumbnails')

const MIME_TYPES = { '.mp4': 'video/mp4', '.m4v': 'video/mp4' }

function createApp (config) {
  const library = createLibrary(config.mediaRoot)
  const thumbnailer = createThumbnailer(config.thumbnailDir)

  const LOG_ITEM = (...logData) => {
    const time = new Date()
    ;(config.log || console.log)(`[${time.toISOString()}]`, logData.join(' '))
  }

  const app = express()

  // The webOS/TV app is served from file:// (or another origin) and talks to
  // this server across origins, so answer CORS preflights permissively.
  app.use((req, res, next) => {
    res.set('Access-Control-Allow-Origin', '*')
    res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.set('Access-Control-Allow-Headers', 'Content-Type, Range')
    res.set('Access-Control-Expose-Headers', 'Content-Range, Accept-Ranges, Content-Length')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    next()
  })

  // --------------------------------------------------------------------
  // Data Services — the library is derived entirely from the folder structure
  // --------------------------------------------------------------------
  app.get('/data/videos', (req, res) => res.json(library.scan().sortedVideoFiles))
  app.get('/data/videos/flat', (req, res) => res.json(library.scan().videoFiles))
  app.get('/data/settings', (req, res) => res.json({ clientCanShutdownServer: config.clientCanShutdownServer }))

  // --------------------------------------------------------------------
  // Video Serving — /video/<folder>/<file> with byte-range support
  // --------------------------------------------------------------------
  app.get('/video/*', (req, res) => {
    const relativePath = req.params[0]
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
        'Access-Control-Allow-Origin': '*',
      })
      streamConfig = { start, end }
    } else {
      LOG_ITEM(`[200] SERVING VIDEO "${relativePath}" to <${req.socket.remoteAddress}>`)
      res.writeHead(200, {
        'Content-Length': size,
        'Accept-Ranges': 'bytes',
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*',
      })
    }

    const stream = fs.createReadStream(itemPath, streamConfig)
    stream.on('error', () => res.destroy())
    res.on('close', () => stream.destroy())
    stream.pipe(res)
  })

  app.get('/thumbnail/*', async (req, res) => {
    const relativePath = req.params[0]
    const itemPath = library.resolveMediaPath(relativePath)
    if (!itemPath) return res.sendStatus(404)

    const jpeg = await thumbnailer.getThumbnail(relativePath, itemPath)
    res.set('Cache-Control', 'public, max-age=86400')
    if (jpeg) return res.sendFile(jpeg)
    res.type('image/svg+xml').send(placeholderSvg(relativePath))
  })

  // --------------------------------------------------------------------
  // Command Services
  // --------------------------------------------------------------------
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

  // --------------------------------------------------------------------
  // Static Assets + SPA fallback
  // --------------------------------------------------------------------
  app.use(express.static(staticDir))
  app.get('*', (req, res) => res.sendFile(path.join(staticDir, 'index.html')))

  return { app, LOG_ITEM }
}

function lanAddress () {
  for (const addrs of Object.values(os.networkInterfaces())) {
    for (const addr of addrs) {
      if (addr.family === 'IPv4' && !addr.internal) return addr.address
    }
  }
  return 'localhost'
}

function startServer (config) {
  const { app, LOG_ITEM } = createApp(config)
  return app.listen(config.port, () => {
    const suffix = config.port === 80 ? '' : `:${config.port}`
    const ipURL = `http://${lanAddress()}${suffix}/`
    LOG_ITEM(`${config.mediaRoot} media hosted at\n  http://localhost${suffix}/\n  ${ipURL}`)
    config.ready && config.ready(ipURL)
  })
}

module.exports = { createApp, startServer }
