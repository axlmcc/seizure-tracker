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
