<script>
  import { getBatch, medicationsInBatch, logBatchDoses } from '../store.svelte.js'
  import { nowLocalInput } from '../model.js'

  let { batchId } = $props()
  const batch = getBatch(batchId)
  const meds = batch ? medicationsInBatch(batchId) : []

  let takenAt = $state(nowLocalInput())
  // Which meds were actually taken (default: all).
  let taken = $state(Object.fromEntries(meds.map((m) => [m.id, true])))

  function confirmLog() {
    const entries = meds.map((m) => ({ med: $state.snapshot(m), skipped: !taken[m.id] }))
    logBatchDoses($state.snapshot(batch), entries, takenAt)
    location.hash = '#/'
  }
</script>

<main class="stack">
  {#if !batch}
    <div class="card stack"><h2>Batch not found</h2><a class="btn btn-block" href="#/add">Back</a></div>
  {:else if meds.length === 0}
    <div class="card stack">
      <h2>No medications in “{batch.name}”</h2>
      <p class="muted" style="margin:0; font-size:13px">Assign medications to this batch from each medication's page.</p>
      <a class="btn btn-primary btn-block" href="#/meds">Go to medications</a>
      <a class="btn btn-block" href="#/add">Back</a>
    </div>
  {:else}
    <div class="card stack">
      <h2>Log “{batch.name}” — {meds.length} med{meds.length === 1 ? '' : 's'}</h2>
      <div>
        <label class="field" for="takenAt">When?</label>
        <input type="datetime-local" id="takenAt" bind:value={takenAt} />
      </div>
      <p class="muted" style="margin:0; font-size:13px">Everything's marked taken. Tap any she missed to mark it skipped.</p>
      {#each meds as m (m.id)}
        <button type="button" class="dose-row" class:skipped={!taken[m.id]} onclick={() => (taken[m.id] = !taken[m.id])}>
          <span class="dose-name">{m.name}{m.dose ? ` · ${m.dose}` : ''}</span>
          <span class="dose-state">{taken[m.id] ? '✓ Taken' : '✗ Skipped'}</span>
        </button>
      {/each}
    </div>

    <button type="button" class="btn-primary btn-lg btn-block" onclick={confirmLog}>Log these doses</button>
    <a class="btn btn-block" href="#/add">Cancel</a>
  {/if}
</main>
