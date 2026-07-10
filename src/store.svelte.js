// Single source of truth for the whole app: a deeply-reactive Svelte 5 store
// backed by localStorage. Every component reads from `db`; any mutation here
// updates every view automatically and is persisted.
//
// Everything stays on the device — nothing is uploaded unless the user exports.

import { newId, createMedEvent, createBatch, DEFAULT_BATCH_NAMES } from './model.js'

const KEY = 'seizure-tracker:v1'

function seedBatches() {
  return DEFAULT_BATCH_NAMES.map((name, i) => createBatch({ name, order: i }))
}

function defaults() {
  return {
    episodes: [],
    medications: [],
    medEvents: [],
    batches: seedBatches(),
    settings: { driveFileId: null, driveFileName: 'Seizure Log' },
  }
}

function load() {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return defaults()
    const p = JSON.parse(raw)
    return {
      episodes: p.episodes ?? [],
      // Backfill batchIds on medications saved before batches existed.
      medications: (p.medications ?? []).map((m) => ({ batchIds: [], ...m })),
      medEvents: p.medEvents ?? [],
      // Seed default batches only when the key is entirely absent (first run on
      // an older save); respect an explicitly-emptied list.
      batches: p.batches === undefined ? seedBatches() : p.batches,
      settings: { driveFileId: null, driveFileName: 'Seizure Log', ...(p.settings || {}) },
    }
  } catch (err) {
    console.error('Failed to load saved data; starting fresh.', err)
    return defaults()
  }
}

export const db = $state(load())

// Persist on any change. Reading the whole object through JSON.stringify makes
// this effect depend on the entire (deep) state.
$effect.root(() => {
  $effect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(db))
    } catch (err) {
      console.error('Failed to save data.', err)
    }
  })
})

const stamp = () => new Date().toISOString()

// --- Selectors (call inside components / $derived to stay reactive) ---------

export function episodesSorted() {
  return [...db.episodes].sort((a, b) => new Date(b.occurredAt) - new Date(a.occurredAt))
}
export function getEpisode(id) {
  return db.episodes.find((e) => e.id === id) || null
}

export function medicationsSorted() {
  return [...db.medications].sort((a, b) => {
    if (a.active !== b.active) return a.active ? -1 : 1
    return (a.name || '').localeCompare(b.name || '')
  })
}
export function activeMedications() {
  return medicationsSorted().filter((m) => m.active)
}
export function getMedication(id) {
  return db.medications.find((m) => m.id === id) || null
}

export function getMedEvent(id) {
  return db.medEvents.find((m) => m.id === id) || null
}

export function batchesSorted() {
  return [...db.batches].sort((a, b) => a.order - b.order || (a.name || '').localeCompare(b.name || ''))
}
export function getBatch(id) {
  return db.batches.find((b) => b.id === id) || null
}
export function medicationsInBatch(batchId) {
  return activeMedications().filter((m) => (m.batchIds || []).includes(batchId))
}

// Merged, newest-first timeline. Doses logged together as a batch collapse into
// a single "medgroup" item so the log stays readable.
export function timeline() {
  const items = db.episodes.map((e) => ({ kind: 'seizure', when: e.occurredAt, id: e.id, data: e }))
  const groups = new Map()
  for (const m of db.medEvents) {
    if (m.groupId) {
      if (!groups.has(m.groupId)) {
        groups.set(m.groupId, { kind: 'medgroup', when: m.takenAt, id: m.groupId, batchName: m.batchName, events: [] })
      }
      groups.get(m.groupId).events.push(m)
    } else {
      items.push({ kind: 'med', when: m.takenAt, id: m.id, data: m })
    }
  }
  for (const g of groups.values()) items.push(g)
  return items.sort((a, b) => new Date(b.when) - new Date(a.when))
}

// --- Mutations --------------------------------------------------------------

function upsert(list, item) {
  const i = list.findIndex((x) => x.id === item.id)
  item.updatedAt = stamp()
  if (i >= 0) list[i] = item
  else list.push(item)
  return item
}

export const upsertEpisode = (ep) => upsert(db.episodes, ep)
export const deleteEpisode = (id) => { db.episodes = db.episodes.filter((e) => e.id !== id) }

export const upsertMedication = (m) => upsert(db.medications, m)
export function deleteMedication(id) {
  db.medications = db.medications.filter((m) => m.id !== id)
}

export const upsertMedEvent = (m) => upsert(db.medEvents, m)
export const deleteMedEvent = (id) => { db.medEvents = db.medEvents.filter((m) => m.id !== id) }
// Remove every dose that was logged together in one batch action.
export function deleteMedGroup(groupId) {
  db.medEvents = db.medEvents.filter((m) => m.groupId !== groupId)
}

export const upsertBatch = (b) => upsert(db.batches, b)
export function deleteBatch(id) {
  db.batches = db.batches.filter((b) => b.id !== id)
  // Drop the reference from any medication that belonged to it.
  db.medications.forEach((m) => {
    if ((m.batchIds || []).includes(id)) m.batchIds = m.batchIds.filter((x) => x !== id)
  })
}

// Log a set of doses for a batch in one action. `entries` is [{ med, skipped }].
export function logBatchDoses(batch, entries, takenAt) {
  const groupId = newId()
  for (const { med, skipped } of entries) {
    db.medEvents.push(createMedEvent({
      medicationId: med.id,
      medicationName: med.name,
      dose: med.dose,
      takenAt,
      skipped,
      batchId: batch.id,
      batchName: batch.name,
      groupId,
    }))
  }
  return groupId
}

// --- Settings ---------------------------------------------------------------

export function getSettings() {
  return db.settings
}
export function updateSettings(patch) {
  Object.assign(db.settings, patch)
}

// --- Backup / restore -------------------------------------------------------

export function exportJSON() {
  return JSON.stringify(db, null, 2)
}
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
  db.episodes = mergeById(db.episodes, incoming.episodes)
  db.medications = mergeById(db.medications, incoming.medications)
  db.medEvents = mergeById(db.medEvents, incoming.medEvents)
  db.batches = mergeById(db.batches, incoming.batches)
  return incoming.episodes.length
}
