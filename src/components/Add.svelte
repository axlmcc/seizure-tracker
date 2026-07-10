<script>
  import { batchesSorted, medicationsInBatch } from '../store.svelte.js'
  const batches = $derived(batchesSorted())
</script>

<main class="stack">
  <a class="btn btn-primary btn-lg btn-block" href="#/new">＋ Log a seizure</a>

  <div class="card stack">
    <h2>Log medications</h2>
    {#if batches.length === 0}
      <p class="muted" style="margin:0; font-size:13px">No batches set up yet.</p>
    {/if}
    {#each batches as b}
      {@const n = medicationsInBatch(b.id).length}
      <a class="btn btn-block btn-lg" class:btn-primary={n > 0} href="#/log-batch/{b.id}">
        {b.name}{n ? ` — ${n} med${n === 1 ? '' : 's'}` : ' — no meds yet'}
      </a>
    {/each}
    <a class="btn btn-block" href="#/med-event/new">Log a single dose…</a>
  </div>

  <div class="card stack">
    <h2>Set up</h2>
    <a class="btn btn-block" href="#/meds">Manage medications</a>
    <a class="btn btn-block" href="#/batches">Manage batches</a>
  </div>
</main>
