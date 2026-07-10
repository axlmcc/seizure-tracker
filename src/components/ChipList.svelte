<script>
  // A tappable checklist. `selected` is a bindable array of chosen values.
  let { options, selected = $bindable([]) } = $props()
  function toggle(opt) {
    selected = selected.includes(opt) ? selected.filter((v) => v !== opt) : [...selected, opt]
  }
</script>

<div class="chips">
  {#each options as opt}
    <button type="button" class="chip" class:on={selected.includes(opt)} onclick={() => toggle(opt)}>
      <svg class="tick" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
      <span>{opt}</span>
    </button>
  {/each}
</div>
