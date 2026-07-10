// Medication-name autocomplete via the U.S. National Library of Medicine
// Clinical Table Search Service (RxTerms dataset). Free, no API key required,
// and CORS-enabled for direct browser use.
//   Docs: https://clinicaltables.nlm.nih.gov/apidoc/rxterms/v3/doc.html
//
// Privacy note: the partial text typed into the name field is sent to the NLM
// service to fetch suggestions. Nothing else (no episode/medication data) is
// sent. If the request fails (offline, blocked), the field simply falls back to
// plain manual entry — autocomplete is a convenience, never a requirement.

const ENDPOINT = 'https://clinicaltables.nlm.nih.gov/api/rxterms/v3/search'

// Returns [{ name, strengths: string[] }]. Empty array for short/blank queries.
export async function searchMedications(term, { signal } = {}) {
  const q = (term || '').trim()
  if (q.length < 2) return []
  const url = `${ENDPOINT}?terms=${encodeURIComponent(q)}&maxList=8&ef=STRENGTHS_AND_FORMS`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error(`Medication lookup failed (${res.status})`)
  // Response shape: [total, [codes], {extraFields}, [[displayName], …]]
  const data = await res.json()
  const rows = data[3] || []
  const strengths = (data[2] && data[2].STRENGTHS_AND_FORMS) || []
  return rows.map((row, i) => ({
    name: Array.isArray(row) ? row[0] : row,
    strengths: (Array.isArray(strengths[i]) ? strengths[i] : []).map((s) => String(s).trim()),
  }))
}
