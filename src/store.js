// Persistence layer. All data lives on the device in localStorage — no server,
// no account, nothing leaves the phone unless the user explicitly exports it.
//
// The whole store is a small JSON document, which is plenty for a personal
// episode log. Everything goes through this module so the storage backend
// could be swapped (e.g. to IndexedDB) later without touching the UI.

const KEY = 'seizure-tracker:v1'

const defaultState = () => ({
  episodes: [],
  medications: [], // her current/past medication regimen (the "list")
  medEvents: [], // logged doses taken/skipped
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

// --- Medications (the regimen list) -----------------------------------------

// Active first, then alphabetical.
export function getMedications() {
  return [...state.medications].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return (a.name || '').localeCompare(b.name || '')
  })
}

export function getActiveMedications() {
  return getMedications().filter((m) => m.active)
}

export function getMedication(id) {
  return state.medications.find((m) => m.id === id) || null
}

export function upsertMedication(med) {
  const idx = state.medications.findIndex((m) => m.id === med.id)
  const stamped = { ...med, updatedAt: new Date().toISOString() }
  if (idx >= 0) state.medications[idx] = stamped
  else state.medications.push(stamped)
  persist()
  return stamped
}

export function deleteMedication(id) {
  state.medications = state.medications.filter((m) => m.id !== id)
  persist()
}

// --- Medication events (doses taken / skipped) ------------------------------

export function getMedEvents() {
  return [...state.medEvents].sort((a, b) => new Date(b.takenAt) - new Date(a.takenAt))
}

export function getMedEvent(id) {
  return state.medEvents.find((m) => m.id === id) || null
}

export function upsertMedEvent(event) {
  const idx = state.medEvents.findIndex((m) => m.id === event.id)
  const stamped = { ...event, updatedAt: new Date().toISOString() }
  if (idx >= 0) state.medEvents[idx] = stamped
  else state.medEvents.push(stamped)
  persist()
  return stamped
}

export function deleteMedEvent(id) {
  state.medEvents = state.medEvents.filter((m) => m.id !== id)
  persist()
}

// Merged, newest-first timeline of both seizures and medication events.
// Each item is { kind: 'seizure' | 'med', when: <iso/local string>, data }.
export function getTimeline() {
  const seizures = state.episodes.map((e) => ({ kind: 'seizure', when: e.occurredAt, data: e }))
  const meds = state.medEvents.map((m) => ({ kind: 'med', when: m.takenAt, data: m }))
  return [...seizures, ...meds].sort((a, b) => new Date(b.when) - new Date(a.when))
}

// --- Backup / restore (full JSON) -------------------------------------------

export function exportJSON() {
  return JSON.stringify(state, null, 2)
}

// Merges imported records by id (imported wins on conflict) across all
// collections. Returns the number of episodes in the imported file.
export function importJSON(json) {
  const incoming = JSON.parse(json)
  if (!incoming || !Array.isArray(incoming.episodes)) {
    throw new Error('This file does not look like a Seizure Tracker backup.')
  }
  const mergeById = (current, imported) => {
    const byId = new Map(current.map((x) => [x.id, x]))
    for (const x of imported || []) if (x && x.id) byId.set(x.id, x)
    return [...byId.values()]
  }
  state.episodes = mergeById(state.episodes, incoming.episodes)
  state.medications = mergeById(state.medications, incoming.medications)
  state.medEvents = mergeById(state.medEvents, incoming.medEvents)
  persist()
  return incoming.episodes.length
}
