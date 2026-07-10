import { loadLibrary } from './api.js'
import { applyTheme } from './store.js'
import { initSpatialNav, focusFirst } from './focus.js'
import { el } from './ui.js'
import { renderHome } from './views/home.js'
import { renderFolder } from './views/folder.js'
import { renderPlayer } from './views/player.js'
import { renderSearch } from './views/search.js'
import { renderSettings } from './views/settings.js'

const app = document.getElementById('app')

let model = null
let serverSettings = {}
let teardown = null
let internalNavigations = 0

function navigate (target, { replace = false } = {}) {
  if (target === 'back') {
    if (internalNavigations > 0) {
      internalNavigations -= 2 // history.back triggers hashchange which re-increments
      history.back()
    } else {
      location.hash = '#/'
    }
    return
  }
  if (replace) {
    history.replaceState(null, '', target)
    internalNavigations -= 1
    render()
  } else {
    location.hash = target
  }
}

function parseRoute () {
  const hash = location.hash || '#/'
  const [path] = hash.slice(1).split('?')
  const segments = path.split('/').filter(Boolean).map(decodeURIComponent)
  if (segments[0] === 'folder' && segments[1]) return { view: renderFolder, params: { top: segments[1], sub: segments[2] ?? null }, name: 'folder' }
  if (segments[0] === 'play' && segments[1]) return { view: renderPlayer, params: { path: segments[1] }, name: 'player' }
  if (segments[0] === 'search') return { view: renderSearch, params: {}, name: 'search' }
  if (segments[0] === 'settings') return { view: renderSettings, params: {}, name: 'settings' }
  return { view: renderHome, params: {}, name: 'home' }
}

function render () {
  if (teardown) { teardown(); teardown = null }
  const { view, params, name } = parseRoute()
  app.replaceChildren()
  app.dataset.view = name
  teardown = view(app, { model, navigate, params, serverSettings }) || null
  focusFirst(app)
}

window.addEventListener('hashchange', () => {
  internalNavigations += 1
  render()
})

// Escape (or Backspace outside a text field) acts like a remote's back button
document.addEventListener('keydown', (event) => {
  const typing = event.target instanceof HTMLInputElement && ['text', 'search'].includes(event.target.type)
  if (event.key === 'Escape' || (event.key === 'Backspace' && !typing)) {
    if (parseRoute().name !== 'home') {
      event.preventDefault()
      navigate('back')
    }
  }
})

async function boot () {
  applyTheme()
  initSpatialNav()
  try {
    const [library, settingsRes] = await Promise.all([
      loadLibrary(),
      fetch('/data/settings').then(res => res.ok ? res.json() : {}).catch(() => ({})),
    ])
    model = library
    serverSettings = settingsRes
    render()
  } catch (error) {
    app.replaceChildren(el('p.empty-note', {}, `Could not load the video library: ${error.message}`))
  }
}

boot()
