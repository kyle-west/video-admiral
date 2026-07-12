const path = require('path')

// The UI is a no-build SPA; consumers (server, webOS packager) just need
// the directory of static assets.
module.exports = { staticDir: path.join(__dirname, 'public') }
