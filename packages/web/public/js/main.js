import { loadLibrary, apiUrl, getServerBase, setServerBase, needsServerConfig } from './api.js'
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

// Escape, Backspace outside a text field, or the webOS remote's Back button
// (keyCode 461) all act as "back"
document.addEventListener('keydown', (event) => {
  const typing = event.target instanceof HTMLInputElement && ['text', 'search'].includes(event.target.type)
  if (event.key === 'Escape' || event.keyCode === 461 || (event.key === 'Backspace' && !typing)) {
    if (parseRoute().name !== 'home') {
      event.preventDefault()
      navigate('back')
    } else if (event.keyCode === 461 && location.protocol === 'file:') {
      // Back on the home screen exits the packaged TV app
      window.webOSSystem ? window.webOSSystem.platformBack() : window.close()
    }
  }
})

// First-run screen for packaged (TV) builds: ask which server to talk to.
function renderConnect (errorMessage = '') {
  const input = el('input.search-input', {
    type: 'text', placeholder: '192.168.0.200:5555', 'aria-label': 'Server address',
    autocomplete: 'off', 'data-autofocus': true, value: getServerBase(),
  })
  const note = el('p.connect-note', {}, errorMessage)
  const connect = async () => {
    if (!input.value.trim()) return
    setServerBase(input.value)
    note.textContent = 'Connecting…'
    try {
      await loadLibrary()
      boot()
    } catch (error) {
      note.textContent = `Could not reach ${getServerBase()} — ${error.message}`
    }
  }
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') connect() })
  app.replaceChildren(el('.connect-screen', {},
    el('h1.connect-title', {}, 'Video Admiral'),
    el('p.connect-label', {}, 'Enter the address of your Video Admiral server'),
    input,
    el('button.primary-button', { type: 'button', onclick: connect }, 'Connect'),
    note,
  ))
  focusFirst(app)
}

async function boot () {
  applyTheme()
  if (needsServerConfig()) return renderConnect()
  try {
    const [library, settingsRes] = await Promise.all([
      loadLibrary(),
      fetch(apiUrl('/data/settings')).then(res => res.ok ? res.json() : {}).catch(() => ({})),
    ])
    model = library
    serverSettings = settingsRes
    render()
  } catch (error) {
    // A packaged app pointing at a stale address should get to re-enter it
    if (getServerBase() || location.protocol === 'file:') return renderConnect(`Could not load the library: ${error.message}`)
    app.replaceChildren(el('p.empty-note', {}, `Could not load the video library: ${error.message}`))
  }
}

initSpatialNav()
boot()
