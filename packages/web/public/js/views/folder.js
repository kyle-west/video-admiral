import { thumbUrl } from '../api.js'
import { nextUpIn } from '../store.js'
import { el, svgIcon, thumbImg, backButton } from '../ui.js'

// Folder view: collection title + preview of the selected episode on the
// left, episode list in the middle, sub-folder (season) picker on the right.
// Focusing an episode in the list updates the preview.
export function renderFolder (app, { model, navigate, params }) {
  const collection = model.collections.get(params.top)
  if (!collection) {
    app.append(el('p.empty-note', {}, `No collection named “${params.top}”.`))
    return
  }

  const subs = [...collection.subs.keys()]
  const hasSubs = subs.length > 1 || subs[0] !== ''
  const nextUp = nextUpIn(model, collection.items)
  const activeSub = params.sub != null && collection.subs.has(params.sub) ? params.sub : nextUp.sub
  const episodes = collection.subs.get(activeSub) || []
  let selected = episodes.includes(nextUp) ? nextUp : episodes[0]

  const previewImg = thumbImg(selected.path, '')
  previewImg.classList.add('preview-thumb')
  const previewTitle = el('h2.preview-title', {}, selected.episodeTitle)

  const play = (item) => navigate(`#/play/${encodeURIComponent(item.path)}`)
  const select = (item) => {
    selected = item
    previewImg.src = thumbUrl(item.path)
    previewTitle.textContent = item.episodeTitle
  }

  const left = el('.folder-left', {},
    backButton(() => navigate('#/')),
    el('h1.folder-title', {}, collection.name),
    previewImg,
    previewTitle,
    el('button.primary-button', { type: 'button', onclick: () => play(selected) }, svgIcon('play', 22), 'Play Episode'),
  )

  const episodeList = el('.episode-list', {}, episodes.map(item =>
    el('button.episode-item', {
      type: 'button',
      'data-autofocus': item === selected,
      onclick: () => play(item),
      onfocus: () => select(item),
    },
      thumbImg(item.path, ''),
      el('span.episode-name', {}, item.episodeTitle),
    )
  ))

  const layout = el('.folder-layout', {}, left, episodeList)

  if (hasSubs) {
    layout.append(el('nav.sub-list', { 'aria-label': 'Sub-folders' }, subs.map(sub =>
      el('button.sub-item', {
        type: 'button',
        'aria-current': sub === activeSub ? 'true' : null,
        onclick: () => navigate(`#/folder/${encodeURIComponent(collection.name)}/${encodeURIComponent(sub)}`),
      }, sub || 'Other')
    )))
  }

  app.append(layout)
}
