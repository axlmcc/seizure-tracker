// Persistence layer. All data lives on the device in localStorage — no server,
// no account, nothing leaves the phone unless the user explicitly exports it.
//
// The whole store is a small JSON document, which is plenty for a personal
// episode log. Everything goes through this module so the storage backend
// could be swapped (e.g. to IndexedDB) later without touching the UI.

const KEY = 'seizure-tracker:v1'

const defaultState = () => ({
  episodes: [],
  settings: {
    // Google Drive file id of the living spreadsheet, once one is created.
    driveFileId: null,
    driveFileName: 'Seizure Log',
  },
})

let state = load()
const listeners = new Set()

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaultState()
    const parsed = JSON.parse(raw)
    return { ...defaultState(), ...parsed, settings: { ...defaultState().settings, ...(parsed.settings || {}) } }
  } catch (err) {
    console.error('Failed to load saved data; starting fresh.', err)
    return defaultState()
  }
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch (err) {
    console.error('Failed to save data.', err)
    alert('Could not save — your device storage may be full or blocked (e.g. private browsing).')
  }
  listeners.forEach((fn) => fn(state))
}

// Subscribe to any change. Returns an unsubscribe function.
export function subscribe(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// --- Episodes ---------------------------------------------------------------

// Newest first.
export function getEpisodes() {
  return [...state.episodes].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
}

export function getEpisode(id) {
  return state.episodes.find((e) => e.id === id) || null
}

export function upsertEpisode(episode) {
  const idx = state.episodes.findIndex((e) => e.id === episode.id)
  const stamped = { ...episode, updatedAt: new Date().toISOString() }
  if (idx >= 0) {
    state.episodes[idx] = stamped
  } else {
    state.episodes.push(stamped)
  }
  persist()
  return stamped
}

export function deleteEpisode(id) {
  state.episodes = state.episodes.filter((e) => e.id !== id)
  persist()
}

// --- Settings ---------------------------------------------------------------

export function getSettings() {
  return { ...state.settings }
}

export function updateSettings(patch) {
  state.settings = { ...state.settings, ...patch }
  persist()
}

// --- Backup / restore (full JSON) -------------------------------------------

export function exportJSON() {
  return JSON.stringify(state, null, 2)
}

// Merges imported episodes by id (imported wins on conflict). Returns count added/updated.
export function importJSON(json) {
  const incoming = JSON.parse(json)
  if (!incoming || !Array.isArray(incoming.episodes)) {
    throw new Error('This file does not look like a Seizure Tracker backup.')
  }
  const byId = new Map(state.episodes.map((e) => [e.id, e]))
  for (const e of incoming.episodes) {
    if (e && e.id) byId.set(e.id, e)
  }
  state.episodes = [...byId.values()]
  persist()
  return incoming.episodes.length
}
