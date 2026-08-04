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
      const reg = await navigator.serviceWorker.register('./sw.js');

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

  /* On a first visit the worker calls clients.claim(), which fires
     controllerchange even though nothing was replaced. Reloading on that would
     flash the app for every new visitor, so only a change that supersedes an
     existing controller counts as a real update. */
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    window.location.reload();
  });
}

export async function promptInstall() {
  if (!deferredPrompt) return false;
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  deferredPrompt = null;
  return outcome === 'accepted';
}

export function applyUpdate(reg) {
  // controllerchange (above) reloads the page once the new worker takes over.
  if (reg?.waiting) reg.waiting.postMessage('skip-waiting');
  else window.location.reload();
}
