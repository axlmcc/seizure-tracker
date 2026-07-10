<script>
  import { episodesSorted, medicationsSorted, getSettings, exportJSON, importJSON } from '../store.svelte.js'
  import { toCSV, downloadFile, printReport, dateStamp } from '../export.js'
  import { isConfigured as driveConfigured, exportToDrive } from '../google.js'

  const episodes = $derived(episodesSorted())
  const meds = $derived(medicationsSorted())
  const settings = getSettings()
  const driveOn = driveConfigured()

  let status = $state('')
  let statusErr = $state(false)
  let driveBusy = $state(false)

  const doPdf = () => printReport(episodesSorted(), medicationsSorted())
  const doCsv = () => downloadFile(`seizure-log-${dateStamp()}.csv`, toCSV(episodesSorted()), 'text/csv;charset=utf-8')
  const doBackup = () => downloadFile(`seizure-tracker-backup-${dateStamp()}.json`, exportJSON(), 'application/json')

  async function doDrive() {
    driveBusy = true; status = 'Connecting to Google…'; statusErr = false
    try {
      const f = await exportToDrive(toCSV(episodesSorted()), settings.driveFileName || 'Seizure Log')
      status = ''
      if (f.webViewLink && confirm(`Saved to Google Drive as “${f.name}”.\n\nOpen it now?`)) window.open(f.webViewLink, '_blank')
      else alert(`Saved to Google Drive as “${f.name}”.`)
    } catch (err) {
      status = err.message || 'Google Drive export failed.'; statusErr = true
    } finally {
      driveBusy = false
    }
  }
  async function onRestore(e) {
    const file = e.target.files[0]
    if (!file) return
    try {
      const count = importJSON(await file.text())
      alert(`Restored — ${count} episode${count === 1 ? '' : 's'} merged in.`)
    } catch (err) {
      alert('Could not restore: ' + (err.message || err))
    } finally {
      e.target.value = ''
    }
  }
</script>

<main class="stack">
  <div class="card stack">
    <h2>Medications</h2>
    <p class="muted" style="margin:0; font-size:13px">{meds.length} medication{meds.length === 1 ? '' : 's'} on file. This list is what you pick from when logging a dose.</p>
    <a class="btn btn-block" href="#/meds">Manage medications</a>
    <a class="btn btn-block" href="#/batches">Manage batches</a>
  </div>

  <div class="card stack">
    <h2>Export for the doctor</h2>
    <button type="button" class="btn-primary btn-block" onclick={doPdf}>🖨️ Printable report (Save as PDF)</button>
    <button type="button" class="btn-block" onclick={doCsv}>⬇️ Download spreadsheet (CSV)</button>
    {#if driveOn}
      <button type="button" class="btn-block" disabled={driveBusy} onclick={doDrive}>📄 Export to Google Drive (Sheets)</button>
      {#if settings.driveFileId}<p class="muted" style="margin:0; font-size:13px">Updates your existing “{settings.driveFileName}” sheet.</p>{/if}
    {:else}
      <div class="banner banner-info">Google Drive export is off. Add a Google client ID (see README) to turn it on. CSV and PDF work without it.</div>
    {/if}
    {#if status}<div style="font-size:13px; color:{statusErr ? 'var(--danger)' : 'var(--muted)'}">{status}</div>{/if}
  </div>

  <div class="card stack">
    <h2>Backup &amp; restore</h2>
    <p class="muted" style="margin:0; font-size:13px">A full backup file (seizures, medications, batches) you can keep or move to a new phone.</p>
    <button type="button" class="btn-block" onclick={doBackup}>Save backup file (JSON)</button>
    <label class="btn btn-block" style="cursor:pointer">Restore from backup…
      <input type="file" accept="application/json,.json" class="hidden" onchange={onRestore} />
    </label>
  </div>

  <div class="card">
    <h2>About</h2>
    <p class="muted" style="margin:0; font-size:13px">Seizure Tracker keeps everything on this device. {episodes.length} seizure{episodes.length === 1 ? '' : 's'} stored. Nothing is uploaded unless you export it.</p>
  </div>
</main>
