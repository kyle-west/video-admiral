// Spatial navigation: arrow keys move focus to the geometrically nearest
// interactive element in that direction, so the whole UI is drivable with a
// TV remote's d-pad. Regular Tab order still works — everything is a native
// button/link/input.

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])'

function isVisible (el) {
  if (el.closest('[hidden], [aria-hidden="true"]')) return false
  const rect = el.getBoundingClientRect()
  return rect.width > 0 && rect.height > 0
}

export function focusables (scope = document) {
  return [...scope.querySelectorAll(FOCUSABLE)].filter(isVisible)
}

export function focusFirst (scope = document) {
  const preferred = scope.querySelector('[data-autofocus]')
  const target = (preferred && isVisible(preferred)) ? preferred : focusables(scope)[0]
  if (target) target.focus({ preventScroll: true })
  return target
}

function center (rect) {
  return { x: (rect.left + rect.right) / 2, y: (rect.top + rect.bottom) / 2 }
}

function findNext (from, direction) {
  const fromRect = from.getBoundingClientRect()
  const fromCenter = center(fromRect)
  let best = null
  let bestScore = Infinity

  for (const el of focusables()) {
    if (el === from || from.contains(el)) continue
    const c = center(el.getBoundingClientRect())
    const dx = c.x - fromCenter.x
    const dy = c.y - fromCenter.y

    let forward, sideways
    if (direction === 'left') { forward = -dx; sideways = Math.abs(dy) }
    else if (direction === 'right') { forward = dx; sideways = Math.abs(dy) }
    else if (direction === 'up') { forward = -dy; sideways = Math.abs(dx) }
    else { forward = dy; sideways = Math.abs(dx) }

    if (forward < 1) continue // must actually lie in that direction
    // Weight cross-axis distance heavily so navigation tracks rows/columns.
    const score = forward + sideways * 2.5 + (sideways > forward ? 1000 : 0)
    if (score < bestScore) {
      bestScore = score
      best = el
    }
  }
  return best
}

function moveFocus (direction) {
  const active = document.activeElement
  const from = (active && active !== document.body) ? active : null
  const next = from ? findNext(from, direction) : focusFirst()
  if (next) {
    next.focus({ preventScroll: true })
    next.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }
  return next
}

const DIRECTIONS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }

export function initSpatialNav () {
  document.addEventListener('keydown', (event) => {
    const direction = DIRECTIONS[event.key]
    if (!direction || event.altKey || event.ctrlKey || event.metaKey) return

    const active = document.activeElement
    if (active instanceof HTMLInputElement) {
      const horizontal = direction === 'left' || direction === 'right'
      // text caret movement and range (seek bar) stepping keep the arrows
      if (horizontal && ['text', 'search', 'range'].includes(active.type)) return
    }

    event.preventDefault()
    moveFocus(direction)
  })
}
