// Library model built purely from the folder structure returned by /data/videos.
// Server payload: [ [folder, [{file, folder}]] ] — folder '' means loose files
// at the media root.

export async function loadLibrary () {
  const res = await fetch('/data/videos')
  if (!res.ok) throw new Error(`Failed to load library (${res.status})`)
  return buildModel(await res.json())
}

export function buildModel (data) {
  const items = []
  for (const [, files] of data) {
    for (const { file, folder } of files) {
      const segments = (folder || '').split('/').filter(Boolean)
      items.push({
        path: segments.length ? `${segments.join('/')}/${file}` : file,
        file,
        folder: segments.join('/'),
        top: segments[0] || '',
        sub: segments.slice(1).join('/'),
        title: displayTitle(file),
        episodeTitle: episodeTitle(file),
      })
    }
  }

  const collections = new Map()
  for (const item of items) {
    if (!item.top) continue
    if (!collections.has(item.top)) collections.set(item.top, { name: item.top, subs: new Map(), items: [] })
    const collection = collections.get(item.top)
    collection.items.push(item)
    if (!collection.subs.has(item.sub)) collection.subs.set(item.sub, [])
    collection.subs.get(item.sub).push(item)
  }

  const looseTitles = items.filter(item => !item.top)
  const byPath = new Map(items.map(item => [item.path, item]))

  return { items, collections, looseTitles, byPath }
}

export function displayTitle (file) {
  return file.replace(/\.\w+$/, '')
}

// Strips a leading episode number ("01 Slumber Party Panic" -> "Slumber Party Panic")
export function episodeTitle (file) {
  return displayTitle(file).replace(/^\d{1,2}[\s.\-–]+\s*/, '')
}

export function encodePath (path) {
  return path.split('/').map(encodeURIComponent).join('/')
}

export const videoUrl = (path) => `/video/${encodePath(path)}`
export const thumbUrl = (path) => `/thumbnail/${encodePath(path)}`

// Ordered episodes of the folder an item lives in, for prev/next navigation.
export function siblingsOf (model, item) {
  return model.items.filter(other => other.folder === item.folder)
}

export function nextEpisode (model, item) {
  const siblings = siblingsOf(model, item)
  const index = siblings.findIndex(other => other.path === item.path)
  if (index >= 0 && index < siblings.length - 1) return siblings[index + 1]
  // last episode of a sub-folder: continue into the next sub-folder of the collection
  if (item.top) {
    const collection = model.collections.get(item.top)
    const subs = [...collection.subs.keys()]
    const subIndex = subs.indexOf(item.sub)
    if (subIndex >= 0 && subIndex < subs.length - 1) return collection.subs.get(subs[subIndex + 1])[0]
  }
  return null
}

// ---------------------------------------------------------------------------
// Search: exact substring matches + "close-ish" subsequence matches
// ---------------------------------------------------------------------------
export function searchLibrary (model, query) {
  const q = query.trim().toLowerCase()
  if (!q) return { exact: [], fuzzy: [] }

  const candidates = []
  for (const [name, collection] of model.collections) {
    candidates.push({
      kind: 'collection',
      top: name,
      label: `${name} Collection`,
      searchText: name,
      thumbPath: collection.items[0].path,
    })
  }
  for (const item of model.items) {
    candidates.push({
      kind: 'video',
      path: item.path,
      label: item.top ? `${item.episodeTitle}, ${item.top}` : item.title,
      searchText: item.top ? `${item.episodeTitle} ${item.top}` : item.title,
      thumbPath: item.path,
    })
  }

  const exact = []
  const fuzzy = []
  for (const candidate of candidates) {
    const text = candidate.searchText.toLowerCase()
    if (text.includes(q)) {
      exact.push(candidate)
    } else {
      const span = subsequenceSpan(text, q)
      if (span !== null) fuzzy.push({ ...candidate, score: span })
    }
  }
  fuzzy.sort((a, b) => a.score - b.score)
  return { exact, fuzzy: fuzzy.slice(0, 12) }
}

// Smallest window in `text` containing `query` as a subsequence, or null.
function subsequenceSpan (text, query) {
  let best = null
  for (let start = 0; start < text.length; start++) {
    if (text[start] !== query[0]) continue
    let qi = 0
    for (let i = start; i < text.length && qi < query.length; i++) {
      if (text[i] === query[qi]) qi++
      if (qi === query.length) {
        const span = i - start + 1
        if (best === null || span < best) best = span
        break
      }
    }
  }
  // reject wildly spread-out matches
  return best !== null && best <= query.length * 4 ? best : null
}
