import { thumbUrl, fullTitle } from '../api.js'
import { continueWatching, getHistory } from '../store.js'
import { el, svgIcon, videoCard, formatRemaining } from '../ui.js'

export function renderHome (app, { model, navigate }) {
  const watching = continueWatching(model)
  const hero = buildHero(model, watching, navigate)

  const rows = el('.rows')

  if (watching.length) {
    rows.append(cardRow('Continue Watching', watching.map(({ item, entry }, index) => videoCard({
      label: fullTitle(item),
      thumbPath: item.path,
      progress: entry.d ? entry.t / entry.d : 0,
      autofocusCard: false,
      onactivate: () => navigate(`#/play/${encodeURIComponent(item.path)}`),
    }))))
  }

  if (model.collections.size) {
    rows.append(cardRow('Collections', [...model.collections.values()].map(collection => videoCard({
      label: collection.name,
      thumbPath: collection.items[0].path,
      onactivate: () => navigate(`#/folder/${encodeURIComponent(collection.name)}`),
    }))))
  }

  if (model.looseTitles.length) {
    rows.append(cardRow('Titles', model.looseTitles.map(item => videoCard({
      label: item.title,
      thumbPath: item.path,
      onactivate: () => navigate(`#/play/${encodeURIComponent(item.path)}`),
    }))))
  }

  if (!model.items.length) {
    rows.append(el('p.empty-note', {}, 'No videos found in the media library.'))
  }

  app.append(hero, rows)
}

function buildHero (model, watching, navigate) {
  const latest = watching[0]
  const heroItem = latest ? latest.item : (model.looseTitles[0] || model.items[0])
  const heroEntry = latest ? latest.entry : getHistory()[heroItem?.path]

  const hero = el('header.hero')
  if (heroItem) {
    hero.append(el('.hero-backdrop', { style: `background-image:url("${thumbUrl(heroItem.path)}")` }))
  }

  const content = el('.hero-content')
  if (heroItem) {
    content.append(el('h1.hero-title', {}, fullTitle(heroItem)))
    if (heroEntry) content.append(el('p.hero-subtitle', {}, formatRemaining(heroEntry)))
    content.append(el('button.primary-button', {
      type: 'button',
      'data-autofocus': true,
      onclick: () => navigate(`#/play/${encodeURIComponent(heroItem.path)}`),
    }, svgIcon('play', 22), latest ? 'Continue Watching' : 'Start Watching'))
  } else {
    content.append(el('h1.hero-title', {}, 'Video Admiral'))
  }
  hero.append(content)

  hero.append(el('button.icon-button.hero-settings', {
    type: 'button', 'aria-label': 'Settings',
    onclick: () => navigate('#/settings'),
  }, svgIcon('gear', 30)))

  hero.append(el('button.icon-button.hero-search', {
    type: 'button', 'aria-label': 'Search',
    onclick: () => navigate('#/search'),
  }, svgIcon('search', 30)))

  return hero
}

function cardRow (heading, cards) {
  return el('section.card-row-section', {},
    el('h2.row-heading', {}, heading),
    el('.card-row', {}, cards),
  )
}
