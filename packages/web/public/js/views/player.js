import { videoUrl, scrubUrl, nextEpisode } from '../api.js'
import { saveProgress, resumeTime } from '../store.js'
import { el, svgIcon, backButton, formatTime, fullscreenButton } from '../ui.js'

const HIDE_CHROME_AFTER_MS = 3500

// Must match the sprite the server builds (see server/lib/thumbnails.js).
const SCRUB_COLS = 10
const SCRUB_ROWS = 10
const SCRUB_RETRY_MS = 8000

export function renderPlayer (app, { model, navigate, params }) {
  const item = model.byPath.get(params.path)
  if (!item) {
    app.append(el('p.empty-note', {}, 'Video not found.'))
    return
  }
  const next = nextEpisode(model, item)
  const title = item.top ? `${item.top} — ${item.episodeTitle}` : item.title

  const video = el('video.player-video', { src: videoUrl(item.path), autoplay: true, preload: 'auto' })

  const playPauseButton = el('button.icon-button', { type: 'button', 'aria-label': 'Play/Pause', 'data-autofocus': true,
    onclick: () => video.paused ? video.play() : video.pause(),
  }, svgIcon('pause', 34))

  const seekBar = el('input.seek-bar', { type: 'range', min: 0, max: 100, step: 5, value: 0, 'aria-label': 'Seek' })
  const timeLabel = el('span.time-label', {}, '')
  const { button: fsButton, dispose: disposeFsButton } = fullscreenButton('', 34)

  const chrome = el('.player-chrome', {},
    el('.player-top', {},
      backButton(() => navigate('back')),
      el('h1.player-title', {}, title),
    ),
    el('.player-bottom', {},
      playPauseButton,
      next ? el('button.icon-button', { type: 'button', 'aria-label': 'Next episode',
        onclick: () => navigate(`#/play/${encodeURIComponent(next.path)}`, { replace: true }),
      }, svgIcon('next', 34)) : null,
      seekBar,
      timeLabel,
      el('button.icon-button', { type: 'button', 'aria-label': 'Start over',
        onclick: () => { video.currentTime = 0; video.play() },
      }, svgIcon('restart', 34)),
      fsButton,
    ),
  )

  const scrubFrame = el('.scrub-frame')
  const scrubTime = el('span.scrub-time')
  const scrubPreview = el('.scrub-preview', {}, scrubFrame, scrubTime)

  const stage = el('.player-stage', {}, video, chrome, scrubPreview)
  app.append(stage)

  // ---- scrub preview ----------------------------------------------------
  // One sprite JPEG holds the whole timeline; hovering just moves the
  // background-position, so previews cost nothing after the initial fetch.
  let sprite = null
  let spriteUrl = null
  let spriteRetryTimer
  const loadSprite = async () => {
    try {
      const res = await fetch(scrubUrl(item.path))
      if (res.status === 202) { spriteRetryTimer = setTimeout(loadSprite, SCRUB_RETRY_MS); return }
      if (!res.ok) return
      spriteUrl = URL.createObjectURL(await res.blob())
      const img = new Image()
      img.onload = () => {
        sprite = { tileW: img.naturalWidth / SCRUB_COLS, tileH: img.naturalHeight / SCRUB_ROWS }
        scrubFrame.style.backgroundImage = `url("${spriteUrl}")`
        scrubFrame.style.width = `${sprite.tileW}px`
        scrubFrame.style.height = `${sprite.tileH}px`
      }
      img.src = spriteUrl
    } catch { /* no preview, the seek bar still works */ }
  }
  loadSprite()

  const showScrubPreview = (clientX) => {
    if (!sprite || !video.duration) return
    const rect = seekBar.getBoundingClientRect()
    const fraction = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
    const index = Math.min(SCRUB_COLS * SCRUB_ROWS - 1, Math.floor(fraction * SCRUB_COLS * SCRUB_ROWS))
    scrubFrame.style.backgroundPosition = `${-(index % SCRUB_COLS) * sprite.tileW}px ${-Math.floor(index / SCRUB_COLS) * sprite.tileH}px`
    scrubTime.textContent = formatTime(fraction * video.duration)
    const half = sprite.tileW / 2 + 8
    scrubPreview.style.left = `${Math.max(half, Math.min(window.innerWidth - half, clientX))}px`
    scrubPreview.classList.add('visible')
  }
  seekBar.addEventListener('pointermove', (event) => showScrubPreview(event.clientX))
  seekBar.addEventListener('pointerleave', () => scrubPreview.classList.remove('visible'))

  // ---- progress persistence -------------------------------------------
  const persist = () => {
    if (video.duration && video.currentTime > 0) saveProgress(item.path, video.currentTime, video.duration)
  }
  const persistTimer = setInterval(persist, 5000)

  // ---- chrome show/hide -------------------------------------------------
  let hideTimer
  const showChrome = () => {
    chrome.classList.remove('hidden')
    clearTimeout(hideTimer)
    hideTimer = setTimeout(() => {
      if (!video.paused) chrome.classList.add('hidden')
    }, HIDE_CHROME_AFTER_MS)
  }
  const onActivity = () => showChrome()
  document.addEventListener('keydown', onActivity, true)
  stage.addEventListener('mousemove', onActivity)
  stage.addEventListener('click', onActivity)
  showChrome()

  // ---- video events ------------------------------------------------------
  video.addEventListener('loadedmetadata', () => {
    seekBar.max = Math.floor(video.duration)
    const t = resumeTime(item.path)
    if (t > 0 && t < video.duration - 5) video.currentTime = t
  })
  video.addEventListener('timeupdate', () => {
    if (document.activeElement !== seekBar || !seeking) seekBar.value = Math.floor(video.currentTime)
    timeLabel.textContent = `-${formatTime((video.duration || 0) - video.currentTime)}`
  })
  video.addEventListener('play', () => { setIcon(playPauseButton, 'pause'); showChrome() })
  video.addEventListener('pause', () => { setIcon(playPauseButton, 'play'); showChrome(); persist() })
  video.addEventListener('ended', () => {
    persist()
    if (next) navigate(`#/play/${encodeURIComponent(next.path)}`, { replace: true })
    else navigate('back')
  })

  let seeking = false
  seekBar.addEventListener('input', () => {
    seeking = true
    video.currentTime = Number(seekBar.value)
    timeLabel.textContent = `-${formatTime((video.duration || 0) - video.currentTime)}`
  })
  seekBar.addEventListener('change', () => { seeking = false })

  // Space toggles playback unless a button is focused (it would click it).
  // The other codes are LG/webOS remote media keys.
  const onKey = (event) => {
    if (event.key === ' ' && !(document.activeElement instanceof HTMLButtonElement)) {
      event.preventDefault()
      video.paused ? video.play() : video.pause()
    } else if (event.keyCode === 415 || event.key === 'MediaPlay') {
      video.play()
    } else if (event.keyCode === 19 || event.key === 'MediaPause') {
      video.pause()
    } else if (event.keyCode === 413 || event.key === 'MediaStop') {
      navigate('back')
    } else if (event.keyCode === 412 || event.key === 'MediaRewind') {
      video.currentTime = Math.max(0, video.currentTime - 30)
    } else if (event.keyCode === 417 || event.key === 'MediaFastForward') {
      video.currentTime = Math.min(video.duration || Infinity, video.currentTime + 30)
    } else if (event.key === 'MediaTrackNext' && next) {
      navigate(`#/play/${encodeURIComponent(next.path)}`, { replace: true })
    }
  }
  document.addEventListener('keydown', onKey)

  // cleanup when the router tears this view down
  return () => {
    persist()
    clearInterval(persistTimer)
    clearTimeout(hideTimer)
    clearTimeout(spriteRetryTimer)
    if (spriteUrl) URL.revokeObjectURL(spriteUrl)
    disposeFsButton()
    document.removeEventListener('keydown', onActivity, true)
    document.removeEventListener('keydown', onKey)
    video.pause()
    video.removeAttribute('src')
    video.load()
  }
}

function setIcon (button, name) {
  button.replaceChildren(svgIcon(name, 34))
}
