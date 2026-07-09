// View builders. Each returns { html, mount(root) }.
// mount() wires up event handlers after the html is inserted into the DOM.

import {
  DURING_SYMPTOMS, BEFORE_SYMPTOMS, AFTER_SYMPTOMS, TRIGGERS,
  AWARENESS_LEVELS, DURATION_PRESETS,
  createEpisode, formatDuration, formatDateTime,
} from './model.js'
import {
  getEpisodes, getEpisode, upsertEpisode, deleteEpisode,
  getSettings, exportJSON, importJSON,
} from './store.js'
import { toCSV, downloadFile, printReport, dateStamp } from './export.js'
import { isConfigured as driveConfigured, exportToDrive } from './google.js'

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
// LOG (list of episodes)
// ===========================================================================
export function LogView() {
  const episodes = getEpisodes()

  const list = episodes.length
    ? episodes.map((e) => {
        const symptoms = [...e.during, ...e.customSymptoms].slice(0, 3)
        const extra = e.during.length + e.customSymptoms.length - symptoms.length
        return `<a class="card episode" href="#/episode/${e.id}">
          <div class="when">${esc(formatDateTime(e.occurredAt))}</div>
          <div class="meta">${esc(formatDuration(e.durationSeconds))}${e.awareness ? ' · ' + esc(e.awareness) : ''}${e.severity ? ' · severity ' + e.severity + '/5' : ''}</div>
          ${symptoms.length ? `<div class="tags">${symptoms.map((s) => `<span class="pill">${esc(s)}</span>`).join('')}${extra > 0 ? `<span class="pill">+${extra} more</span>` : ''}</div>` : ''}
        </a>`
      }).join('')
    : `<div class="empty"><div class="big">🗓️</div><p>No episodes logged yet.<br>Tap <strong>Log an episode</strong> when something happens.</p></div>`

  const html = `<main class="stack">
    <a class="btn btn-primary btn-lg btn-block" href="#/new">＋ Log an episode</a>
    ${list}
    <p class="disclaimer">Your data stays on this device. It's a private record to share with a doctor — not a diagnosis.</p>
  </main>`

  return { html, mount() {} }
}

// ===========================================================================
// FORM (new / edit an episode)
// ===========================================================================
export function FormView(id) {
  const existing = id ? getEpisode(id) : null
  // Work on a copy so cancelling discards changes.
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
    // Custom symptom tags.
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

    // Chip checklists.
    root.querySelectorAll('.chips').forEach((group) => {
      const key = group.dataset.group
      group.addEventListener('change', (e) => {
        const input = e.target.closest('input[type="checkbox"]')
        if (!input) return
        const label = input.closest('.chip')
        label.classList.toggle('on', input.checked)
        const val = input.value
        if (input.checked) {
          if (!draft[key].includes(val)) draft[key].push(val)
        } else {
          draft[key] = draft[key].filter((v) => v !== val)
        }
      })
    })

    // Duration presets + custom.
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

    // Awareness.
    root.querySelector('#awareness').addEventListener('change', (e) => { draft.awareness = e.target.value })

    // Severity.
    root.querySelectorAll('.sev-dot').forEach((btn) => {
      btn.addEventListener('click', () => {
        const n = Number(btn.dataset.sev)
        draft.severity = draft.severity === n ? 0 : n
        root.querySelectorAll('.sev-dot').forEach((b) => b.classList.toggle('on', Number(b.dataset.sev) === draft.severity))
      })
    })

    // Text fields.
    const bind = (sel, key) => root.querySelector(sel).addEventListener('input', (e) => { draft[key] = e.target.value })
    bind('#activityBefore', 'activityBefore')
    bind('#witnessedBy', 'witnessedBy')
    bind('#notes', 'notes')
    bind('#injuryNote', 'injuryNote')

    // Injury toggle.
    const injury = root.querySelector('#injury')
    const injuryNote = root.querySelector('#injuryNote')
    injury.addEventListener('change', () => {
      draft.injury = injury.checked
      root.querySelector('#injuryChip').classList.toggle('on', injury.checked)
      injuryNote.classList.toggle('hidden', !injury.checked)
    })

    // occurredAt.
    root.querySelector('#occurredAt').addEventListener('input', (e) => { draft.occurredAt = e.target.value })

    // Save.
    root.querySelector('#save').addEventListener('click', () => {
      if (!draft.occurredAt) { alert('Please set when it happened.'); return }
      upsertEpisode(draft)
      navigate('#/')
    })

    // Delete.
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
// INSIGHTS (basic stats to help spot patterns)
// ===========================================================================
export function InsightsView() {
  const episodes = getEpisodes()

  if (!episodes.length) {
    return { html: `<main><div class="empty"><div class="big">📊</div><p>Patterns will show up here once a few episodes are logged.</p></div></main>`, mount() {} }
  }

  // Last 30 days count.
  const now = Date.now()
  const last30 = episodes.filter((e) => now - new Date(e.occurredAt).getTime() <= 30 * 864e5).length

  // Average duration (of those with a duration).
  const withDur = episodes.filter((e) => e.durationSeconds != null)
  const avgDur = withDur.length ? Math.round(withDur.reduce((s, e) => s + Number(e.durationSeconds), 0) / withDur.length) : null

  // Frequency tallies.
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

  const html = `<main class="stack">
    <div class="stat-grid">
      <div class="stat"><div class="num">${episodes.length}</div><div class="lbl">Total logged</div></div>
      <div class="stat"><div class="num">${last30}</div><div class="lbl">Last 30 days</div></div>
      <div class="stat"><div class="num">${avgDur != null ? formatDuration(avgDur) : '—'}</div><div class="lbl">Avg duration</div></div>
      <div class="stat"><div class="num">${formatDateTime(episodes[0].occurredAt).split(',')[0]}</div><div class="lbl">Most recent</div></div>
    </div>
    <div class="card"><h2>Most common symptoms</h2>${bars(topSymptoms)}</div>
    <div class="card"><h2>Most common triggers</h2>${bars(topTriggers)}</div>
    <p class="disclaimer">These counts are only as reliable as what's been logged. Bring the full log to a doctor for interpretation.</p>
  </main>`

  return { html, mount() {} }
}

// ===========================================================================
// SETTINGS / EXPORT
// ===========================================================================
export function SettingsView() {
  const episodes = getEpisodes()
  const settings = getSettings()
  const driveOn = driveConfigured()

  const html = `<main class="stack">
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
      <p class="muted" style="margin:0; font-size:13px">A full backup file you can keep or move to a new phone.</p>
      <button type="button" id="backup" class="btn-block">Save backup file (JSON)</button>
      <label class="btn btn-block" for="restoreFile" style="cursor:pointer">Restore from backup…</label>
      <input type="file" id="restoreFile" accept="application/json,.json" class="hidden">
    </div>

    <div class="card">
      <h2>About</h2>
      <p class="muted" style="margin:0; font-size:13px">Seizure Tracker keeps everything on this device. ${episodes.length} episode${episodes.length === 1 ? '' : 's'} stored. Nothing is uploaded unless you export it.</p>
    </div>
  </main>`

  function mount(root, navigate, rerender) {
    const status = root.querySelector('#exportStatus')
    const setStatus = (msg, isError) => { status.textContent = msg; status.style.color = isError ? 'var(--danger)' : 'var(--muted)' }

    root.querySelector('#pdf').addEventListener('click', () => printReport(getEpisodes()))

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
          const open = file.webViewLink ? `\n\nOpen it now?` : ''
          if (file.webViewLink && confirm(`Saved to Google Drive as “${file.name}”.${open}`)) {
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
