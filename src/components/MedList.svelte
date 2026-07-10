<script>
  import { medicationsSorted } from '../store.svelte.js'
  import { formatDate } from '../model.js'
  const meds = $derived(medicationsSorted())
</script>

<main class="stack">
  <a class="btn btn-primary btn-lg btn-block" href="#/med/new">＋ Add a medication</a>
  {#if meds.length === 0}
    <div class="empty"><div class="big">💊</div><p>No medications added yet.</p></div>
  {/if}
  {#each meds as m (m.id)}
    <a class="card episode med" href="#/med/{m.id}">
      <div class="when">{m.name}{#if !m.active} <span class="pill">stopped</span>{/if}</div>
      <div class="meta">{[m.dose, m.frequency].filter(Boolean).join(' · ') || '—'}{m.startedAt ? ' · since ' + formatDate(m.startedAt) : ''}</div>
    </a>
  {/each}
  <a class="btn btn-block" href="#/settings">Back to settings</a>
</main>
