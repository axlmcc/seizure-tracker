<script>
  import { batchesSorted, upsertBatch, deleteBatch, medicationsInBatch } from '../store.svelte.js'
  import { createBatch } from '../model.js'

  const batches = $derived(batchesSorted())
  let newName = $state('')

  function add() {
    const n = newName.trim()
    if (!n) return
    upsertBatch(createBatch({ name: n, order: batches.length }))
    newName = ''
  }
  function remove(b) {
    const c = medicationsInBatch(b.id).length
    if (confirm(`Delete “${b.name}”?${c ? ` ${c} medication(s) will be unassigned from it.` : ''}`)) deleteBatch(b.id)
  }
  function move(b, dir) {
    const arr = batchesSorted()
    const i = arr.findIndex((x) => x.id === b.id)
    const j = i + dir
    if (j < 0 || j >= arr.length) return
    const a = arr[i], c = arr[j]
    const o = a.order
    a.order = c.order
    c.order = o
  }
</script>

<main class="stack">
  <div class="card stack">
    <h2>Add a batch</h2>
    <div class="row">
      <input type="text" bind:value={newName} placeholder="e.g. Bedtime" style="flex:1; min-width:160px"
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add() } }} />
      <button type="button" class="btn-primary" onclick={add}>Add</button>
    </div>
  </div>

  {#each batches as b (b.id)}
    <div class="card stack">
      <div class="row" style="align-items:center; gap:8px">
        <input type="text" value={b.name} oninput={(e) => (b.name = e.target.value)} style="flex:1" />
        <button type="button" class="iconbtn" aria-label="Move up" onclick={() => move(b, -1)}>↑</button>
        <button type="button" class="iconbtn" aria-label="Move down" onclick={() => move(b, 1)}>↓</button>
      </div>
      <div class="row" style="justify-content:space-between; align-items:center">
        <span class="muted" style="font-size:13px">{medicationsInBatch(b.id).length} medication(s)</span>
        <button type="button" class="linkbtn danger" onclick={() => remove(b)}>Delete</button>
      </div>
    </div>
  {/each}

  <p class="muted" style="font-size:13px">Assign medications to a batch on each medication's page. Batches let you log a whole time-of-day at once.</p>
  <a class="btn btn-block" href="#/settings">Back to settings</a>
</main>
