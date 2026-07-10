<script>
  import { timeline, deleteMedGroup } from '../store.svelte.js'
  import { formatDuration, formatDateTime } from '../model.js'
  const items = $derived(timeline())

  const seizureSymptoms = (e) => [...e.during, ...e.customSymptoms]

  function removeGroup(id) {
    if (confirm('Delete this whole batch entry? This removes every dose logged in it.')) deleteMedGroup(id)
  }
</script>

<main class="stack">
  <div class="row">
    <a class="btn btn-primary btn-lg" href="#/new" style="flex:1">＋ Seizure</a>
    <a class="btn btn-lg" href="#/log-med" style="flex:1">💊 Medication</a>
  </div>

  {#if items.length === 0}
    <div class="empty"><div class="big">🗓️</div><p>Nothing logged yet.<br>Tap <strong>Seizure</strong> or <strong>Medication</strong> above when something happens.</p></div>
  {/if}

  {#each items as item (item.kind + item.id)}
    {#if item.kind === 'seizure'}
      {@const e = item.data}
      <a class="card episode seizure" href="#/episode/{e.id}">
        <div class="when">{formatDateTime(e.occurredAt)}</div>
        <div class="meta">{formatDuration(e.durationSeconds)}{e.awareness ? ' · ' + e.awareness : ''}{e.severity ? ' · severity ' + e.severity + '/5' : ''}</div>
        {#if seizureSymptoms(e).length}
          <div class="tags">
            {#each seizureSymptoms(e).slice(0, 3) as s}<span class="pill">{s}</span>{/each}
            {#if seizureSymptoms(e).length > 3}<span class="pill">+{seizureSymptoms(e).length - 3} more</span>{/if}
          </div>
        {/if}
      </a>
    {:else if item.kind === 'medgroup'}
      {@const taken = item.events.filter((x) => !x.skipped).length}
      {@const skipped = item.events.length - taken}
      <div class="card episode med">
        <div class="row" style="justify-content:space-between; align-items:flex-start; gap:8px">
          <div>
            <div class="when">💊 {item.batchName || 'Medication'} batch</div>
            <div class="meta">{formatDateTime(item.when)} · {taken} taken{skipped ? `, ${skipped} skipped` : ''}</div>
          </div>
          <button type="button" class="linkbtn" onclick={() => removeGroup(item.id)}>Delete</button>
        </div>
        <div class="tags">
          {#each item.events as ev}<span class="pill" class:skip={ev.skipped}>{ev.medicationName}{ev.skipped ? ' (skipped)' : ''}</span>{/each}
        </div>
      </div>
    {:else}
      {@const m = item.data}
      <a class="card episode med" href="#/med-event/{m.id}">
        <div class="when">💊 {m.medicationName || 'Medication'}{m.skipped ? ' — skipped' : ''}</div>
        <div class="meta">{formatDateTime(m.takenAt)}{m.dose ? ' · ' + m.dose : ''}</div>
        {#if m.notes}<div class="tags"><span class="pill">{m.notes}</span></div>{/if}
      </a>
    {/if}
  {/each}

  <p class="disclaimer">Everything stays on this device. A private record to share with a doctor — not a diagnosis.</p>
</main>
