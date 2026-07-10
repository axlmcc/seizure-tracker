<script>
  // Medication-name field with NLM RxTerms autocomplete. `value` is bindable;
  // `onstrengths` is called with the chosen drug's strengths (for dose hints).
  import { searchMedications } from '../medsearch.js'
  let { value = $bindable(''), onstrengths = () => {} } = $props()
  let items = $state([])
  let open = $state(false)
  let timer
  let controller

  function oninput(e) {
    value = e.target.value
    const q = value.trim()
    clearTimeout(timer)
    if (controller) controller.abort()
    if (q.length < 2) { open = false; items = []; return }
    timer = setTimeout(async () => {
      controller = new AbortController()
      try {
        const r = await searchMedications(q, { signal: controller.signal })
        if (value.trim() === q) { items = r; open = r.length > 0 }
      } catch (err) {
        if (err.name !== 'AbortError') open = false // fail quietly; manual entry still works
      }
    }, 250)
  }
  function pick(it) {
    value = it.name
    onstrengths(it.strengths || [])
    open = false
  }
</script>

<div class="autocomplete">
  <input
    type="text"
    id="name"
    {value}
    {oninput}
    onkeydown={(e) => { if (e.key === 'Escape') open = false }}
    onblur={() => setTimeout(() => (open = false), 150)}
    placeholder="Start typing…"
    autocomplete="off"
  />
  {#if open}
    <div class="suggestions">
      {#each items as it}
        <button type="button" onclick={() => pick(it)}>
          <span class="s-name">{it.name}</span>
          {#if it.strengths.length}<span class="s-sub">{it.strengths.slice(0, 4).join(' · ')}</span>{/if}
        </button>
      {/each}
    </div>
  {/if}
</div>
