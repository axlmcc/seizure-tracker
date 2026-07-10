<script>
  import { onMount } from 'svelte'
  import Log from './components/Log.svelte'
  import Add from './components/Add.svelte'
  import LogMeds from './components/LogMeds.svelte'
  import SeizureForm from './components/SeizureForm.svelte'
  import MedEventForm from './components/MedEventForm.svelte'
  import MedList from './components/MedList.svelte'
  import MedForm from './components/MedForm.svelte'
  import Batches from './components/Batches.svelte'
  import LogBatch from './components/LogBatch.svelte'
  import Insights from './components/Insights.svelte'
  import Settings from './components/Settings.svelte'

  let hash = $state(location.hash.replace(/^#/, '') || '/')
  onMount(() => {
    const on = () => { hash = location.hash.replace(/^#/, '') || '/'; window.scrollTo(0, 0) }
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  })

  const parts = $derived(hash.split('/').filter(Boolean))
  const seg = $derived(parts[0] || '')
  const param = $derived(parts[1] || null)

  const TITLES = {
    '': 'Seizure Tracker', add: 'Add', new: 'Log a seizure', episode: 'Seizure',
    'log-med': 'Log medications', 'med-event': 'As-needed dose', meds: 'Medications', med: 'Medication',
    batches: 'Batches', 'log-batch': 'Log batch', insights: 'Insights', settings: 'Settings & export',
  }
  const title = $derived(TITLES[seg] ?? 'Seizure Tracker')

  const icons = {
    log: 'M3 4h18v18H3zM16 2v4M8 2v4M3 10h18',
    add: 'M12 3a9 9 0 100 18 9 9 0 000-18zM12 8v8M8 12h8',
    insights: 'M3 3v18h18M7 14l4-4 3 3 5-6',
    settings: 'M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1',
  }
  const tabs = [
    { href: '#/', label: 'Log', d: icons.log, match: (s) => !s || s === 'episode' },
    { href: '#/add', label: 'Add', d: icons.add, match: (s) => ['add', 'new', 'log-med', 'med-event', 'meds', 'med', 'batches', 'log-batch'].includes(s) },
    { href: '#/insights', label: 'Insights', d: icons.insights, match: (s) => s === 'insights' },
    { href: '#/settings', label: 'Settings', d: icons.settings, match: (s) => s === 'settings' },
  ]
</script>

<header class="appbar">
  <svg class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>
  <h1>{title}</h1>
</header>

<div id="view">
  {#if seg === ''}
    <Log />
  {:else if seg === 'add'}
    <Add />
  {:else if seg === 'log-med'}
    <LogMeds />
  {:else if seg === 'new'}
    <SeizureForm />
  {:else if seg === 'episode'}
    {#key param}<SeizureForm id={param} />{/key}
  {:else if seg === 'med-event'}
    {#key param}<MedEventForm id={param === 'new' ? null : param} />{/key}
  {:else if seg === 'meds'}
    <MedList />
  {:else if seg === 'med'}
    {#key param}<MedForm id={param === 'new' ? null : param} />{/key}
  {:else if seg === 'batches'}
    <Batches />
  {:else if seg === 'log-batch'}
    {#key param}<LogBatch batchId={param} />{/key}
  {:else if seg === 'insights'}
    <Insights />
  {:else if seg === 'settings'}
    <Settings />
  {:else}
    <Log />
  {/if}
</div>

<nav class="tabbar">
  {#each tabs as t}
    <a href={t.href} class:active={t.match(seg)}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d={t.d}/></svg>
      <span>{t.label}</span>
    </a>
  {/each}
</nav>
