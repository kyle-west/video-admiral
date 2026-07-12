import { searchLibrary } from '../api.js'
import { el, videoCard, svgIcon, backButton } from '../ui.js'
import { focusFirst } from '../focus.js'

export function renderSearch (app, { model, navigate }) {
  const input = el('input.search-input', {
    type: 'search', placeholder: '“Avatar”', 'aria-label': 'Search titles and collections',
    autocomplete: 'off', 'data-autofocus': true,
  })

  const results = el('.search-results', {},
    el('p.search-hint', {}, 'Type something in the search bar to search'))

  const header = el('header.search-header', {},
    backButton(() => navigate('back')),
    el('.search-box', {},
      el('label.search-label', { for: 'search-input' }, 'Search Titles & Collections'),
      el('.search-input-row', {}, svgIcon('search', 28), input),
    ),
  )
  input.id = 'search-input'

  const activate = (result) => {
    if (result.kind === 'collection') navigate(`#/folder/${encodeURIComponent(result.top)}`)
    else navigate(`#/play/${encodeURIComponent(result.path)}`)
  }

  const cardsFor = (list) => el('.search-grid', {}, list.map(result => videoCard({
    label: result.label,
    thumbPath: result.thumbPath,
    onactivate: () => activate(result),
  })))

  let debounce
  input.addEventListener('input', () => {
    clearTimeout(debounce)
    debounce = setTimeout(() => {
      const query = input.value.trim()
      results.replaceChildren()
      if (!query) {
        results.append(el('p.search-hint', {}, 'Type something in the search bar to search'))
        return
      }
      const { exact, fuzzy } = searchLibrary(model, query)
      results.append(el('h2.search-section-heading', {},
        `${exact.length} result${exact.length === 1 ? '' : 's'} found for “${query}”`))
      if (exact.length) results.append(cardsFor(exact))
      if (fuzzy.length) {
        results.append(el('h2.search-section-heading', {}, `${fuzzy.length} other close-ish match${fuzzy.length === 1 ? '' : 'es'}`))
        results.append(cardsFor(fuzzy))
      }
      if (!exact.length && !fuzzy.length) results.append(el('p.search-hint', {}, 'Nothing matched. Try fewer letters?'))
    }, 150)
  })

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') focusFirst(results)
  })

  app.append(header, results)
}
