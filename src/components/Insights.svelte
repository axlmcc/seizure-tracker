<script>
  import { episodesSorted, medicationsSorted } from '../store.svelte.js'
  import { formatDuration, formatDateTime, formatDate } from '../model.js'

  const episodes = $derived(episodesSorted())
  const meds = $derived(medicationsSorted())

  const last30 = $derived(episodes.filter((e) => Date.now() - new Date(e.occurredAt).getTime() <= 30 * 864e5).length)
  const withDur = $derived(episodes.filter((e) => e.durationSeconds != null))
  const avgDur = $derived(withDur.length ? Math.round(withDur.reduce((s, e) => s + Number(e.durationSeconds), 0) / withDur.length) : null)
  const mostRecent = $derived(episodes.length ? formatDateTime(episodes[0].occurredAt).split(',')[0] : '—')

  function tally(key) {
    const counts = {}
    episodes.forEach((e) => (e[key] || []).forEach((v) => { counts[v] = (counts[v] || 0) + 1 }))
    return Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6)
  }
  const topSymptoms = $derived(tally('during'))
  const topTriggers = $derived(tally('triggers'))

  const MARKER = '#d98a2b'
  const chart = $derived(buildChart(episodes, meds))

  function buildChart(episodes, meds) {
    const WEEKS = 12, DAY = 864e5
    const startOfWeek = (d) => {
      const x = new Date(d)
      x.setHours(0, 0, 0, 0)
      x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
      return x
    }
    const parseLocalDate = (v) => {
      const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '')
      return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(v)
    }
    const thisWeek = startOfWeek(new Date())
    const first = new Date(thisWeek)
    first.setDate(first.getDate() - (WEEKS - 1) * 7)
    const windowEnd = new Date(thisWeek)
    windowEnd.setDate(windowEnd.getDate() + 7)

    const weeks = Array.from({ length: WEEKS }, (_, i) => {
      const s = new Date(first)
      s.setDate(s.getDate() + i * 7)
      return { start: s, count: 0 }
    })
    episodes.forEach((e) => {
      const idx = Math.floor((startOfWeek(new Date(e.occurredAt)) - first) / (7 * DAY))
      if (idx >= 0 && idx < WEEKS) weeks[idx].count++
    })
    const max = Math.max(1, ...weeks.map((w) => w.count))

    const W = 320, H = 156, padL = 6, padR = 6, padT = 30, padB = 26
    const plotW = W - padL - padR, plotH = H - padT - padB
    const bw = plotW / WEEKS, yBase = padT + plotH

    const bars = weeks.map((w, i) => {
      const h = (w.count / max) * plotH
      const x = padL + i * bw + bw * 0.18
      const bwi = bw * 0.64
      return { x, y: yBase - h, w: bwi, h: Math.max(0, h), count: w.count, cx: x + bwi / 2 }
    })
    const xLabels = weeks.map((w, i) => (i % 3 === 0
      ? { x: padL + i * bw + bw / 2, text: w.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) }
      : null)).filter(Boolean)

    const started = []
    let earlier = 0
    meds.forEach((m) => {
      if (!m.startedAt) return
      const d = parseLocalDate(m.startedAt)
      if (isNaN(d)) return
      if (d >= first && d < windowEnd) started.push({ m, d })
      else if (d < first) earlier++
    })
    started.sort((a, b) => a.d - b.d)

    let prevX = -Infinity, lane = 0
    const markers = started.map(({ d }, i) => {
      const x = padL + ((d - first) / DAY / 7) * bw
      lane = x - prevX < 16 ? (lane + 1) % 2 : 0
      prevX = x
      const labelY = 12 + lane * 12
      return { x, y1: labelY + 4, y2: yBase, labelY, num: i + 1 }
    })
    const legend = started.map(({ m }, i) => ({ num: i + 1, name: m.name, date: formatDate(m.startedAt) }))

    return { W, H, padL, padR, yBase, bars, xLabels, markers, legend, earlier }
  }
</script>

<main class="stack">
  {#if episodes.length === 0 && meds.length === 0}
    <div class="empty"><div class="big">📊</div><p>Patterns will show up here once a few episodes are logged.</p></div>
  {:else}
    <div class="stat-grid">
      <div class="stat"><div class="num">{episodes.length}</div><div class="lbl">Total seizures</div></div>
      <div class="stat"><div class="num">{last30}</div><div class="lbl">Last 30 days</div></div>
      <div class="stat"><div class="num">{avgDur != null ? formatDuration(avgDur) : '—'}</div><div class="lbl">Avg duration</div></div>
      <div class="stat"><div class="num">{mostRecent}</div><div class="lbl">Most recent</div></div>
    </div>

    <div class="card">
      <h2>Seizures per week vs. medication changes</h2>
      <svg class="chart" viewBox="0 0 {chart.W} {chart.H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Seizures per week with numbered medication-start markers">
        <line x1={chart.padL} y1={chart.yBase} x2={chart.W - chart.padR} y2={chart.yBase} stroke="var(--border)" stroke-width="1" />
        {#each chart.bars as b}
          <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="2" fill="var(--accent)" />
          {#if b.count > 0}<text x={b.cx} y={b.y - 3} text-anchor="middle" font-size="8" fill="var(--muted)">{b.count}</text>{/if}
        {/each}
        {#each chart.markers as m}
          <line x1={m.x} y1={m.y1} x2={m.x} y2={m.y2} stroke={MARKER} stroke-width="1.3" opacity="0.85" />
          <text x={m.x} y={m.labelY} text-anchor="middle" font-size="9" font-weight="700" fill={MARKER}>{m.num}</text>
        {/each}
        {#each chart.xLabels as l}
          <text x={l.x} y={chart.H - 8} text-anchor="middle" font-size="8" fill="var(--muted)">{l.text}</text>
        {/each}
      </svg>
      {#if chart.legend.length || chart.earlier}
        <div class="legend">
          {#each chart.legend as l}
            <div class="item"><span class="num" style="background:{MARKER}">{l.num}</span>Started <strong>{l.name}</strong> · {l.date}</div>
          {/each}
          {#if chart.earlier}
            <div class="item muted-note">＋ {chart.earlier} other medication{chart.earlier === 1 ? '' : 's'} started before this window (see the medication list).</div>
          {/if}
        </div>
      {:else}
        <p class="muted" style="margin:8px 0 0; font-size:13px">No medications were started in the last 12 weeks.</p>
      {/if}
      <p class="muted" style="margin:10px 0 0; font-size:12px">Each bar is one week (last 12). Numbered lines mark when a medication was started — match the number to the list below and look for a change in the bars afterwards.</p>
    </div>

    <div class="card">
      <h2>Most common symptoms</h2>
      {#if topSymptoms.length}
        {#each topSymptoms as [name, n]}
          <div class="bar-row"><div class="name">{name}</div><div class="bar-track"><div class="bar-fill" style="width:{Math.round((n / topSymptoms[0][1]) * 100)}%"></div></div><div class="n">{n}</div></div>
        {/each}
      {:else}<p class="muted">Nothing recorded yet.</p>{/if}
    </div>

    <div class="card">
      <h2>Most common triggers</h2>
      {#if topTriggers.length}
        {#each topTriggers as [name, n]}
          <div class="bar-row"><div class="name">{name}</div><div class="bar-track"><div class="bar-fill" style="width:{Math.round((n / topTriggers[0][1]) * 100)}%"></div></div><div class="n">{n}</div></div>
        {/each}
      {:else}<p class="muted">Nothing recorded yet.</p>{/if}
    </div>

    <p class="disclaimer">These counts are only as reliable as what's been logged. Bring the full log to a doctor for interpretation — a pattern here is a question to ask, not an answer.</p>
  {/if}
</main>
