<script>
  import { MED_FREQUENCIES, createMedication } from '../model.js'
  import { getMedication, upsertMedication, deleteMedication, batchesSorted } from '../store.svelte.js'
  import MedNameInput from './MedNameInput.svelte'

  let { id = null } = $props()
  const existing = id ? getMedication(id) : null
  let draft = $state(existing ? $state.snapshot(existing) : createMedication())
  draft.batchIds ??= []

  const batches = $derived(batchesSorted())
  let doseStrengths = $state([])

  function toggleBatch(bid) {
    draft.batchIds = draft.batchIds.includes(bid)
      ? draft.batchIds.filter((x) => x !== bid)
      : [...draft.batchIds, bid]
  }
  function save() {
    if (!draft.name.trim()) { alert('Please enter the medication name.'); return }
    upsertMedication($state.snapshot(draft))
    location.hash = '#/meds'
  }
  function del() {
    if (confirm(`Delete “${existing.name}”? Logged doses stay in the history.`)) {
      deleteMedication(existing.id)
      location.hash = '#/meds'
    }
  }
</script>

<main class="stack">
  <div class="card stack">
    <div>
      <label class="field" for="name">Medication name</label>
      <MedNameInput bind:value={draft.name} onstrengths={(s) => (doseStrengths = s)} />
      <p class="muted" style="margin:6px 0 0; font-size:13px">Suggestions come from the U.S. National Library of Medicine — pick one, or just type it in.</p>
    </div>
    <div>
      <label class="field" for="mdose">Dose</label>
      <input type="text" id="mdose" list="doseOptions" bind:value={draft.dose} placeholder="e.g. 50 mg" />
      <datalist id="doseOptions">{#each doseStrengths as s}<option value={s}></option>{/each}</datalist>
    </div>
    <div>
      <label class="field" for="frequency">How often</label>
      <input type="text" id="frequency" list="freqOptions" bind:value={draft.frequency} placeholder="e.g. Twice daily" />
      <datalist id="freqOptions">{#each MED_FREQUENCIES as f}<option value={f}></option>{/each}</datalist>
    </div>
    <div>
      <label class="field" for="startedAt">Started taking it on</label>
      <input type="date" id="startedAt" bind:value={draft.startedAt} />
      <p class="muted" style="margin:6px 0 0; font-size:13px">Used to line up new medications with seizure timing on the Insights page.</p>
    </div>
    <div>
      <span class="field">Batches (when is it taken?)</span>
      {#if batches.length === 0}
        <p class="muted" style="margin:0; font-size:13px">No batches yet — <a href="#/batches">set some up</a>.</p>
      {:else}
        <div class="chips">
          {#each batches as b}
            <button type="button" class="chip" class:on={draft.batchIds.includes(b.id)} onclick={() => toggleBatch(b.id)}>
              <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
              <span>{b.name}</span>
            </button>
          {/each}
        </div>
      {/if}
    </div>
    <div>
      <button type="button" class="chip" class:on={draft.active} style="width:fit-content" onclick={() => (draft.active = !draft.active)}>
        <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        <span>Currently taking this</span>
      </button>
      <p class="muted" style="margin:6px 0 0; font-size:13px">Turn off if she's stopped — it stays in history but won't show when logging new doses.</p>
    </div>
    <div>
      <label class="field" for="mnotes">Notes</label>
      <textarea id="mnotes" bind:value={draft.notes} placeholder="Prescriber, reason, side effects…"></textarea>
    </div>
  </div>

  <button type="button" class="btn-primary btn-lg btn-block" onclick={save}>{existing ? 'Save changes' : 'Add medication'}</button>
  <a class="btn btn-block" href="#/meds">Cancel</a>
  {#if existing}<button type="button" class="btn-danger btn-block" onclick={del}>Delete medication</button>{/if}
</main>
