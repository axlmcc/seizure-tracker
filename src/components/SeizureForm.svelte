<script>
  import {
    DURING_SYMPTOMS, BEFORE_SYMPTOMS, AFTER_SYMPTOMS, TRIGGERS,
    AWARENESS_LEVELS, DURATION_PRESETS, createEpisode,
  } from '../model.js'
  import { getEpisode, upsertEpisode, deleteEpisode } from '../store.svelte.js'
  import ChipList from './ChipList.svelte'

  let { id = null } = $props()
  const existing = id ? getEpisode(id) : null
  let draft = $state(existing ? $state.snapshot(existing) : createEpisode())
  let customInput = $state('')

  const isCustomDuration = $derived(
    draft.durationSeconds != null && !DURATION_PRESETS.some((p) => p.seconds === draft.durationSeconds)
  )

  function addCustom() {
    const v = customInput.trim()
    if (!v) return
    if (!draft.customSymptoms.includes(v)) draft.customSymptoms.push(v)
    customInput = ''
  }
  function setPreset(sec) {
    draft.durationSeconds = draft.durationSeconds === sec ? null : sec
  }
  function save() {
    if (!draft.occurredAt) { alert('Please set when it happened.'); return }
    upsertEpisode($state.snapshot(draft))
    location.hash = '#/'
  }
  function del() {
    if (confirm('Delete this episode? This cannot be undone.')) {
      deleteEpisode(existing.id)
      location.hash = '#/'
    }
  }
</script>

<main class="stack">
  <div class="card stack">
    <div>
      <label class="field" for="occurredAt">When did it happen?</label>
      <input type="datetime-local" id="occurredAt" bind:value={draft.occurredAt} />
    </div>

    <div>
      <span class="field">How long did it last?</span>
      <div class="presets">
        {#each DURATION_PRESETS as p}
          <button type="button" class="preset" class:on={draft.durationSeconds === p.seconds} onclick={() => setPreset(p.seconds)}>{p.label}</button>
        {/each}
      </div>
      <div class="row" style="margin-top:8px; align-items:center">
        <input
          type="number" inputmode="numeric" min="0" placeholder="or exact seconds" style="max-width:200px"
          value={isCustomDuration ? draft.durationSeconds : ''}
          oninput={(e) => (draft.durationSeconds = e.target.value === '' ? null : Number(e.target.value))}
        />
        <span class="muted">seconds</span>
      </div>
    </div>

    <div>
      <label class="field" for="awareness">Awareness during it</label>
      <select id="awareness" bind:value={draft.awareness}>
        <option value="">Not sure yet…</option>
        {#each AWARENESS_LEVELS as a}<option value={a}>{a}</option>{/each}
      </select>
    </div>

    <div>
      <span class="field">Severity</span>
      <div class="severity">
        {#each [1, 2, 3, 4, 5] as n}
          <button type="button" class="sev-dot" class:on={draft.severity === n} onclick={() => (draft.severity = draft.severity === n ? 0 : n)}>{n}</button>
        {/each}
      </div>
      <p class="muted" style="margin:6px 0 0; font-size:13px">1 = barely noticeable · 5 = severe</p>
    </div>
  </div>

  <div class="card"><h2>During the episode</h2><ChipList options={DURING_SYMPTOMS} bind:selected={draft.during} /></div>

  <div class="card">
    <h2>Other symptoms</h2>
    <p class="muted" style="margin:0 0 10px; font-size:13px">Add anything not listed above.</p>
    <div class="row">
      <input type="text" bind:value={customInput} placeholder="e.g. warm feeling in chest" style="flex:1; min-width:180px"
        onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addCustom() } }} />
      <button type="button" class="btn-primary" onclick={addCustom}>Add</button>
    </div>
    <div class="tag-list">
      {#each draft.customSymptoms as s, i}
        <span class="tag">{s}<button type="button" aria-label="Remove" onclick={() => draft.customSymptoms.splice(i, 1)}>×</button></span>
      {/each}
    </div>
  </div>

  <div class="card"><h2>Warning signs (before)</h2><ChipList options={BEFORE_SYMPTOMS} bind:selected={draft.before} /></div>
  <div class="card"><h2>Afterwards (recovery)</h2><ChipList options={AFTER_SYMPTOMS} bind:selected={draft.after} /></div>
  <div class="card"><h2>Possible triggers</h2><ChipList options={TRIGGERS} bind:selected={draft.triggers} /></div>

  <div class="card stack">
    <div>
      <label class="field" for="activityBefore">What was she doing beforehand?</label>
      <input type="text" id="activityBefore" bind:value={draft.activityBefore} placeholder="e.g. watching TV, eating dinner" />
    </div>
    <div>
      <label class="field" for="witnessedBy">Witnessed by</label>
      <input type="text" id="witnessedBy" bind:value={draft.witnessedBy} placeholder="e.g. Mom, no one" />
    </div>
    <div>
      <button type="button" class="chip" class:on={draft.injury} style="width:fit-content" onclick={() => (draft.injury = !draft.injury)}>
        <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
        <span>An injury happened</span>
      </button>
      {#if draft.injury}
        <input type="text" style="margin-top:8px" bind:value={draft.injuryNote} placeholder="Describe the injury" />
      {/if}
    </div>
    <div>
      <label class="field" for="notes">Notes — what did it feel like?</label>
      <textarea id="notes" bind:value={draft.notes} placeholder="Anything in her own words…"></textarea>
    </div>
  </div>

  <button type="button" class="btn-primary btn-lg btn-block" onclick={save}>{existing ? 'Save changes' : 'Save episode'}</button>
  <a class="btn btn-block" href={existing ? '#/episode/' + existing.id : '#/'}>Cancel</a>
  {#if existing}<button type="button" class="btn-danger btn-block" onclick={del}>Delete this episode</button>{/if}
</main>
