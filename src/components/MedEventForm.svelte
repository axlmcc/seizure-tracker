<script>
  import { createMedEvent } from '../model.js'
  import { getMedEvent, upsertMedEvent, deleteMedEvent, activeMedications } from '../store.svelte.js'

  let { id = null } = $props()
  const existing = id ? getMedEvent(id) : null
  const active = activeMedications()

  let draft = $state(existing ? $state.snapshot(existing) : createMedEvent())

  // Pick list: active meds, plus this event's own med if it's since been stopped.
  const options = (draft.medicationId && !active.some((m) => m.id === draft.medicationId))
    ? [...active, { id: draft.medicationId, name: draft.medicationName || 'Medication', dose: draft.dose }]
    : [...active]
  if (!existing && options.length) {
    draft.medicationId = options[0].id
    draft.medicationName = options[0].name
    if (!draft.dose) draft.dose = options[0].dose || ''
  }

  const noMeds = !existing && active.length === 0

  function onMedChange() {
    const m = options.find((o) => o.id === draft.medicationId)
    if (m) { draft.medicationName = m.name; draft.dose = m.dose || '' }
  }
  function save() {
    if (!draft.medicationId) { alert('Please choose a medication.'); return }
    if (!draft.takenAt) { alert('Please set when it was taken.'); return }
    upsertMedEvent($state.snapshot(draft))
    location.hash = '#/'
  }
  function del() {
    if (confirm('Delete this entry? This cannot be undone.')) {
      deleteMedEvent(existing.id)
      location.hash = '#/'
    }
  }
</script>

<main class="stack">
  {#if noMeds}
    <div class="card stack">
      <h2>No medications yet</h2>
      <p class="muted" style="margin:0; font-size:13px">Add the medications she's taking first, then you can log when she takes them.</p>
      <a class="btn btn-primary btn-block" href="#/med/new">Add a medication</a>
      <a class="btn btn-block" href="#/">Cancel</a>
    </div>
  {:else}
    <div class="card stack">
      <div>
        <label class="field" for="medSelect">Which medication?</label>
        <select id="medSelect" bind:value={draft.medicationId} onchange={onMedChange}>
          {#each options as m}<option value={m.id}>{m.name}{m.dose ? ` (${m.dose})` : ''}</option>{/each}
        </select>
        <a href="#/meds" class="muted" style="display:inline-block; margin-top:8px; font-size:13px">Manage medication list →</a>
      </div>
      <div>
        <label class="field" for="takenAt">When?</label>
        <input type="datetime-local" id="takenAt" bind:value={draft.takenAt} />
      </div>
      <div>
        <label class="field" for="dose">Dose</label>
        <input type="text" id="dose" bind:value={draft.dose} placeholder="e.g. 50 mg" />
      </div>
      <div>
        <button type="button" class="chip" class:on={draft.skipped} style="width:fit-content" onclick={() => (draft.skipped = !draft.skipped)}>
          <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
          <span>This dose was missed / skipped</span>
        </button>
      </div>
      <div>
        <label class="field" for="medNotes">Notes</label>
        <textarea id="medNotes" bind:value={draft.notes} placeholder="Anything worth noting…"></textarea>
      </div>
    </div>

    <button type="button" class="btn-primary btn-lg btn-block" onclick={save}>{existing ? 'Save changes' : 'Save'}</button>
    <a class="btn btn-block" href="#/">Cancel</a>
    {#if existing}<button type="button" class="btn-danger btn-block" onclick={del}>Delete this entry</button>{/if}
  {/if}
</main>
