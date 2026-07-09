# Seizure Tracker

A small, private web app for logging seizure episodes — built to help characterize an
absence-type / "checking out" seizure by capturing what happened, when, for how long,
warning signs, recovery, and possible triggers over time.

- **Private by default.** All data is stored on the device (in the browser's
  `localStorage`). Nothing is sent anywhere unless you explicitly export it.
- **Phone-first.** Installable as a home-screen app (PWA) and works offline.
- **Doctor-ready exports.** One-tap printable PDF report, CSV spreadsheet, and an
  optional "export to Google Drive as a Sheet" that keeps one living spreadsheet
  up to date.

> ⚕️ This app is a self-reported log to support a conversation with a qualified
> medical professional. It is **not** a diagnosis or medical advice. If a seizure
> lasts more than 5 minutes, comes in clusters, or is followed by trouble breathing
> or waking, seek emergency care.

## What it tracks

Each episode records: date & time, duration, awareness level, a 1–5 severity, and
checklists (with free-text "other") for symptoms **during**, **warning signs before**,
**recovery after**, and **possible triggers** — plus activity beforehand, who witnessed
it, any injury, and free-form notes.

The checklists are tuned for absence / focal-aware-impaired seizures, but every list
has an "Other symptoms" box so nothing is off-limits.

## Run it locally

```bash
npm install
npm run dev      # open the printed http://localhost:5173 URL
```

```bash
npm run build    # production build into dist/
npm run preview  # preview the production build locally
```

Requires Node 18+ (developed on Node 20).

## Deploy to GitHub Pages

This repo includes a workflow at `.github/workflows/deploy.yml` that builds and
publishes to GitHub Pages on every push to `main`.

1. Push the repo to GitHub.
2. In the repo: **Settings → Pages → Build and deployment → Source = GitHub Actions**.
3. Push to `main`. The app will be live at
   `https://<your-username>.github.io/<repo-name>/`.

The Vite `base` is set to `./` (relative), so it works from a project subpath without
extra config.

## Optional: Export to Google Drive

CSV and the printable PDF work with no setup. The "Export to Google Drive" button
appears only once you provide a Google OAuth client ID.

1. Create a project at <https://console.cloud.google.com/>.
2. **APIs & Services → Enable APIs** → enable **Google Drive API**.
3. **APIs & Services → Credentials → Create credentials → OAuth client ID**.
   - Application type: **Web application**.
   - **Authorized JavaScript origins**: add each URL the app runs on, e.g.
     `http://localhost:5173` and `https://<your-username>.github.io`.
4. Copy `.env.example` to `.env` and set `VITE_GOOGLE_CLIENT_ID`.
   - For the GitHub Pages build, add the same value as a repository
     **Variable** or **Secret** named `VITE_GOOGLE_CLIENT_ID` (the deploy workflow
     passes it through at build time).

The app requests only the `drive.file` scope, which lets it create and update the
**one** spreadsheet it makes — it cannot see anything else in the user's Drive.
The first export creates a Google Sheet; later exports update that same sheet.

## Privacy & data

- Data lives in this browser only. Clearing site data / uninstalling removes it.
- Use **Settings → Save backup file** to keep a JSON backup or move data to a new phone
  (**Restore from backup** merges it back in).
- No analytics, no accounts, no third-party calls except the Google Drive export you
  trigger yourself.

## Tech

Vanilla JavaScript + [Vite](https://vitejs.dev/). No UI framework. A tiny hash router,
a `localStorage`-backed store, and a service worker for offline use.

## License

MIT — see [LICENSE](LICENSE).
