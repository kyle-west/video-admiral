import { thumbUrl } from './api.js'

// Tiny DOM helper: el('button.card', { onclick }, child, child, ...)
export function el (spec, attrs = {}, ...children) {
  const [tag, ...classes] = spec.split('.')
  const node = document.createElement(tag || 'div')
  if (classes.length) node.className = classes.join(' ')
  for (const [key, value] of Object.entries(attrs)) {
    if (key.startsWith('on') && typeof value === 'function') node.addEventListener(key.slice(2), value)
    else if (key === 'dataset') Object.assign(node.dataset, value)
    else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : value)
  }
  for (const child of children.flat()) {
    if (child == null) continue
    node.append(child.nodeType ? child : document.createTextNode(child))
  }
  return node
}

export function svgIcon (name, size = 24) {
  const paths = {
    play: '<path d="M8 5v14l11-7z"/>',
    pause: '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>',
    next: '<path d="M6 5v14l8.5-7zM16 5h2.5v14H16z"/>',
    back: '<path d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/>',
    restart: '<path d="M12 5V1L7 6l5 5V7a6 6 0 1 1-6 6H4a8 8 0 1 0 8-8z"/>',
    gear: '<path d="M19.4 13a7.6 7.6 0 0 0 .1-1 7.6 7.6 0 0 0-.1-1l2.1-1.7a.5.5 0 0 0 .1-.6l-2-3.5a.5.5 0 0 0-.6-.2l-2.5 1a7.6 7.6 0 0 0-1.7-1l-.4-2.6a.5.5 0 0 0-.5-.4h-4a.5.5 0 0 0-.5.4L9 5a7.6 7.6 0 0 0-1.7 1l-2.5-1a.5.5 0 0 0-.6.2l-2 3.5a.5.5 0 0 0 .1.6L4.5 11a7.6 7.6 0 0 0-.1 1 7.6 7.6 0 0 0 .1 1l-2.1 1.7a.5.5 0 0 0-.1.6l2 3.5c.1.2.4.3.6.2l2.5-1a7.6 7.6 0 0 0 1.7 1l.4 2.6c0 .2.2.4.5.4h4c.2 0 .4-.2.5-.4l.4-2.6a7.6 7.6 0 0 0 1.7-1l2.5 1c.2.1.5 0 .6-.2l2-3.5a.5.5 0 0 0-.1-.6L19.4 13zM12 15.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/>',
    search: '<path d="M15.5 14h-.8l-.3-.3a6.5 6.5 0 1 0-.7.7l.3.3v.8l5 5 1.5-1.5-5-5zm-6 0a4.5 4.5 0 1 1 0-9 4.5 4.5 0 0 1 0 9z"/>',
    eyeOff: '<path d="M12 6a9.8 9.8 0 0 1 9 6 9.9 9.9 0 0 1-2.2 3.1l1.4 1.4A11.9 11.9 0 0 0 23 12a11.8 11.8 0 0 0-14.9-5.7l1.6 1.6A9.9 9.9 0 0 1 12 6zM2.7 3.3 1.3 4.7l2.6 2.6A11.9 11.9 0 0 0 1 12a11.8 11.8 0 0 0 15.2 5.5l3.1 3.1 1.4-1.4L2.7 3.3zM12 18a9.8 9.8 0 0 1-9-6 9.9 9.9 0 0 1 2.5-3.4l2 2A4.5 4.5 0 0 0 12 16.5c.4 0 .8-.1 1.2-.2l1.5 1.5c-.9.1-1.8.2-2.7.2z"/>',
    power: '<path d="M13 3h-2v10h2V3zm5.6 2.4-1.4 1.4A7 7 0 1 1 5 12c0-1.9.8-3.7 2-5.2L5.6 5.4A9 9 0 1 0 21 12a9 9 0 0 0-2.4-6.6z"/>',
  }
  const wrap = document.createElement('span')
  wrap.className = 'icon'
  wrap.innerHTML = `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="currentColor" aria-hidden="true">${paths[name] || ''}</svg>`
  return wrap
}

export function thumbImg (path, alt = '') {
  return el('img.thumb', { src: thumbUrl(path), alt, loading: 'lazy' })
}

// A poster card used on home and search pages. progress: 0..1 or null.
export function videoCard ({ label, thumbPath, progress = null, onactivate, autofocusCard = false }) {
  const card = el('button.card', { type: 'button', 'data-autofocus': autofocusCard, onclick: onactivate },
    el('.card-media', {},
      thumbImg(thumbPath, ''),
      progress != null ? el('.progress-track', {}, el('.progress-fill', { style: `width:${Math.round(progress * 100)}%` })) : null,
    ),
    el('.card-label', {}, label),
  )
  return card
}

export function backButton (onclick) {
  return el('button.icon-button.back-button', { type: 'button', 'aria-label': 'Go back', onclick }, svgIcon('back', 34))
}

let toastTimer
export function toast (message) {
  const node = document.getElementById('toast')
  node.textContent = message
  node.classList.add('show')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => node.classList.remove('show'), 3000)
}

export function formatRemaining (entry) {
  if (!entry || !entry.d) return ''
  const minutes = Math.max(1, Math.round((entry.d - entry.t) / 60))
  return `${minutes}min remaining`
}

export function formatTime (seconds) {
  if (!isFinite(seconds)) return '0:00'
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = String(s % 60).padStart(2, '0')
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`
}
