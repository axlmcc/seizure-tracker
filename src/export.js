// Export helpers: CSV (for spreadsheets), a printable report (Save-as-PDF via
// the browser print dialog), and small download utilities.

import { formatDuration, formatDateTime } from './model.js'

// Column order for the spreadsheet. Kept flat and doctor-friendly.
const COLUMNS = [
  ['occurredAt', 'Date & time', (e) => formatDateTime(e.occurredAt)],
  ['durationSeconds', 'Duration', (e) => formatDuration(e.durationSeconds)],
  ['awareness', 'Awareness', (e) => e.awareness || ''],
  ['severity', 'Severity (1-5)', (e) => (e.severity ? String(e.severity) : '')],
  ['during', 'During episode', (e) => e.during.join('; ')],
  ['before', 'Warning signs (before)', (e) => e.before.join('; ')],
  ['after', 'After (recovery)', (e) => e.after.join('; ')],
  ['triggers', 'Possible triggers', (e) => e.triggers.join('; ')],
  ['customSymptoms', 'Other symptoms', (e) => e.customSymptoms.join('; ')],
  ['activityBefore', 'Activity before', (e) => e.activityBefore || ''],
  ['witnessedBy', 'Witnessed by', (e) => e.witnessedBy || ''],
  ['injury', 'Injury?', (e) => (e.injury ? `Yes${e.injuryNote ? ' — ' + e.injuryNote : ''}` : 'No')],
  ['notes', 'Notes', (e) => e.notes || ''],
]

function csvCell(value) {
  const s = String(value ?? '')
  // Quote if the value contains a comma, quote, or newline; escape quotes.
  if (/[",\n\r]/.test(s)) {
    return '"' + s.replace(/"/g, '""') + '"'
  }
  return s
}

// Builds a CSV string from episodes (already sorted by the caller).
export function toCSV(episodes) {
  const header = COLUMNS.map((c) => csvCell(c[1])).join(',')
  const rows = episodes.map((e) => COLUMNS.map((c) => csvCell(c[2](e))).join(','))
  // Leading BOM so Excel / Google Sheets detect UTF-8 correctly.
  return '﻿' + [header, ...rows].join('\r\n')
}

// Triggers a client-side file download.
export function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoke on the next tick so the download has a chance to start.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function dateStamp() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// --- Printable report (Save as PDF) -----------------------------------------

function esc(s) {
  return String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))
}

// Opens a clean, print-optimised report in a new window and invokes print().
// The user picks "Save as PDF" as the destination — no PDF library needed.
export function printReport(episodes) {
  const rows = episodes
    .map((e) => {
      const symptoms = [...e.during, ...e.customSymptoms]
      return `
      <div class="ep">
        <div class="ep-head">
          <strong>${esc(formatDateTime(e.occurredAt))}</strong>
          <span>${esc(formatDuration(e.durationSeconds))}${e.severity ? ` · severity ${e.severity}/5` : ''}</span>
        </div>
        <table>
          ${row('Awareness', e.awareness)}
          ${row('During', symptoms.join(', '))}
          ${row('Warning signs', e.before.join(', '))}
          ${row('Recovery', e.after.join(', '))}
          ${row('Triggers', e.triggers.join(', '))}
          ${row('Activity before', e.activityBefore)}
          ${row('Witnessed by', e.witnessedBy)}
          ${row('Injury', e.injury ? `Yes${e.injuryNote ? ' — ' + e.injuryNote : ''}` : '')}
          ${row('Notes', e.notes)}
        </table>
      </div>`
    })
    .join('')

  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Seizure Log</title>
  <style>
    * { box-sizing: border-box; }
    body { font: 13px/1.5 -apple-system, Segoe UI, Roboto, sans-serif; color: #1a1a1a; margin: 32px; }
    h1 { font-size: 20px; margin: 0 0 2px; }
    .sub { color: #555; margin: 0 0 20px; }
    .ep { border: 1px solid #d5d5d5; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; page-break-inside: avoid; }
    .ep-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; padding-bottom: 6px; border-bottom: 1px solid #eee; }
    table { width: 100%; border-collapse: collapse; }
    td { vertical-align: top; padding: 2px 0; }
    td.k { width: 130px; color: #666; padding-right: 10px; }
    .disclaimer { margin-top: 24px; font-size: 11px; color: #777; border-top: 1px solid #eee; padding-top: 10px; }
    @media print { body { margin: 12mm; } }
  </style></head><body>
    <h1>Seizure Log</h1>
    <p class="sub">${episodes.length} episode${episodes.length === 1 ? '' : 's'} · generated ${esc(new Date().toLocaleDateString())}</p>
    ${rows || '<p>No episodes recorded yet.</p>'}
    <p class="disclaimer">This log is self-reported and intended to support a conversation with a qualified medical professional. It is not a diagnosis.</p>
  </body></html>`

  const w = window.open('', '_blank')
  if (!w) {
    alert('Please allow pop-ups for this site to generate the printable report.')
    return
  }
  w.document.write(html)
  w.document.close()
  w.focus()
  // Give the new document a moment to lay out before printing.
  setTimeout(() => w.print(), 300)
}

function row(key, value) {
  if (!value) return ''
  return `<tr><td class="k">${esc(key)}</td><td>${esc(value)}</td></tr>`
}
