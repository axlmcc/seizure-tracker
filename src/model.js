// Data model, medical field vocabulary, and the episode factory.
//
// The symptom / trigger vocabulary below is tuned for absence-type and
// focal-aware-impaired ("checking out") seizures, which is what we're trying
// to characterize. Every checklist also supports free-text custom entries, so
// nothing here is a hard limit — it's just a fast-tap starting point.

// A stable id without external deps. crypto.randomUUID is available in all
// modern browsers (and required for the app's minimum target).
export function newId() {
  return crypto.randomUUID()
}

// --- Checklist vocabularies -------------------------------------------------

export const DURING_SYMPTOMS = [
  'Blank stare / "checked out"',
  'Unresponsive to voice or touch',
  'Stopped mid-activity / froze',
  'Eyelid fluttering or rapid blinking',
  'Eyes rolled or drifted up / to the side',
  'Lip smacking, chewing, or swallowing',
  'Hand movements (picking, fumbling, rubbing)',
  'Mumbling or random speech',
  'Slight head nodding or dropping',
  'Brief body stiffening or twitching',
  'No memory of the episode',
]

export const BEFORE_SYMPTOMS = [
  'No warning at all',
  'Déjà vu or a strange familiar feeling',
  'Dizziness or lightheadedness',
  'Visual changes (spots, blurring)',
  'Nausea or a rising stomach feeling',
  'Sudden fear or anxiety',
  'Unusual smell or taste',
  'Tingling or numbness',
]

export const AFTER_SYMPTOMS = [
  'Back to normal quickly',
  'Confusion',
  'Tiredness / needing to sleep',
  'Headache',
  'Trouble speaking or finding words',
  'Emotional (tearful, irritable)',
  'Muscle soreness',
]

export const TRIGGERS = [
  'Poor or little sleep',
  'Stress or anxiety',
  'Missed medication',
  'Skipped meal / hunger',
  'Illness or fever',
  'Flashing or flickering lights',
  'Menstruation / hormonal',
  'Alcohol',
  'Caffeine',
  'Dehydration',
  'Overheating',
  'Long screen time',
]

export const AWARENESS_LEVELS = [
  'Fully aware throughout',
  'Partly aware',
  'Not aware / no memory',
  'Unsure',
]

// Quick-tap duration presets (seconds). Custom entry is always available too.
export const DURATION_PRESETS = [
  { label: '<10s', seconds: 5 },
  { label: '10s', seconds: 10 },
  { label: '30s', seconds: 30 },
  { label: '1 min', seconds: 60 },
  { label: '2 min', seconds: 120 },
  { label: '5 min', seconds: 300 },
]

// --- Episode factory --------------------------------------------------------

// Returns a local ISO-ish datetime string suitable for <input type="datetime-local">.
export function nowLocalInput() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function createEpisode(overrides = {}) {
  return {
    id: newId(),
    // When the episode happened (datetime-local string, in the user's local time).
    occurredAt: nowLocalInput(),
    durationSeconds: null,
    awareness: '',
    severity: 0, // 0 = not set, 1 (mild) .. 5 (severe)
    during: [],
    before: [],
    after: [],
    triggers: [],
    customSymptoms: [], // array of free-text strings
    activityBefore: '',
    witnessedBy: '',
    injury: false,
    injuryNote: '',
    notes: '',
    // Bookkeeping.
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// Human-readable duration from seconds.
export function formatDuration(seconds) {
  if (seconds == null || seconds === '') return '—'
  const s = Number(seconds)
  if (!Number.isFinite(s)) return '—'
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  const rem = s % 60
  return rem ? `${m}m ${rem}s` : `${m}m`
}

// Friendly date/time from the stored datetime-local string.
export function formatDateTime(occurredAt) {
  if (!occurredAt) return '—'
  const d = new Date(occurredAt)
  if (isNaN(d)) return occurredAt
  return d.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Friendly date-only from a yyyy-mm-dd string (or any parseable date).
export function formatDate(value) {
  if (!value) return '—'
  // Parse yyyy-mm-dd as local (not UTC) to avoid off-by-one-day surprises.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(value)
  if (isNaN(d)) return value
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// --- Medications ------------------------------------------------------------

// Common dosing schedules offered as autocomplete suggestions (free text still allowed).
export const MED_FREQUENCIES = [
  'Once daily',
  'Twice daily',
  'Three times daily',
  'Every morning',
  'Every night',
  'As needed',
]

export function todayLocalDate() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// A medication in her regimen (managed in Settings). This is the "list" that
// medication-taken events reference.
export function createMedication(overrides = {}) {
  return {
    id: newId(),
    name: '',
    dose: '', // e.g. "50 mg"
    frequency: '', // free text, with MED_FREQUENCIES as suggestions
    startedAt: todayLocalDate(), // date this med was started — key for correlation
    active: true, // false = stopped taking it (kept for history)
    batchIds: [], // which time-of-day batches this med belongs to
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}

// A time-of-day group of medications (e.g. "Morning"). Seeded with defaults but
// fully editable.
export const DEFAULT_BATCH_NAMES = ['Morning', 'Midday', 'Evening']

export function createBatch(overrides = {}) {
  return {
    id: newId(),
    name: '',
    order: 0,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

// A logged "I took (or skipped) a dose" event. Snapshots name/dose so the log
// stays accurate even if the medication is later edited or removed.
export function createMedEvent(overrides = {}) {
  return {
    id: newId(),
    medicationId: '',
    medicationName: '',
    dose: '',
    takenAt: nowLocalInput(),
    skipped: false, // true = a missed / skipped dose
    batchId: '', // set when logged as part of a batch
    batchName: '', // snapshot for display
    groupId: '', // shared by all doses logged together in one batch action
    notes: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  }
}
