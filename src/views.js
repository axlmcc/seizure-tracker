// View builders. Each returns { html, mount(root, navigate, rerender) }.
// mount() wires up event handlers after the html is inserted into the DOM.

import {
  DURING_SYMPTOMS, BEFORE_SYMPTOMS, AFTER_SYMPTOMS, TRIGGERS,
  AWARENESS_LEVELS, DURATION_PRESETS, MED_FREQUENCIES,
  createEpisode, createMedication, createMedEvent,
  formatDuration, formatDateTime, formatDate,
} from './model.js'
import {
  getEpisodes, getEpisode, upsertEpisode, deleteEpisode,
  getMedications, getActiveMedications, getMedication, upsertMedication, deleteMedication,
  getMedEvent, upsertMedEvent, deleteMedEvent, getTimeline,
  getSettings, exportJSON, importJSON,
} from './store.js'
import { toCSV, downloadFile, printReport, dateStamp } from './export.js'
import { isConfigured as driveConfigured, exportToDrive } from './google.js'
import { searchMedications } from './medsearch.js'

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const tick = '<svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>'

// Renders a checklist of chips. `selected` is the current array of chosen labels.
function chipList(group, options, selected) {
  return `<div class="chips" data-group="${group}">` + options.map((opt) => {
    const on = selected.includes(opt)
    return `<label class="chip ${on ? 'on' : ''}"><input type="checkbox" value="${esc(opt)}" ${on ? 'checked' : ''}>${tick}<span>${esc(opt)}</span></label>`
  }).join('') + '</div>'
}

// ===========================================================================
// LOG (merged timeline of seizures + medication events)
// ===========================================================================
export function LogView() {
  const items = getTimeline()

  const list = items.length
    ? items.map((item) => (item.kind === 'seizure' ? seizureCard(item.data) : medCard(item.data))).join('')
    : `<div class="empty"><div class="big">🗓️</div><p>Nothing logged yet.<br>Tap <strong>Seizure</strong> or <strong>Medication</strong> above when something happens.</p></div>`

  const html = `<main class="stack">
    <div class="row">
      <a class="btn btn-primary btn-lg" href="#/new" style="flex:1">＋ Seizure</a>
      <a class="btn btn-lg" href="#/med-event/new" style="flex:1">💊 Medication</a>
    </div>
    ${list}
    <p class="disclaimer">Everything stays on this device. A private record to share with a doctor — not a diagnosis.</p>
  </main>`

  return { html, mount() {} }
}

function seizureCard(e) {
  const symptoms = [...e.during, ...e.customSymptoms].slice(0, 3)
  const extra = e.during.length + e.customSymptoms.length - symptoms.length
  return `<a class="card episode seizure" href="#/episode/${e.id}">
    <div class="when">${esc(formatDateTime(e.occurredAt))}</div>
    <div class="meta">${esc(formatDuration(e.durationSeconds))}${e.awareness ? ' · ' + esc(e.awareness) : ''}${e.severity ? ' · severity ' + e.severity + '/5' : ''}</div>
    ${symptoms.length ? `<div class="tags">${symptoms.map((s) => `<span class="pill">${esc(s)}</span>`).join('')}${extra > 0 ? `<span class="pill">+${extra} more</span>` : ''}</div>` : ''}
  </a>`
}

function medCard(m) {
  return `<a class="card episode med" href="#/med-event/${m.id}">
    <div class="when">💊 ${esc(m.medicationName || 'Medication')}${m.skipped ? ' — skipped' : ''}</div>
    <div class="meta">${esc(formatDateTime(m.takenAt))}${m.dose ? ' · ' + esc(m.dose) : ''}</div>
    ${m.notes ? `<div class="tags"><span class="pill">${esc(m.notes)}</span></div>` : ''}
  </a>`
}

// ===========================================================================
// ADD (chooser: what do you want to log?)
// ===========================================================================
export function AddChooserView() {
  const html = `<main class="stack">
    <a class="btn btn-primary btn-lg btn-block" href="#/new">＋ Log a seizure</a>
    <a class="btn btn-lg btn-block" href="#/med-event/new">💊 Log medication taken</a>
    <div class="card stack">
      <h2>Medication list</h2>
      <p class="muted" style="margin:0; font-size:13px">Keep the list of medications up to date so it's ready to pick when logging a dose.</p>
      <a class="btn btn-block" href="#/meds">Manage medications</a>
    </div>
  </main>`
  return { html, mount() {} }
}

// ===========================================================================
// SEIZURE FORM (new / edit)
// ===========================================================================
export function FormView(id) {
  const existing = id ? getEpisode(id) : null
  const draft = existing ? JSON.parse(JSON.stringify(existing)) : createEpisode()

  const html = `<main class="stack">
    <div class="card stack">
      <div>
        <label class="field" for="occurredAt">When did it happen?</label>
        <input type="datetime-local" id="occurredAt" value="${esc(draft.occurredAt)}">
      </div>

      <div>
        <label class="field">How long did it last?</label>
        <div class="presets">
          ${DURATION_PRESETS.map((p) => `<button type="button" class="preset ${draft.durationSeconds === p.seconds ? 'on' : ''}" data-seconds="${p.seconds}">${p.label}</button>`).join('')}
        </div>
        <div class="row" style="margin-top:8px; align-items:center">
          <input type="number" id="durationCustom" inputmode="numeric" min="0" placeholder="or exact seconds" value="${draft.durationSeconds != null && !DURATION_PRESETS.some((p) => p.seconds === draft.durationSeconds) ? draft.durationSeconds : ''}" style="max-width:200px">
          <span class="muted">seconds</span>
        </div>
      </div>

      <div>
        <label class="field" for="awareness">Awareness during it</label>
        <select id="awareness">
          <option value="">Not sure yet…</option>
          ${AWARENESS_LEVELS.map((a) => `<option value="${esc(a)}" ${draft.awareness === a ? 'selected' : ''}>${esc(a)}</option>`).join('')}
        </select>
      </div>

      <div>
        <label class="field">Severity</label>
        <div class="severity" id="severity">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="sev-dot ${draft.severity === n ? 'on' : ''}" data-sev="${n}">${n}</button>`).join('')}
        </div>
        <p class="muted" style="margin:6px 0 0; font-size:13px">1 = barely noticeable · 5 = severe</p>
      </div>
    </div>

    <div class="card">
      <h2>During the episode</h2>
      ${chipList('during', DURING_SYMPTOMS, draft.during)}
    </div>

    <div class="card">
      <h2>Other symptoms</h2>
      <p class="muted" style="margin:0 0 10px; font-size:13px">Add anything not listed above.</p>
      <div class="row">
        <input type="text" id="customInput" placeholder="e.g. warm feeling in chest" style="flex:1; min-width:180px">
        <button type="button" id="customAdd" class="btn-primary">Add</button>
      </div>
      <div class="tag-list" id="customList"></div>
    </div>

    <div class="card">
      <h2>Warning signs (before)</h2>
      ${chipList('before', BEFORE_SYMPTOMS, draft.before)}
    </div>

    <div class="card">
      <h2>Afterwards (recovery)</h2>
      ${chipList('after', AFTER_SYMPTOMS, draft.after)}
    </div>

    <div class="card">
      <h2>Possible triggers</h2>
      ${chipList('triggers', TRIGGERS, draft.triggers)}
    </div>

    <div class="card stack">
      <div>
        <label class="field" for="activityBefore">What was she doing beforehand?</label>
        <input type="text" id="activityBefore" value="${esc(draft.activityBefore)}" placeholder="e.g. watching TV, eating dinner">
      </div>
      <div>
        <label class="field" for="witnessedBy">Witnessed by</label>
        <input type="text" id="witnessedBy" value="${esc(draft.witnessedBy)}" placeholder="e.g. Mom, no one">
      </div>
      <div>
        <label class="chip ${draft.injury ? 'on' : ''}" id="injuryChip" style="width:fit-content">
          <input type="checkbox" id="injury" ${draft.injury ? 'checked' : ''}>${tick}<span>An injury happened</span>
        </label>
        <input type="text" id="injuryNote" class="${draft.injury ? '' : 'hidden'}" style="margin-top:8px" value="${esc(draft.injuryNote)}" placeholder="Describe the injury">
      </div>
      <div>
        <label class="field" for="notes">Notes — what did it feel like?</label>
        <textarea id="notes" placeholder="Anything in her own words…">${esc(draft.notes)}</textarea>
      </div>
    </div>

    <button type="button" id="save" class="btn-primary btn-lg btn-block">${existing ? 'Save changes' : 'Save episode'}</button>
    <a class="btn btn-block" href="${existing ? '#/episode/' + existing.id : '#/'}" id="cancel">Cancel</a>
    ${existing ? '<button type="button" id="delete" class="btn-danger btn-block">Delete this episode</button>' : ''}
  </main>`

  function mount(root, navigate) {
    const customList = root.querySelector('#customList')
    function renderCustom() {
      customList.innerHTML = draft.customSymptoms
        .map((s, i) => `<span class="tag">${esc(s)}<button type="button" data-i="${i}" aria-label="Remove">×</button></span>`)
        .join('')
    }
    renderCustom()
    customList.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]')
      if (!btn) return
      draft.customSymptoms.splice(Number(btn.dataset.i), 1)
      renderCustom()
    })
    const customInput = root.querySelector('#customInput')
    function addCustom() {
      const v = customInput.value.trim()
      if (!v) return
      if (!draft.customSymptoms.includes(v)) draft.customSymptoms.push(v)
      customInput.value = ''
      renderCustom()
      customInput.focus()
    }
    root.querySelector('#customAdd').addEventListener('click', addCustom)
    customInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } })

    root.querySelectorAll('.chips').forEach((group) => {
      const key = group.dataset.group
      group.addEventListener('change', (e) => {
        const input = e.target.closest('input[type="checkbox"]')
        if (!input) return
        input.closest('.chip').classList.toggle('on', input.checked)
        const val = input.value
        if (input.checked) {
          if (!draft[key].includes(val)) draft[key].push(val)
        } else {
          draft[key] = draft[key].filter((v) => v !== val)
        }
      })
    })

    const durationCustom = root.querySelector('#durationCustom')
    root.querySelectorAll('.preset').forEach((btn) => {
      btn.addEventListener('click', () => {
        const secs = Number(btn.dataset.seconds)
        const already = btn.classList.contains('on')
        root.querySelectorAll('.preset').forEach((b) => b.classList.remove('on'))
        if (already) {
          draft.durationSeconds = null
        } else {
          btn.classList.add('on')
          draft.durationSeconds = secs
          durationCustom.value = ''
        }
      })
    })
    durationCustom.addEventListener('input', () => {
      root.querySelectorAll('.preset').forEach((b) => b.classList.remove('on'))
      draft.durationSeconds = durationCustom.value === '' ? null : Number(durationCustom.value)
    })

    root.querySelector('#awareness').addEventListener('change', (e) => { draft.awareness = e.target.value })

    root.querySelectorAll('.sev-dot').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.sev)
        draft.severity = draft.severity === n ? 0 : n
        root.querySelectorAll('.sev-dot').forEach((b) => b.classList.toggle('on', Number(b.dataset.sev) === draft.severity))
      })
    })

    const bind = (sel, key) => root.querySelector(sel).addEventListener('input', (e) => { draft[key] = e.target.value })
    bind('#activityBefore', 'activityBefore')
    bind('#witnessedBy', 'witnessedBy')
    bind('#notes', 'notes')
    bind('#injuryNote', 'injuryNote')

    const injury = root.querySelector('#injury')
    const injuryNote = root.querySelector('#injuryNote')
    injury.addEventListener('change', () => {
      draft.injury = injury.checked
      root.querySelector('#injuryChip').classList.toggle('on', injury.checked)
      injuryNote.classList.toggle('hidden', !injury.checked)
    })

    root.querySelector('#occurredAt').addEventListener('input', (e) => { draft.occurredAt = e.target.value })

    root.querySelector('#save').addEventListener('click', () => {
      if (!draft.occurredAt) { alert('Please set when it happened.'); return }
      upsertEpisode(draft)
      navigate('#/')
    })

    const del = root.querySelector('#delete')
    if (del) {
      del.addEventListener('click', () => {
        if (confirm('Delete this episode? This cannot be undone.')) {
          deleteEpisode(existing.id)
          navigate('#/')
        }
      })
    }
  }

  return { html, mount }
}

// ===========================================================================
// MEDICATION EVENT FORM (log a dose taken / skipped)
// ===========================================================================
export function MedEventFormView(id) {
  const existing = id ? getMedEvent(id) : null
  const activeMeds = getActiveMedications()

  // Can't log a dose with no medications on file yet.
  if (!existing && activeMeds.length === 0) {
    const html = `<main><div class="card stack">
      <h2>No medications yet</h2>
      <p class="muted" style="margin:0; font-size:13px">Add the medications she's taking first, then you can log when she takes them.</p>
      <a class="btn btn-primary btn-block" href="#/med/new">Add a medication</a>
      <a class="btn btn-block" href="#/">Cancel</a>
    </div></main>`
    return { html, mount() {} }
  }

  const draft = existing ? { ...existing } : createMedEvent()

  // Build the pick list. When editing, make sure the event's own medication is
  // selectable even if it's since been stopped or deleted.
  const optionMeds = [...activeMeds]
  if (draft.medicationId && !optionMeds.some((m) => m.id === draft.medicationId)) {
    optionMeds.push({ id: draft.medicationId, name: draft.medicationName || 'Medication', dose: draft.dose })
  }
  // Default a new event to the first medication.
  if (!existing && optionMeds.length) {
    draft.medicationId = optionMeds[0].id
    draft.medicationName = optionMeds[0].name
    if (!draft.dose) draft.dose = optionMeds[0].dose || ''
  }

  const html = `<main class="stack">
    <div class="card stack">
      <div>
        <label class="field" for="medSelect">Which medication?</label>
        <select id="medSelect">
          ${optionMeds.map((m) => `<option value="${m.id}" data-name="${esc(m.name)}" data-dose="${esc(m.dose || '')}" ${draft.medicationId === m.id ? 'selected' : ''}>${esc(m.name)}${m.dose ? ` (${esc(m.dose)})` : ''}</option>`).join('')}
        </select>
        <a href="#/meds" class="muted" style="display:inline-block; margin-top:8px; font-size:13px">Manage medication list →</a>
      </div>
      <div>
        <label class="field" for="takenAt">When?</label>
        <input type="datetime-local" id="takenAt" value="${esc(draft.takenAt)}">
      </div>
      <div>
        <label class="field" for="dose">Dose</label>
        <input type="text" id="dose" value="${esc(draft.dose)}" placeholder="e.g. 50 mg">
      </div>
      <div>
        <label class="chip ${draft.skipped ? 'on' : ''}" id="skippedChip" style="width:fit-content">
          <input type="checkbox" id="skipped" ${draft.skipped ? 'checked' : ''}>${tick}<span>This dose was missed / skipped</span>
        </label>
      </div>
      <div>
        <label class="field" for="medNotes">Notes</label>
        <textarea id="medNotes" placeholder="Anything worth noting…">${esc(draft.notes)}</textarea>
      </div>
    </div>

    <button type="button" id="save" class="btn-primary btn-lg btn-block">${existing ? 'Save changes' : 'Save'}</button>
    <a class="btn btn-block" href="#/">Cancel</a>
    ${existing ? '<button type="button" id="delete" class="btn-danger btn-block">Delete this entry</button>' : ''}
  </main>`

  function mount(root, navigate) {
    const select = root.querySelector('#medSelect')
    const dose = root.querySelector('#dose')
    select.addEventListener('change', () => {
      const opt = select.selectedOptions[0]
      draft.medicationId = select.value
      draft.medicationName = opt?.dataset.name || ''
      // Prefill dose from the chosen medication (user can still edit).
      dose.value = opt?.dataset.dose || ''
      draft.dose = dose.value
    })
    dose.addEventListener('input', () => { draft.dose = dose.value })
    root.querySelector('#takenAt').addEventListener('input', (e) => { draft.takenAt = e.target.value })
    root.querySelector('#medNotes').addEventListener('input', (e) => { draft.notes = e.target.value })

    const skipped = root.querySelector('#skipped')
    skipped.addEventListener('change', () => {
      draft.skipped = skipped.checked
      root.querySelector('#skippedChip').classList.toggle('on', skipped.checked)
    })

    root.querySelector('#save').addEventListener('click', () => {
      if (!draft.medicationId) { alert('Please choose a medication.'); return }
      if (!draft.takenAt) { alert('Please set when it was taken.'); return }
      upsertMedEvent(draft)
      navigate('#/')
    })

    const del = root.querySelector('#delete')
    if (del) {
      del.addEventListener('click', () => {
        if (confirm('Delete this entry? This cannot be undone.')) {
          deleteMedEvent(existing.id)
          navigate('#/')
        }
      })
    }
  }

  return { html, mount }
}

// ===========================================================================
// MEDICATION LIST (manage the regimen)
// ===========================================================================
export function MedListView() {
  const meds = getMedications()

  const list = meds.length
    ? meds.map((m) => `<a class="card episode med" href="#/med/${m.id}">
        <div class="when">${esc(m.name)}${m.active ? '' : ' <span class="pill">stopped</span>'}</div>
        <div class="meta">${[m.dose, m.frequency].filter(Boolean).map(esc).join(' · ') || '—'}${m.startedAt ? ' · since ' + esc(formatDate(m.startedAt)) : ''}</div>
      </a>`).join('')
    : `<div class="empty"><div class="big">💊</div><p>No medications added yet.</p></div>`

  const html = `<main class="stack">
    <a class="btn btn-primary btn-lg btn-block" href="#/med/new">＋ Add a medication</a>
    ${list}
    <a class="btn btn-block" href="#/settings">Back to settings</a>
  </main>`

  return { html, mount() {} }
}

// ===========================================================================
// MEDICATION FORM (add / edit a medication)
// ===========================================================================
export function MedFormView(id) {
  const existing = id ? getMedication(id) : null
  const draft = existing ? { ...existing } : createMedication()

  const html = `<main class="stack">
    <div class="card stack">
      <div>
        <label class="field" for="name">Medication name</label>
        <div class="autocomplete">
          <input type="text" id="name" value="${esc(draft.name)}" placeholder="Start typing…" autocomplete="off">
          <div id="nameSuggest" class="suggestions hidden"></div>
        </div>
        <p class="muted" style="margin:6px 0 0; font-size:13px">Suggestions come from the U.S. National Library of Medicine — pick one, or just type it in.</p>
      </div>
      <div>
        <label class="field" for="mdose">Dose</label>
        <input type="text" id="mdose" list="doseOptions" value="${esc(draft.dose)}" placeholder="e.g. 50 mg">
        <datalist id="doseOptions"></datalist>
      </div>
      <div>
        <label class="field" for="frequency">How often</label>
        <input type="text" id="frequency" list="freqOptions" value="${esc(draft.frequency)}" placeholder="e.g. Twice daily">
        <datalist id="freqOptions">${MED_FREQUENCIES.map((f) => `<option value="${esc(f)}">`).join('')}</datalist>
      </div>
      <div>
        <label class="field" for="startedAt">Started taking it on</label>
        <input type="date" id="startedAt" value="${esc(draft.startedAt)}">
        <p class="muted" style="margin:6px 0 0; font-size:13px">Used to line up new medications with seizure timing on the Insights page.</p>
      </div>
      <div>
        <label class="chip ${draft.active ? 'on' : ''}" id="activeChip" style="width:fit-content">
          <input type="checkbox" id="active" ${draft.active ? 'checked' : ''}>${tick}<span>Currently taking this</span>
        </label>
        <p class="muted" style="margin:6px 0 0; font-size:13px">Turn off if she's stopped — it stays in the history but won't show when logging new doses.</p>
      </div>
      <div>
        <label class="field" for="mnotes">Notes</label>
        <textarea id="mnotes" placeholder="Prescriber, reason, side effects…">${esc(draft.notes)}</textarea>
      </div>
    </div>

    <button type="button" id="save" class="btn-primary btn-lg btn-block">${existing ? 'Save changes' : 'Add medication'}</button>
    <a class="btn btn-block" href="#/meds">Cancel</a>
    ${existing ? '<button type="button" id="delete" class="btn-danger btn-block">Delete medication</button>' : ''}
  </main>`

  function mount(root, navigate) {
    const bind = (sel, key) => root.querySelector(sel).addEventListener('input', (e) => { draft[key] = e.target.value })
    bind('#mdose', 'dose')
    bind('#frequency', 'frequency')
    bind('#startedAt', 'startedAt')
    bind('#mnotes', 'notes')

    // Medication-name autocomplete (debounced; cancels in-flight requests).
    const nameInput = root.querySelector('#name')
    const box = root.querySelector('#nameSuggest')
    const doseOptions = root.querySelector('#doseOptions')
    let timer = null
    let controller = null
    const hide = () => { box.classList.add('hidden'); box.innerHTML = ''; box._items = null }
    const show = (items) => {
      if (!items.length) { hide(); return }
      box._items = items
      box.innerHTML = items.map((it, i) =>
        `<button type="button" data-i="${i}"><span class="s-name">${esc(it.name)}</span>${it.strengths.length ? `<span class="s-sub">${esc(it.strengths.slice(0, 4).join(' · '))}</span>` : ''}</button>`
      ).join('')
      box.classList.remove('hidden')
    }
    nameInput.addEventListener('input', () => {
      draft.name = nameInput.value
      const q = nameInput.value.trim()
      clearTimeout(timer)
      if (controller) controller.abort()
      if (q.length < 2) { hide(); return }
      timer = setTimeout(async () => {
        controller = new AbortController()
        try {
          const items = await searchMedications(q, { signal: controller.signal })
          if (nameInput.value.trim() === q) show(items) // ignore stale responses
        } catch (err) {
          if (err.name !== 'AbortError') hide() // fail quietly — manual entry still works
        }
      }, 250)
    })
    box.addEventListener('click', (e) => {
      const btn = e.target.closest('button[data-i]')
      if (!btn || !box._items) return
      const it = box._items[Number(btn.dataset.i)]
      nameInput.value = it.name
      draft.name = it.name
      // Offer the medication's strengths as dose suggestions.
      doseOptions.innerHTML = it.strengths.map((s) => `<option value="${esc(s)}"></option>`).join('')
      hide()
      root.querySelector('#mdose').focus()
    })
    nameInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') hide() })
    nameInput.addEventListener('blur', () => setTimeout(hide, 150)) // allow click to register

    const active = root.querySelector('#active')
    active.addEventListener('change', () => {
      draft.active = active.checked
      root.querySelector('#activeChip').classList.toggle('on', active.checked)
    })

    root.querySelector('#save').addEventListener('click', () => {
      if (!draft.name.trim()) { alert('Please enter the medication name.'); return }
      upsertMedication(draft)
      navigate('#/meds')
    })

    const del = root.querySelector('#delete')
    if (del) {
      del.addEventListener('click', () => {
        if (confirm(`Delete “${existing.name}”? Logged doses stay in the history.`)) {
          deleteMedication(existing.id)
          navigate('#/meds')
        }
      })
    }
  }

  return { html, mount }
}

// ===========================================================================
// INSIGHTS
// ===========================================================================
export function InsightsView() {
  const episodes = getEpisodes()
  const meds = getMedications()

  if (!episodes.length && !meds.length) {
    return { html: `<main><div class="empty"><div class="big">📊</div><p>Patterns will show up here once a few episodes are logged.</p></div></main>`, mount() {} }
  }

  const now = Date.now()
  const last30 = episodes.filter((e) => now - new Date(e.occurredAt).getTime() <= 30 * 864e5).length
  const withDur = episodes.filter((e) => e.durationSeconds != null)
  const avgDur = withDur.length ? Math.round(withDur.reduce((s, e) => s + Number(e.durationSeconds), 0) / withDur.length) : null

  const tally = (key) => {
    const counts = {}
    episodes.forEach((e) => (e[key] || []).forEach((v) => { counts[v] = (counts[v] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1])
  }
  const topTriggers = tally('triggers').slice(0, 6)
  const topSymptoms = tally('during').slice(0, 6)

  function bars(entries) {
    if (!entries.length) return '<p class="muted">Nothing recorded yet.</p>'
    const max = entries[0][1]
    return entries.map(([name, n]) => `
      <div class="bar-row">
        <div class="name">${esc(name)}</div>
        <div class="bar-track"><div class="bar-fill" style="width:${Math.round((n / max) * 100)}%"></div></div>
        <div class="n">${n}</div>
      </div>`).join('')
  }

  const timeline = weeklyTimeline(episodes, meds)

  const statMostRecent = episodes.length ? formatDateTime(episodes[0].occurredAt).split(',')[0] : '—'

  const html = `<main class="stack">
    <div class="stat-grid">
      <div class="stat"><div class="num">${episodes.length}</div><div class="lbl">Total seizures</div></div>
      <div class="stat"><div class="num">${last30}</div><div class="lbl">Last 30 days</div></div>
      <div class="stat"><div class="num">${avgDur != null ? formatDuration(avgDur) : '—'}</div><div class="lbl">Avg duration</div></div>
      <div class="stat"><div class="num">${statMostRecent}</div><div class="lbl">Most recent</div></div>
    </div>

    <div class="card">
      <h2>Seizures per week vs. medication changes</h2>
      ${timeline.svg}
      ${timeline.legend}
      <p class="muted" style="margin:10px 0 0; font-size:12px">Each bar is one week (last 12). Numbered lines mark when a medication was started — match the number to the list below and look for a change in the bars afterwards.</p>
    </div>

    <div class="card"><h2>Most common symptoms</h2>${bars(topSymptoms)}</div>
    <div class="card"><h2>Most common triggers</h2>${bars(topTriggers)}</div>
    <p class="disclaimer">These counts are only as reliable as what's been logged. Bring the full log to a doctor for interpretation — a pattern here is a question to ask, not an answer.</p>
  </main>`

  return { html, mount() {} }
}

// Builds a 12-week SVG bar chart of seizure counts with numbered vertical
// markers for medications *started within the window* (older meds are
// summarised as a footnote so the chart stays readable even with a long
// regimen). Returns { svg, legend }.
function weeklyTimeline(episodes, meds) {
  const WEEKS = 12
  const DAY = 864e5
  const MARKER = '#d98a2b' // one contrasting colour; the numbers disambiguate
  const startOfWeek = (d) => {
    const x = new Date(d)
    const dow = (x.getDay() + 6) % 7 // Monday = 0
    x.setHours(0, 0, 0, 0)
    x.setDate(x.getDate() - dow)
    return x
  }
  // Parse a yyyy-mm-dd string as a local date.
  const parseLocalDate = (v) => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '')
    return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v)
  }

  const thisWeek = startOfWeek(new Date())
  const first = new Date(thisWeek)
  first.setDate(first.getDate() - (WEEKS - 1) * 7)
  const windowEnd = new Date(thisWeek)
  windowEnd.setDate(windowEnd.getDate() + 7)

  const weeks = Array.from({ length: WEEKS }, (_, i) => {
    const s = new Date(first)
    s.setDate(s.getDate() + i * 7)
    return { start: s, count: 0 }
  })
  episodes.forEach((e) => {
    const t = new Date(e.occurredAt)
    const idx = Math.floor((startOfWeek(t) - first) / (7 * DAY))
    if (idx >= 0 && idx < WEEKS) weeks[idx].count++
  })
  const max = Math.max(1, ...weeks.map((w) => w.count))

  // Chart geometry (viewBox units; scales responsively). Extra top padding
  // leaves room for two staggered rows of marker numbers.
  const W = 320, H = 156, padL = 6, padR = 6, padT = 30, padB = 26
  const plotW = W - padL - padR
  const plotH = H - padT - padB
  const bw = plotW / WEEKS
  const yBase = padT + plotH

  const barEls = weeks.map((w, i) => {
    const h = (w.count / max) * plotH
    const x = padL + i * bw + bw * 0.18
    const bwi = bw * 0.64
    const y = yBase - h
    const label = w.count > 0 ? `<text x="${x + bwi / 2}" y="${y - 3}" text-anchor="middle" font-size="8" fill="var(--muted)">${w.count}</text>` : ''
    return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bwi.toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="var(--accent)"></rect>${label}`
  }).join('')

  // X-axis: label every 3rd week start.
  const xLabels = weeks.map((w, i) => {
    if (i % 3 !== 0) return ''
    const x = padL + i * bw + bw / 2
    const lbl = w.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
    return `<text x="${x.toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="8" fill="var(--muted)">${lbl}</text>`
  }).join('')

  // Split medications into "started in this window" (get numbered markers) and
  // "started earlier" (summarised as a footnote).
  const started = []
  let earlier = 0
  meds.forEach((m) => {
    if (!m.startedAt) return
    const d = parseLocalDate(m.startedAt)
    if (isNaN(d)) return
    if (d >= first && d < windowEnd) started.push({ m, d })
    else if (d < first) earlier++
  })
  started.sort((a, b) => a.d - b.d)

  // Draw numbered markers; stagger labels into two rows when they crowd.
  let prevX = -Infinity
  let lane = 0
  const markers = started.map(({ d }, i) => {
    const x = padL + ((d - first) / DAY / 7) * bw
    lane = x - prevX < 16 ? (lane + 1) % 2 : 0
    prevX = x
    const labelY = 12 + lane * 12
    return `<line x1="${x.toFixed(1)}" y1="${labelY + 4}" x2="${x.toFixed(1)}" y2="${yBase}" stroke="${MARKER}" stroke-width="1.3" opacity="0.85"></line>
      <text x="${x.toFixed(1)}" y="${labelY}" text-anchor="middle" font-size="9" font-weight="700" fill="${MARKER}">${i + 1}</text>`
  }).join('')

  const svg = `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Seizures per week with numbered medication-start markers">
    <line x1="${padL}" y1="${yBase}" x2="${W - padR}" y2="${yBase}" stroke="var(--border)" stroke-width="1"></line>
    ${barEls}
    ${markers}
    ${xLabels}
  </svg>`

  const legendItems = started.map(({ m }, i) =>
    `<div class="item"><span class="num" style="background:${MARKER}">${i + 1}</span>Started <strong>${esc(m.name)}</strong> · ${esc(formatDate(m.startedAt))}</div>`
  )
  const footnote = earlier
    ? `<div class="item muted-note">＋ ${earlier} other medication${earlier === 1 ? '' : 's'} started before this window (see the medication list).</div>`
    : ''
  const legend = legendItems.length || footnote
    ? `<div class="legend">${legendItems.join('')}${footnote}</div>`
    : `<p class="muted" style="margin:8px 0 0; font-size:13px">No medications were started in the last 12 weeks.</p>`

  return { svg, legend }
}

// ===========================================================================
// SETTINGS / EXPORT
// ===========================================================================
export function SettingsView() {
  const episodes = getEpisodes()
  const meds = getMedications()
  const settings = getSettings()
  const driveOn = driveConfigured()

  const html = `<main class="stack">
    <div class="card stack">
      <h2>Medications</h2>
      <p class="muted" style="margin:0; font-size:13px">${meds.length} medication${meds.length === 1 ? '' : 's'} on file. This list is what you pick from when logging a dose.</p>
      <a class="btn btn-block" href="#/meds">Manage medications</a>
    </div>

    <div class="card stack">
      <h2>Export for the doctor</h2>
      <button type="button" id="pdf" class="btn-primary btn-block">🖨️ Printable report (Save as PDF)</button>
      <button type="button" id="csv" class="btn-block">⬇️ Download spreadsheet (CSV)</button>
      ${driveOn
        ? `<button type="button" id="drive" class="btn-block">📄 Export to Google Drive (Sheets)</button>
           ${settings.driveFileId ? `<p class="muted" style="margin:0; font-size:13px">Updates your existing “${esc(settings.driveFileName)}” sheet.</p>` : ''}`
        : `<div class="banner banner-info">Google Drive export is off. Add a Google client ID (see README) to turn it on. CSV and PDF work without it.</div>`}
      <div id="exportStatus" class="muted" style="font-size:13px"></div>
    </div>

    <div class="card stack">
      <h2>Backup &amp; restore</h2>
      <p class="muted" style="margin:0; font-size:13px">A full backup file (seizures + medications) you can keep or move to a new phone.</p>
      <button type="button" id="backup" class="btn-block">Save backup file (JSON)</button>
      <label class="btn btn-block" for="restoreFile" style="cursor:pointer">Restore from backup…</label>
      <input type="file" id="restoreFile" accept="application/json,.json" class="hidden">
    </div>

    <div class="card">
      <h2>About</h2>
      <p class="muted" style="margin:0; font-size:13px">Seizure Tracker keeps everything on this device. ${episodes.length} seizure${episodes.length === 1 ? '' : 's'} stored. Nothing is uploaded unless you export it.</p>
    </div>
  </main>`

  function mount(root, navigate, rerender) {
    const status = root.querySelector('#exportStatus')
    const setStatus = (msg, isError) => { status.textContent = msg; status.style.color = isError ? 'var(--danger)' : 'var(--muted)' }

    root.querySelector('#pdf').addEventListener('click', () => printReport(getEpisodes(), getMedications()))

    root.querySelector('#csv').addEventListener('click', () => {
      downloadFile(`seizure-log-${dateStamp()}.csv`, toCSV(getEpisodes()), 'text/csv;charset=utf-8')
    })

    const driveBtn = root.querySelector('#drive')
    if (driveBtn) {
      driveBtn.addEventListener('click', async () => {
        driveBtn.disabled = true
        setStatus('Connecting to Google…')
        try {
          const file = await exportToDrive(toCSV(getEpisodes()), settings.driveFileName || 'Seizure Log')
          setStatus('')
          if (file.webViewLink && confirm(`Saved to Google Drive as “${file.name}”.\n\nOpen it now?`)) {
            window.open(file.webViewLink, '_blank')
          } else {
            alert(`Saved to Google Drive as “${file.name}”.`)
          }
        } catch (err) {
          setStatus(err.message || 'Google Drive export failed.', true)
        } finally {
          driveBtn.disabled = false
        }
      })
    }

    root.querySelector('#backup').addEventListener('click', () => {
      downloadFile(`seizure-tracker-backup-${dateStamp()}.json`, exportJSON(), 'application/json')
    })

    root.querySelector('#restoreFile').addEventListener('change', async (e) => {
      const file = e.target.files[0]
      if (!file) return
      try {
        const text = await file.text()
        const count = importJSON(text)
        alert(`Restored — ${count} episode${count === 1 ? '' : 's'} merged in.`)
        rerender()
      } catch (err) {
        alert('Could not restore: ' + (err.message || err))
      } finally {
        e.target.value = ''
      }
    })
  }

  return { html, mount }
}
