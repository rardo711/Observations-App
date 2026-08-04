# Observations App

A phone-sized coaching tool for retail floor leads: track who you've observed, what
you saw against a behavior library, the commitment they made, and whether it stuck.

## Run it

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static output in dist/
```

`dist/` is plain static files — drop it on any static host.

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
