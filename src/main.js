import './style.css'
import {
  LogView, AddChooserView, FormView, MedEventFormView,
  MedListView, MedFormView, InsightsView, SettingsView,
} from './views.js'

const app = document.getElementById('app')

// --- Icons (inline so there are no extra network requests) ------------------
const ICONS = {
  log: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  add: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
  insights: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 14l4-4 3 3 5-6"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/><circle cx="12" cy="12" r="3.5"/></svg>',
  logo: '<svg class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2-6 4 12 2-6h6"/></svg>',
}

// Which tab is highlighted, keyed by the first path segment.
const TABS = [
  { href: '#/', label: 'Log', icon: ICONS.log, match: (seg) => !seg || seg === 'episode' },
  { href: '#/add', label: 'Add', icon: ICONS.add, match: (seg) => ['add', 'new', 'med-event', 'meds', 'med'].includes(seg) },
  { href: '#/insights', label: 'Insights', icon: ICONS.insights, match: (seg) => seg === 'insights' },
  { href: '#/settings', label: 'Settings', icon: ICONS.settings, match: (seg) => seg === 'settings' },
]

const TITLES = {
  '': 'Seizure Tracker',
  add: 'Add',
  new: 'Log a seizure',
  episode: 'Seizure',
  'med-event': 'Medication',
  meds: 'Medications',
  med: 'Medication',
  insights: 'Insights',
  settings: 'Settings & export',
}

function parseRoute() {
  // e.g. "#/med/abc" -> { seg: 'med', param: 'abc', parts: ['med','abc'] }
  const raw = location.hash.replace(/^#/, '') || '/'
  const parts = raw.split('/').filter(Boolean)
  return { raw, parts, seg: parts[0] || '', param: parts[1] || null }
}

function navigate(hash) {
  if (location.hash === hash) render()
  else location.hash = hash
}

function viewForRoute({ seg, param }) {
  switch (seg) {
    case 'add': return AddChooserView()
    case 'new': return FormView(null)
    case 'episode': return FormView(param)
    case 'med-event': return MedEventFormView(param === 'new' ? null : param)
    case 'meds': return MedListView()
    case 'med': return MedFormView(param === 'new' ? null : param)
    case 'insights': return InsightsView()
    case 'settings': return SettingsView()
    default: return LogView()
  }
}

function render() {
  const route = parseRoute()
  const view = viewForRoute(route)
  const title = TITLES[route.seg] ?? 'Seizure Tracker'

  app.innerHTML = `
    <header class="appbar">${ICONS.logo}<h1>${title}</h1></header>
    <div id="view">${view.html}</div>
    <nav class="tabbar">
      ${TABS.map((t) => `<a href="${t.href}" class="${t.match(route.seg) ? 'active' : ''}">${t.icon}<span>${t.label}</span></a>`).join('')}
    </nav>`

  const viewRoot = app.querySelector('#view')
  // Views may take (root, navigate, rerender).
  view.mount(viewRoot, navigate, render)
  window.scrollTo(0, 0)
}

window.addEventListener('hashchange', render)
render()

// --- PWA service worker (offline support). Best-effort; ignore failures. ----
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {})
  })
}
