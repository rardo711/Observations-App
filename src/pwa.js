/* Install / offline / update plumbing, kept out of the component so the
   component stays paste-able into an artifact where none of this applies. */

export const isStandalone = () =>
  window.matchMedia?.('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

/* iOS has no install prompt — the user has to go through the Share sheet, so
   we have to detect it and tell them rather than offer a button. iPadOS 13+
   reports itself as a Mac, hence the touch-point check. */
export const isIOS = () => {
  const ua = navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
};

let deferredPrompt = null;
let started = false;

export function initPWA({ onInstallable, onUpdateReady }) {
  // StrictMode runs effects twice in development; registering twice would
  // double up the listeners and the reload.
  if (started) return;
  started = true;

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // keep Chrome's own mini-infobar from firing
    deferredPrompt = e;
    onInstallable(true);
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    onInstallable(false);
  });

  if (!('serviceWorker' in navigator)) return;

  const register = async () => {
    try {
      // Relative to the document, so it picks up the /Observations-App/ subpath
      // on Pages and the root anywhere else.
      /* updateViaCache: 'none' keeps the worker script itself out of the HTTP
         cache. By default the browser is allowed to reuse a cached sw.js, and
         Pages sends max-age=600 on everything — so a fix to the worker would
         go unnoticed for ten minutes, which is ten minutes of a broken worker
         staying in charge. */
      const reg = await navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' });

      // A worker already parked in `waiting` means an update landed on a
      // previous visit that was never applied.
      if (reg.waiting && navigator.serviceWorker.controller) onUpdateReady(reg);

      reg.addEventListener('updatefound', () => {
        const installing = reg.installing;
        if (!installing) return;
        installing.addEventListener('statechange', () => {
          // A controller already present means this is an update rather than
          // the very first install, which needs no prompt.
          if (installing.state === 'installed' && navigator.serviceWorker.controller) {
            onUpdateReady(reg);
          }
        });
      });
    } catch {
      // No service worker just means no offline support; the app still runs.
    }
  };

  // Waiting on the load event alone would never fire if it already has by the
  // time React mounts this — which is exactly what happens on a warm cache.
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });

  /* Deliberately no reload on controllerchange. The worker now activates as
     soon as it installs, so reloading here would yank the page out from under
     someone half way through writing up an observation. The new worker is
     already in charge; the toast lets the user take the reload when it suits
     them, and the next launch picks it up regardless. */
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export function applyUpdate(reg) {
  // The worker skips waiting on install, so by now it is usually already
  // active and a plain reload is enough. The postMessage covers a browser
  // that still parked it in `waiting`.
  if (reg?.waiting) reg.waiting.postMessage('skip-waiting');
  window.location.reload();
}
