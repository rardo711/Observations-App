import React, { useState, useEffect } from 'react';
import { Download, X, RefreshCw, Share } from 'lucide-react';
import RAMCoachingSystem from './RAMCoachingSystem.jsx';
import { initPWA, promptInstall, applyUpdate, isStandalone, isIOS } from './pwa.js';

/* Which device this is doesn't belong in the coaching data, so it gets its
   own key rather than riding along in ramcoach:v1. */
const DISMISS_KEY = 'ramcoach:install-dismissed';

const C = { ink: '#16181D', sub: '#6B7076', card: '#FFFFFF', rule: '#E3E5E9', accent: '#E20074' };

/* Floats above the tab bar so neither banner has to reflow the app itself. */
const dockStyle = {
  bottom: 'calc(4.75rem + env(safe-area-inset-bottom, 0px))',
  paddingLeft: 'max(1rem, env(safe-area-inset-left, 0px))',
  paddingRight: 'max(1rem, env(safe-area-inset-right, 0px))',
};

export default function App() {
  const [installable, setInstallable] = useState(false);
  const [updateReg, setUpdateReg] = useState(null);
  const [dismissed, setDismissed] = useState(() => {
    try { return localStorage.getItem(DISMISS_KEY) === '1'; } catch { return false; }
  });

  useEffect(() => {
    initPWA({ onInstallable: setInstallable, onUpdateReady: setUpdateReg });
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try { localStorage.setItem(DISMISS_KEY, '1'); } catch { /* private mode; just hide it for now */ }
  };

  const install = async () => {
    const accepted = await promptInstall();
    setInstallable(false);
    if (!accepted) dismiss();
  };

  // Already installed means there is nothing to prompt for.
  const showIOSHint = isIOS() && !isStandalone() && !dismissed;
  const showInstall = installable && !isStandalone() && !dismissed;

  return (
    <>
      <RAMCoachingSystem />

      {updateReg && (
        <div className="fixed left-0 right-0 z-50" style={dockStyle}>
          <div className="rounded-xl p-3 flex items-center gap-3 shadow-lg" style={{ background: C.ink, color: '#fff' }}>
            <RefreshCw size={18} className="shrink-0" />
            <span className="flex-1 text-sm">A newer version is ready.</span>
            <button onClick={() => applyUpdate(updateReg)} className="px-3 py-1.5 rounded-lg text-sm font-semibold" style={{ background: '#fff', color: C.ink }}>
              Reload
            </button>
            <button onClick={() => setUpdateReg(null)} aria-label="Dismiss update"><X size={16} /></button>
          </div>
        </div>
      )}

      {!updateReg && showInstall && (
        <div className="fixed left-0 right-0 z-50" style={dockStyle}>
          <div className="rounded-xl p-3 flex items-center gap-3 shadow-lg" style={{ background: C.card, border: `1px solid ${C.rule}`, color: C.ink }}>
            <Download size={18} className="shrink-0" style={{ color: C.accent }} />
            <span className="flex-1 text-sm leading-snug">Install this on your home screen for one-tap access.</span>
            <button onClick={install} className="px-3 py-1.5 rounded-lg text-sm font-semibold text-white shrink-0" style={{ background: C.accent }}>
              Install
            </button>
            <button onClick={dismiss} aria-label="Dismiss install prompt" style={{ color: C.sub }}><X size={16} /></button>
          </div>
        </div>
      )}

      {/* Safari fires no beforeinstallprompt, so on iOS the only route is the
          Share sheet and the user has to be told where it is. */}
      {!updateReg && !showInstall && showIOSHint && (
        <div className="fixed left-0 right-0 z-50" style={dockStyle}>
          <div className="rounded-xl p-3 flex items-start gap-3 shadow-lg" style={{ background: C.card, border: `1px solid ${C.rule}`, color: C.ink }}>
            <Share size={18} className="shrink-0 mt-0.5" style={{ color: C.accent }} />
            <span className="flex-1 text-sm leading-snug">
              Add to your home screen: tap <span className="font-semibold">Share</span>, then{' '}
              <span className="font-semibold">Add to Home Screen</span>.
            </span>
            <button onClick={dismiss} aria-label="Dismiss install hint" style={{ color: C.sub }}><X size={16} /></button>
          </div>
        </div>
      )}
    </>
  );
}
