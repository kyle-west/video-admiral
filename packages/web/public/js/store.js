// Client-side persistence: theme/accent settings and watch history live in
// localStorage — the server knows nothing beyond the folder structure.

const SETTINGS_KEY = 'va:settings'
const HISTORY_KEY = 'va:history'

export const ACCENTS = {
  pink: '#F20D92',
  red: '#DE1F26',
  green: '#0DBF7C',
  blue: '#5352ED',
}

const defaultSettings = { dark: true, accent: 'pink' }

function read (key, fallback) {
  try {
    return { ...fallback, ...JSON.parse(localStorage.getItem(key)) }
  } catch {
    return { ...fallback }
  }
}

export function getSettings () {
  return read(SETTINGS_KEY, defaultSettings)
}

export function saveSettings (patch) {
  const next = { ...getSettings(), ...patch }
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next))
  applyTheme()
  return next
}

export function applyTheme () {
  const { dark, accent } = getSettings()
  const color = ACCENTS[accent] || ACCENTS.pink
  document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  document.documentElement.style.setProperty('--accent', color)
  document.documentElement.style.setProperty('--accent-glow', `${color}66`) // 40% alpha for the focus glow
}

// --------------------------------------------------------------------------
// Watch history: { [path]: { t: seconds, d: duration, at: epoch ms } }
// --------------------------------------------------------------------------
export function getHistory () {
  return read(HISTORY_KEY, {})
}

export function saveProgress (path, t, d) {
  const history = getHistory()
  history[path] = { t: Math.floor(t), d: Math.floor(d || 0), at: Date.now() }
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history))
}

export function clearHistory () {
  localStorage.removeItem(HISTORY_KEY)
}

export const isFinished = (entry) => entry.d > 0 && entry.t / entry.d > 0.95

// Unfinished videos, most recent first — at most one per collection.
export function continueWatching (model) {
  const seen = new Set()
  return Object.entries(getHistory())
    .filter(([path, entry]) => model.byPath.has(path) && entry.t > 30 && !isFinished(entry))
    .sort(([, a], [, b]) => b.at - a.at)
    .map(([path, entry]) => ({ item: model.byPath.get(path), entry }))
    .filter(({ item }) => {
      const key = item.top || item.path
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

// The episode a collection's "Play Episode" button should target:
// resume the most recently watched unfinished episode, advance past a
// finished one, or start at the beginning.
export function nextUpIn (model, items) {
  const history = getHistory()
  let latest = null
  for (const item of items) {
    const entry = history[item.path]
    if (entry && (!latest || entry.at > latest.entry.at)) latest = { item, entry }
  }
  if (!latest) return items[0]
  if (!isFinished(latest.entry)) return latest.item
  const index = items.findIndex(item => item.path === latest.item.path)
  return items[(index + 1) % items.length] || items[0]
}

export function resumeTime (path) {
  const entry = getHistory()[path]
  return entry && !isFinished(entry) ? entry.t : 0
}
