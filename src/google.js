// Google Drive integration: export the log as a spreadsheet into the user's
// own Google Drive.
//
// How it works:
//   - We use Google Identity Services (GIS) for a browser-only OAuth token flow
//     with the minimal `drive.file` scope — the app can only see and manage the
//     ONE file it creates, never the rest of the user's Drive.
//   - We upload the CSV with a target mimeType of a Google Sheet, so Drive
//     converts it into a real, editable spreadsheet.
//   - The created file's id is remembered so subsequent exports UPDATE the same
//     living spreadsheet instead of littering Drive with copies.
//
// Requires VITE_GOOGLE_CLIENT_ID to be set (see .env.example). If it isn't,
// isConfigured() returns false and the UI hides/disables the Drive button.

import { getSettings, updateSettings } from './store.js'

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''
const SCOPE = 'https://www.googleapis.com/auth/drive.file'
const GIS_SRC = 'https://accounts.google.com/gsi/client'

let gisLoaded = null
let tokenClient = null

export function isConfigured() {
  return Boolean(CLIENT_ID)
}

function loadGIS() {
  if (gisLoaded) return gisLoaded
  gisLoaded = new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve()
    const script = document.createElement('script')
    script.src = GIS_SRC
    script.async = true
    script.defer = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Could not load Google sign-in. Check your connection.'))
    document.head.appendChild(script)
  })
  return gisLoaded
}

// Requests an access token, prompting the user to sign in / consent as needed.
function getAccessToken() {
  return new Promise(async (resolve, reject) => {
    try {
      await loadGIS()
    } catch (err) {
      return reject(err)
    }
    if (!tokenClient) {
      tokenClient = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPE,
        callback: () => {}, // replaced per-request below
      })
    }
    tokenClient.callback = (resp) => {
      if (resp.error) return reject(new Error(resp.error_description || resp.error))
      resolve(resp.access_token)
    }
    tokenClient.error_callback = (err) => reject(new Error(err?.message || 'Google sign-in was cancelled.'))
    // 'consent' the first time; afterwards Google will skip the prompt if already granted.
    tokenClient.requestAccessToken({ prompt: '' })
  })
}

// Multipart body: JSON metadata + CSV media, per Drive's multipart upload spec.
function buildMultipart(metadata, csv, boundary) {
  return (
    `--${boundary}\r\n` +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    `\r\n--${boundary}\r\n` +
    'Content-Type: text/csv; charset=UTF-8\r\n\r\n' +
    csv +
    `\r\n--${boundary}--`
  )
}

// Uploads the CSV to Drive as a Google Sheet. Creates the file the first time,
// updates it thereafter. Returns { id, name, webViewLink }.
export async function exportToDrive(csv, fileName) {
  if (!isConfigured()) {
    throw new Error('Google Drive export is not configured (missing client ID).')
  }
  const token = await getAccessToken()
  const settings = getSettings()
  const existingId = settings.driveFileId

  const boundary = 'seizuretracker' + Math.abs(hashString(csv)).toString(36)
  const metadata = existingId
    ? { name: fileName }
    : { name: fileName, mimeType: 'application/vnd.google-apps.spreadsheet' }

  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=id,name,webViewLink`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink`

  const res = await fetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`,
    },
    body: buildMultipart(metadata, csv, boundary),
  })

  if (!res.ok) {
    let detail = ''
    try {
      detail = (await res.json())?.error?.message || ''
    } catch {}
    // If the remembered file was deleted/trashed, forget it so a retry recreates it.
    if (res.status === 404 && existingId) {
      updateSettings({ driveFileId: null })
      throw new Error('The previous Drive spreadsheet was not found — try again to create a new one.')
    }
    throw new Error(`Google Drive upload failed (${res.status}). ${detail}`)
  }

  const file = await res.json()
  updateSettings({ driveFileId: file.id, driveFileName: file.name })
  return file
}

// Deterministic, dependency-free string hash — only used to vary the multipart boundary.
function hashString(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i)
    h |= 0
  }
  return h
}
