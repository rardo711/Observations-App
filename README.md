# Observations App

A phone-sized coaching tool for retail floor leads: track who you've observed, what
you saw against a behavior library, the commitment they made, and whether it stuck.

## Use it

**https://rardo711.github.io/Observations-App/**

Open that on your phone and add it to your home screen:

- **iPhone / iPad** — in Safari, tap **Share**, then **Add to Home Screen**. (It has
  to be Safari; Chrome on iOS can't install web apps.) The app tells you this itself
  if it detects iOS and isn't installed yet.
- **Android** — tap **Install** on the banner, or Chrome's menu → **Install app**.

Once installed it launches from its own icon with no browser chrome, and it works
with no signal at all — everything is cached on the device and nothing talks to a
server.

⚠️ **Your data lives in that one browser.** There's no account and no sync. Notes
taken on your phone won't appear on your laptop, and clearing your browser's site
data for github.io erases them. Use one device for this.

## Run it locally

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

`dist/` is plain static files — drop it on any static host.

## Deploying

`.github/workflows/deploy.yml` builds and publishes to GitHub Pages on every push to
the default branch (`claude/ram-coaching-app-93v9i0`), and can be run by hand from the
Actions tab. If you ever rename or change the default branch, update the `branches:`
list in that file to match or deploys will stop firing.

The workflow sets the Pages source itself via `configure-pages` with `enablement:
true`. If a run ever fails on that step, set **Settings → Pages → Source** to
**GitHub Actions** once by hand and re-run it.

`vite.config.js` uses `base: './'` so the bundle works from the `/Observations-App/`
subpath Pages serves it under, and from any other host, without hardcoding a URL.

## The app-install side

- `public/manifest.webmanifest` — name, icons, `display: standalone`. All paths are
  relative so they resolve under the subpath.
- `public/icons/` — generated PNGs. Maskable variants keep the glyph inside the
  middle 80% so Android launchers don't crop it; the Apple icon is square and opaque
  because iOS applies its own mask.
- `src/sw-template.js` + the `serviceWorker()` plugin in `vite.config.js` — the
  plugin writes `dist/sw.js` with the precache list read from what was actually
  built, so a new hashed bundle can never ship next to a worker still listing the
  old filenames. It hard-fails the build if a placeholder is left unsubstituted.
- `src/pwa.js` — registration, the install prompt, and update detection.
- `src/App.jsx` — the install banner and update toast. These live in a wrapper on
  purpose: `RAMCoachingSystem.jsx` imports nothing local, so it stays paste-able
  into an artifact where none of this exists.

Two things that are easy to get wrong and are deliberately handled:

- The worker calls `clients.claim()`, which fires `controllerchange` on a **first**
  visit even though nothing was replaced. Reloading on that would flash the app for
  every new visitor, so `pwa.js` only reloads when a controller was already present.
- Registration falls back to running immediately when `document.readyState` is
  already `complete`, because waiting on the `load` event alone silently never fires
  on a warm cache.

## How it's structured

Everything lives in **`src/RAMCoachingSystem.jsx`**, deliberately. It's one
self-contained file with no local imports, so you can paste it straight back into a
Claude artifact and it will run there unchanged. The Vite scaffolding around it
(`index.html`, `src/main.jsx`, `src/index.css`) is just a host for local development
and static deploys.

If you split that file into modules, it stops being artifact-portable. That's the
tradeoff being made on purpose.

### Storage

The `store` adapter near the top writes to `window.storage` when it exists (the
hosted-artifact API) and falls back to `localStorage` everywhere else. Same key
(`ramcoach:v1`), same JSON shape, so data written in one context reads back in the
other. Nothing goes to a server — it's all on the device.

`normalize()` fills in missing fields when loading, so a save written by an older
build can't crash a newer one.

### Data shape

```js
{
  roster:       [{ id, name }],
  behaviors:    [{ id, phase, text, track, on, archived? }],
  observations: [{ id, personId, date, marks, sit, beh, imp,
                   commitment, recheck, focus, resolved, stuck? }],
  cadenceDays:  7
}
```

`marks` maps behavior id → `'strength' | 'gap'`. `focus` stores the gap's *text* at
save time rather than a reference, so history stays readable no matter what happens
to the library later.

Dates are local calendar days (`YYYY-MM-DD`), never UTC — an observation logged at
6pm Pacific has to stamp today, not tomorrow.

## Behavior notes worth knowing

- **Deleting a behavior that history scored archives it instead of erasing it.**
  Past observations were scored against specific wording; deleting that wording
  would silently rewrite the record. Archived behaviors drop out of rotation and
  the library list, and can be restored. Never-scored behaviors delete outright.
- **A failed write rolls the UI back.** If storage rejects, the change is undone and
  a banner says so, so the screen never shows state that isn't saved.
- **Removing a teammate is gated behind an inline confirm** that names how many
  observations go with them.
- **Editing an observation reuses the capture form** rather than a second form that
  would drift out of sync. `CaptureView` takes an `editing` prop; it's remounted via
  `key` so one observation's answers can never bleed into another's.
- **Rewriting a commitment clears its stuck / still-there verdict**, because that
  verdict was about the old wording. Leaving the commitment untouched while fixing a
  typo elsewhere keeps the verdict.
- **A behavior you already marked stays visible while editing** even if it's since
  been switched off or archived — otherwise the edit would preserve a score you
  can't see or clear.
- You can correct an observation's **date** when editing (capped at today), for when
  you log Monday's floor time on Tuesday.
