<script>
  // Single, batch-first destination for logging medications. Reached from both
  // the Log tab's "Medication" button and the Add tab, so there's one
  // consistent place to log doses (no more single-vs-batch fork).
  import { batchesSorted, medicationsInBatch } from '../store.svelte.js'
  const batches = $derived(batchesSorted())
</script>

<main class="stack">
  <div class="card stack">
    <h2>Log a batch</h2>
    <p class="muted" style="margin:0; font-size:13px">The usual way — log a whole time-of-day at once.</p>
    {#if batches.length === 0}
      <p class="muted" style="margin:0; font-size:13px">No batches set up yet.</p>
    {/if}
    {#each batches as b (b.id)}
      {@const n = medicationsInBatch(b.id).length}
      <a class="btn btn-block btn-lg" class:btn-primary={n > 0} href="#/log-batch/{b.id}">
        {b.name}{n ? ` — ${n} med${n === 1 ? '' : 's'}` : ' — no meds yet'}
      </a>
    {/each}
  </div>

  <div class="card stack">
    <h2>Something off-schedule?</h2>
    <a class="btn btn-block" href="#/med-event/new">As-needed / one-off dose…</a>
    <p class="muted" style="margin:0; font-size:13px">For an as-needed (PRN) medication, a dose taken at an unusual time, or a quick fix-up.</p>
  </div>

  <div class="row">
    <a class="btn" style="flex:1" href="#/meds">Medications</a>
    <a class="btn" style="flex:1" href="#/batches">Batches</a>
  </div>
</main>
