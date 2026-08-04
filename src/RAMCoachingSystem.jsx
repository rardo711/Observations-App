import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronLeft, Plus, X, Users, ClipboardList, Sliders, Trash2, CircleAlert, ArrowRight, RotateCcw, Pencil } from 'lucide-react';

const C = {
  ink: '#16181D',
  sub: '#6B7076',
  faint: '#9AA0A6',
  paper: '#F4F5F7',
  card: '#FFFFFF',
  rule: '#E3E5E9',
  accent: '#E20074',
  strength: '#0E7C5A',
  strengthBg: '#E6F2ED',
  gap: '#B45309',
  gapBg: '#FBF0E2',
  overdue: '#C2334D',
};

const KEY = 'ramcoach:v1';

const SEED_BEHAVIORS = [
  { id: 'b1', phase: 'Open', text: 'Greets within seconds, branded and warm', track: 'coach', on: true },
  { id: 'b2', phase: 'Open', text: 'Checks in via Magenta Welcome with the accurate reason', track: 'coach', on: true },
  { id: 'b3', phase: 'Open', text: 'Sets expectations for how the visit will go', track: 'coach', on: true },
  { id: 'b4', phase: 'Discover', text: 'Asks personalized questions beyond the transaction', track: 'coach', on: true },
  { id: 'b5', phase: 'Discover', text: 'Listens without interrupting', track: 'coach', on: true },
  { id: 'b6', phase: 'Discover', text: 'Summarizes back and confirms agreement', track: 'coach', on: true },
  { id: 'b7', phase: 'Discover', text: 'Reviews the full account — lines, devices, protection, HSI', track: 'coach', on: true },
  { id: 'b8', phase: 'Discover', text: 'Confirms Digital Ready — T-Life, T-Mobile ID, permissions, AutoPay', track: 'coach', on: true },
  { id: 'b9', phase: 'Right-fit', text: 'Recommends from what the customer actually said', track: 'coach', on: true },
  { id: 'b10', phase: 'Right-fit', text: 'Explores employer eligibility and Work Perks', track: 'coach', on: true },
  { id: 'b11', phase: 'Right-fit', text: 'States requirements and limitations up front', track: 'coach', on: true },
  { id: 'b12', phase: 'Explain', text: 'Walks through charges, taxes, fees, EIP and trade-in', track: 'coach', on: true },
  { id: 'b13', phase: 'Explain', text: 'Uses plain language, no jargon', track: 'coach', on: true },
  { id: 'b14', phase: 'Explain', text: 'Sets the device up to confident use', track: 'coach', on: true },
  { id: 'b15', phase: 'Explain', text: 'Shows T-Life for self-service', track: 'coach', on: true },
  { id: 'b16', phase: 'Own', text: 'Resolves the stated reason before pivoting', track: 'coach', on: true },
  { id: 'b17', phase: 'Own', text: 'Leads with empathy before policy', track: 'coach', on: true },
  { id: 'b18', phase: 'Own', text: 'Sounds personal, not scripted', track: 'coach', on: true },
  { id: 'b19', phase: 'Follow through', text: 'Completes appointment outcomes same day', track: 'coach', on: true },
  { id: 'b20', phase: 'Follow through', text: 'Follows up within 24 hours', track: 'coach', on: true },
  { id: 'b21', phase: 'Follow through', text: 'Writes lead notes the next Expert could actually use', track: 'coach', on: true },
  { id: 'b22', phase: 'Follow through', text: 'Retrieves and uses Saved Carts', track: 'coach', on: false },
  { id: 'c1', phase: 'Compliance', text: 'Verifies the account before any access or change', track: 'comply', on: true },
  { id: 'c2', phase: 'Compliance', text: 'Follows calling rules — landline, hours, attempt limits', track: 'comply', on: true },
  { id: 'c3', phase: 'Compliance', text: 'Honors do-not-call requests immediately', track: 'comply', on: true },
  { id: 'c4', phase: 'Compliance', text: 'Declines account work over the store phone', track: 'comply', on: true },
];

const PHASES = ['Open', 'Discover', 'Right-fit', 'Explain', 'Own', 'Follow through', 'Compliance'];

const seed = () => ({ roster: [], behaviors: SEED_BEHAVIORS, observations: [], cadenceDays: 7 });

/* Fill in anything a previously saved copy is missing, so an older save
   can't crash a newer build. */
const normalize = (raw) => {
  const d = raw && typeof raw === 'object' ? raw : {};
  const cadence = Number(d.cadenceDays);
  return {
    roster: Array.isArray(d.roster) ? d.roster : [],
    behaviors: Array.isArray(d.behaviors) && d.behaviors.length ? d.behaviors : SEED_BEHAVIORS,
    observations: Array.isArray(d.observations) ? d.observations : [],
    cadenceDays: Number.isFinite(cadence) && cadence > 0 ? cadence : 7,
  };
};

/* window.storage exists when this runs as a hosted artifact; everywhere else
   (local dev, a static deploy) fall back to localStorage. Same shape either way. */
const store = {
  async get(key) {
    if (typeof window !== 'undefined' && window.storage?.get) {
      const r = await window.storage.get(key);
      return r?.value ?? null;
    }
    return window.localStorage.getItem(key);
  },
  async set(key, value) {
    if (typeof window !== 'undefined' && window.storage?.set) {
      await window.storage.set(key, value);
      return;
    }
    window.localStorage.setItem(key, value);
  },
};

/* Dates are the coach's local calendar days, not UTC — observing at 6pm
   Pacific must not stamp tomorrow's date. */
const isoLocal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const today = () => isoLocal(new Date());
const addDays = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLocal(d); };
const daysBetween = (a, b) => Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000);
const isPast = (iso) => Boolean(iso) && iso < today();
const fmt = (iso) => { if (!iso) return '—'; const d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }); };
const uid = () => Math.random().toString(36).slice(2, 9);

export default function RAMCoachingSystem() {
  const [data, setData] = useState(null);
  const [view, setView] = useState('team');
  const [personId, setPersonId] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [notice, setNotice] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const raw = await store.get(KEY);
        if (alive) setData(raw ? normalize(JSON.parse(raw)) : seed());
      } catch {
        if (alive) setData(seed());
      }
    })();
    return () => { alive = false; };
  }, []);

  /* Roll the UI back if the write failed, so what's on screen always matches
     what's on disk. */
  const persist = async (next) => {
    const prev = data;
    setData(next);
    try {
      await store.set(KEY, JSON.stringify(next));
      return true;
    } catch {
      setData(prev);
      setNotice('That did not save, so the change was undone. Check your connection and try again.');
      return false;
    }
  };

  if (!data) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: C.paper, color: C.faint }}>
      <span className="text-sm">Loading your notes…</span>
    </div>
  );

  const person = data.roster.find((p) => p.id === personId) || null;
  /* Falls back to null if the observation was deleted out from under us. */
  const editing = editingId ? data.observations.find((o) => o.id === editingId) || null : null;

  const editObservation = (id) => { setEditingId(id); setView('capture'); };
  const leaveCapture = () => { setEditingId(null); setView(editing ? 'person' : 'team'); };

  return (
    <div className="min-h-screen pb-20" style={{ background: C.paper, color: C.ink, fontFamily: 'ui-sans-serif, system-ui, -apple-system, sans-serif' }}>
      {notice && (
        <div role="alert" className="px-4 py-3 text-sm flex items-start gap-2" style={{ background: '#FDEAEE', color: C.overdue }}>
          <CircleAlert size={16} className="mt-0.5 shrink-0" />
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss"><X size={16} /></button>
        </div>
      )}

      {view === 'team' && <TeamView data={data} persist={persist} open={(id) => { setPersonId(id); setView('person'); }} />}
      {view === 'capture' && (
        /* Remount on target change so the form never carries another
           observation's answers over. */
        <CaptureView
          key={editingId || 'new'}
          data={data} persist={persist} preselect={personId} editing={editing}
          done={leaveCapture} cancel={leaveCapture}
        />
      )}
      {view === 'person' && person && (
        <PersonView
          data={data} persist={persist} person={person}
          back={() => setView('team')} observe={() => { setEditingId(null); setView('capture'); }}
          edit={editObservation}
        />
      )}
      {view === 'library' && <LibraryView data={data} persist={persist} />}

      <nav className="fixed bottom-0 left-0 right-0 flex" style={{ background: C.card, borderTop: `1px solid ${C.rule}` }}>
        {[
          { k: 'team', label: 'Team', Icon: Users },
          { k: 'capture', label: 'Observe', Icon: ClipboardList },
          { k: 'library', label: 'Behaviors', Icon: Sliders },
        ].map(({ k, label, Icon }) => {
          const on = view === k || (k === 'team' && view === 'person');
          return (
            <button
              key={k}
              onClick={() => { if (k === 'capture') setPersonId(null); setEditingId(null); setView(k); }}
              aria-current={on ? 'page' : undefined}
              className="flex-1 py-3 flex flex-col items-center gap-1 text-xs"
              style={{ color: on ? C.accent : C.sub }}
            >
              <Icon size={20} strokeWidth={2} />
              {label}
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function Header({ title, sub, back, right }) {
  return (
    <header className="px-4 pt-6 pb-4" style={{ background: C.card, borderBottom: `1px solid ${C.rule}` }}>
      <div className="flex items-start gap-3">
        {back && <button onClick={back} className="mt-1 -ml-1" aria-label="Back" style={{ color: C.sub }}><ChevronLeft size={22} /></button>}
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight truncate">{title}</h1>
          {sub && <p className="text-sm mt-0.5" style={{ color: C.sub }}>{sub}</p>}
        </div>
        {right}
      </div>
    </header>
  );
}

function Eyebrow({ children }) {
  return <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.faint }}>{children}</div>;
}

/* ---------------- Team ---------------- */

function TeamView({ data, persist, open }) {
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [dupe, setDupe] = useState(false);

  const rows = data.roster.map((p) => {
    const obs = data.observations.filter((o) => o.personId === p.id).sort((a, b) => b.date.localeCompare(a.date));
    const last = obs[0];
    const since = last ? daysBetween(last.date, today()) : null;
    const openC = obs.find((o) => o.commitment && !o.resolved);
    return { p, last, since, openC, count: obs.length };
  }).sort((a, b) => (b.since ?? 999) - (a.since ?? 999));

  const add = () => {
    const n = name.trim();
    if (!n) return;
    if (data.roster.some((p) => p.name.toLowerCase() === n.toLowerCase())) { setDupe(true); return; }
    persist({ ...data, roster: [...data.roster, { id: uid(), name: n }] });
    setName(''); setDupe(false); setAdding(false);
  };

  return (
    <div>
      <Header
        title="My team"
        sub={`Observe each person every ${data.cadenceDays} days`}
        right={<button onClick={() => setAdding(true)} className="mt-1 p-1" aria-label="Add teammate" style={{ color: C.accent }}><Plus size={22} /></button>}
      />

      {adding && (
        <div className="p-4" style={{ background: C.card, borderBottom: `1px solid ${C.rule}` }}>
          <input
            autoFocus value={name} onChange={(e) => { setName(e.target.value); setDupe(false); }}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Name" aria-label="Teammate name"
            className="w-full px-3 py-3 rounded-lg text-base outline-none"
            style={{ background: C.paper, border: `1px solid ${dupe ? C.overdue : C.rule}` }}
          />
          {dupe && <p className="text-sm mt-2" style={{ color: C.overdue }}>Someone with that name is already on the roster.</p>}
          <div className="flex gap-2 mt-3">
            <button onClick={add} className="px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ background: C.accent }}>Add</button>
            <button onClick={() => { setAdding(false); setName(''); setDupe(false); }} className="px-4 py-2 rounded-lg text-sm" style={{ color: C.sub }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="p-4 space-y-3">
        {rows.length === 0 && (
          <div className="text-center py-16 px-6">
            <p className="text-base font-medium">No one on the roster yet.</p>
            <p className="text-sm mt-2" style={{ color: C.sub }}>Add your Mobile Experts to start tracking observations and commitments.</p>
          </div>
        )}

        {rows.map(({ p, last, since, openC, count }) => {
          const overdue = since === null || since >= data.cadenceDays;
          const commitLate = openC && isPast(openC.recheck);
          return (
            <button key={p.id} onClick={() => open(p.id)} className="w-full text-left rounded-xl p-4" style={{ background: C.card, border: `1px solid ${overdue ? C.overdue : C.rule}` }}>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-lg font-semibold tracking-tight">{p.name}</span>
                <span className="text-xs shrink-0" style={{ color: overdue ? C.overdue : C.sub, fontVariantNumeric: 'tabular-nums' }}>
                  {since === null ? 'Never observed' : since === 0 ? 'Observed today' : `${since}d ago`}
                </span>
              </div>
              <div className="mt-2 text-sm" style={{ color: C.sub }}>
                {count} observation{count === 1 ? '' : 's'}
                {openC && <> · <span style={{ color: commitLate ? C.overdue : C.sub }}>commitment due {fmt(openC.recheck)}</span></>}
              </div>
              {last?.focus && (
                <div className="mt-3 pt-3 text-sm" style={{ borderTop: `1px solid ${C.rule}` }}>
                  <span className="text-xs uppercase tracking-widest mr-2" style={{ color: C.faint }}>Focus</span>
                  {last.focus}
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Capture ---------------- */

function CaptureView({ data, persist, preselect, editing, done, cancel }) {
  const [pid, setPid] = useState(editing?.personId || preselect || '');
  const [marks, setMarks] = useState(editing?.marks || {});
  const [date, setDate] = useState(editing?.date || today());
  const [sit, setSit] = useState(editing?.sit || '');
  const [beh, setBeh] = useState(editing?.beh || '');
  const [imp, setImp] = useState(editing?.imp || '');
  const [commitment, setCommitment] = useState(editing?.commitment || '');
  const [recheck, setRecheck] = useState(() => editing?.recheck || addDays(data.cadenceDays));
  const [saved, setSaved] = useState(false);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  /* Anything currently marked stays visible even if it's since been switched
     off or archived — otherwise editing would silently keep a score the
     coach can't see or clear. */
  const active = data.behaviors.filter((b) => (b.on && !b.archived) || marks[b.id]);
  const phases = [...new Set(active.map((b) => b.phase))];

  const cycle = (id) => setMarks((m) => {
    const cur = m[id];
    const next = { ...m };
    if (!cur) next[id] = 'strength';
    else if (cur === 'strength') next[id] = 'gap';
    else delete next[id];
    return next;
  });

  const canSave = pid && Object.keys(marks).length > 0;

  const save = async () => {
    if (!canSave) return;
    /* Focus follows library order, not tap order, so it's the same answer
       no matter which chip you tapped first. */
    const firstGap = active.find((b) => marks[b.id] === 'gap');
    const promise = commitment.trim();
    const fields = {
      personId: pid, date, marks, sit, beh, imp,
      commitment: promise,
      recheck: promise ? recheck : null,
      focus: firstGap ? firstGap.text : null,
    };

    let next;
    if (editing) {
      /* Rewriting the commitment makes it a different promise, so its
         stuck/still-there verdict no longer applies. An untouched one keeps
         whatever was already decided. */
      const sameCommitment = promise === (editing.commitment || '');
      const keep = Boolean(promise) && sameCommitment;
      const updated = { ...editing, ...fields, resolved: keep ? editing.resolved : false, stuck: keep ? editing.stuck : undefined };
      next = { ...data, observations: data.observations.map((o) => (o.id === editing.id ? updated : o)) };
    } else {
      next = { ...data, observations: [...data.observations, { id: uid(), ...fields, resolved: false }] };
    }

    const ok = await persist(next);
    if (!ok) return;
    setSaved(true);
    timer.current = setTimeout(done, 700);
  };

  if (saved) return (
    <div className="min-h-screen flex items-center justify-center px-8 text-center">
      <p className="text-lg font-medium">{editing ? 'Changes saved.' : 'Observation saved.'}</p>
    </div>
  );

  return (
    <div>
      <Header
        title={editing ? 'Edit observation' : 'New observation'}
        sub={editing ? 'Correcting a note you already saved' : fmt(today())}
        back={editing ? cancel : undefined}
      />

      <div className="p-4 space-y-5">
        <div>
          <Eyebrow>Who</Eyebrow>
          <div className="flex flex-wrap gap-2">
            {data.roster.map((p) => (
              <button key={p.id} onClick={() => setPid(p.id)} aria-pressed={pid === p.id} className="px-4 py-2 rounded-full text-sm font-medium"
                style={pid === p.id ? { background: C.accent, color: '#fff' } : { background: C.card, color: C.ink, border: `1px solid ${C.rule}` }}>
                {p.name}
              </button>
            ))}
            {data.roster.length === 0 && <p className="text-sm" style={{ color: C.sub }}>Add teammates on the Team tab first.</p>}
          </div>
        </div>

        {editing && (
          <div>
            <Eyebrow>When</Eyebrow>
            <input id="obs-date" type="date" value={date} max={today()} onChange={(e) => setDate(e.target.value)}
              aria-label="Observation date"
              className="px-3 py-2 rounded-lg text-sm outline-none"
              style={{ background: C.card, border: `1px solid ${C.rule}` }} />
          </div>
        )}

        <div>
          <Eyebrow>What you saw</Eyebrow>
          <p className="text-sm mb-3" style={{ color: C.sub }}>Tap once for a strength, twice for a gap, three times to clear. Tag three to five, not twenty.</p>
          {active.length === 0 && (
            <p className="text-sm" style={{ color: C.sub }}>No behaviors are in rotation. Turn some on from the Behaviors tab.</p>
          )}
          <div className="space-y-4">
            {phases.map((ph) => (
              <div key={ph}>
                <div className="text-xs font-semibold mb-2" style={{ color: ph === 'Compliance' ? C.overdue : C.sub }}>{ph}</div>
                <div className="space-y-1.5">
                  {active.filter((b) => b.phase === ph).map((b) => {
                    const m = marks[b.id];
                    const style = m === 'strength'
                      ? { background: C.strengthBg, borderColor: C.strength, color: C.strength }
                      : m === 'gap'
                      ? { background: C.gapBg, borderColor: C.gap, color: C.gap }
                      : { background: C.card, borderColor: C.rule, color: C.ink };
                    return (
                      <button key={b.id} onClick={() => cycle(b.id)}
                        aria-label={`${b.text} — ${m === 'strength' ? 'marked a strength' : m === 'gap' ? 'marked a gap' : 'not marked'}`}
                        className="w-full text-left px-3 py-3 rounded-lg text-sm leading-snug flex items-center gap-3"
                        style={{ ...style, borderWidth: 1, borderStyle: 'solid' }}>
                        <span aria-hidden className="shrink-0 w-5 text-center text-xs font-bold">{m === 'strength' ? '+' : m === 'gap' ? '△' : ''}</span>
                        <span className="flex-1">{b.text}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <Eyebrow>Note it as SBI</Eyebrow>
          {[['Situation', sit, setSit, 'Tuesday, upgrade with a family of four'],
            ['Behavior', beh, setBeh, 'Moved to devices before asking what they use their phones for'],
            ['Impact', imp, setImp, 'Missed the HSI opening and the customer asked twice about their bill']].map(([label, val, set, ph]) => (
            <div key={label} className="mb-3">
              <label className="text-xs font-medium block mb-1" style={{ color: C.sub }} htmlFor={`sbi-${label}`}>{label}</label>
              <textarea id={`sbi-${label}`} value={val} onChange={(e) => set(e.target.value)} placeholder={ph} rows={2}
                className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
                style={{ background: C.card, border: `1px solid ${C.rule}` }} />
            </div>
          ))}
        </div>

        <div>
          <Eyebrow>Commitment</Eyebrow>
          <textarea value={commitment} onChange={(e) => setCommitment(e.target.value)} rows={2}
            placeholder="What they agreed to do differently — in their words, not yours"
            aria-label="Commitment"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none"
            style={{ background: C.card, border: `1px solid ${C.rule}` }} />
          {commitment.trim() && (
            <div className="mt-3 flex items-center gap-3">
              <label className="text-sm" style={{ color: C.sub }} htmlFor="recheck">Re-observe by</label>
              {/* An existing commitment's date may already be past; only a new one must be in the future. */}
              <input id="recheck" type="date" value={recheck} min={editing ? undefined : today()} onChange={(e) => setRecheck(e.target.value)}
                className="px-3 py-2 rounded-lg text-sm outline-none"
                style={{ background: C.card, border: `1px solid ${C.rule}` }} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <button onClick={save} disabled={!canSave}
            className="w-full py-4 rounded-xl font-semibold text-white text-base"
            style={{ background: canSave ? C.accent : C.faint }}>
            {editing ? 'Save changes' : 'Save observation'}
          </button>
          {editing && (
            <button onClick={cancel} className="w-full py-3 rounded-xl text-sm" style={{ color: C.sub }}>
              Discard changes
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------------- Person ---------------- */

function PersonView({ data, persist, person, back, observe, edit }) {
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  const obs = useMemo(
    () => data.observations.filter((o) => o.personId === person.id).sort((a, b) => b.date.localeCompare(a.date)),
    [data.observations, person.id]
  );

  const tally = (kind, min, limit) => {
    const counts = {};
    obs.forEach((o) => Object.entries(o.marks || {}).forEach(([id, v]) => {
      if (v === kind) counts[id] = (counts[id] || 0) + 1;
    }));
    const ranked = Object.entries(counts).filter(([, n]) => n >= min).sort((a, b) => b[1] - a[1])
      .map(([id, n]) => ({ n, text: data.behaviors.find((b) => b.id === id)?.text || 'Deleted behavior' }));
    return limit ? ranked.slice(0, limit) : ranked;
  };

  const recurring = useMemo(() => tally('gap', 2), [obs, data.behaviors]);
  const strengths = useMemo(() => tally('strength', 2, 3), [obs, data.behaviors]);

  const resolve = (obsId, stuck) => {
    persist({ ...data, observations: data.observations.map((o) => o.id === obsId ? { ...o, resolved: true, stuck } : o) });
  };

  const remove = () => {
    persist({ ...data, roster: data.roster.filter((p) => p.id !== person.id), observations: data.observations.filter((o) => o.personId !== person.id) });
    back();
  };

  const deleteObservation = (id) => {
    persist({ ...data, observations: data.observations.filter((o) => o.id !== id) });
    setPendingDelete(null);
  };

  const openCommit = obs.find((o) => o.commitment && !o.resolved);
  const commitLate = openCommit && isPast(openCommit.recheck);

  return (
    <div>
      <Header title={person.name} sub={`${obs.length} observation${obs.length === 1 ? '' : 's'}`} back={back} />

      <div className="p-4 space-y-5">
        <button onClick={observe} className="w-full py-3.5 rounded-xl font-semibold text-white flex items-center justify-center gap-2" style={{ background: C.accent }}>
          Observe {person.name.split(' ')[0]} <ArrowRight size={18} />
        </button>

        {openCommit && (
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${commitLate ? C.overdue : C.rule}` }}>
            <Eyebrow>Open commitment</Eyebrow>
            <p className="text-base leading-snug">{openCommit.commitment}</p>
            <p className="text-sm mt-2" style={{ color: commitLate ? C.overdue : C.sub }}>
              Set {fmt(openCommit.date)} · re-observe by {fmt(openCommit.recheck)}
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={() => resolve(openCommit.id, true)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.strengthBg, color: C.strength }}>It stuck</button>
              <button onClick={() => resolve(openCommit.id, false)} className="flex-1 py-2.5 rounded-lg text-sm font-medium" style={{ background: C.gapBg, color: C.gap }}>Still there</button>
            </div>
          </div>
        )}

        {recurring.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
            <Eyebrow>Recurring gaps</Eyebrow>
            <div className="space-y-3">
              {recurring.map((r, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div aria-hidden className="flex gap-0.5 pt-1.5 shrink-0">
                    {Array.from({ length: Math.min(r.n, 5) }).map((_, j) => (
                      <span key={j} className="block rounded-sm" style={{ width: 4, height: 14 + j * 3, background: C.gap, opacity: 0.35 + j * 0.16 }} />
                    ))}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm leading-snug">{r.text}</p>
                    <p className="text-xs mt-0.5" style={{ color: C.gap, fontVariantNumeric: 'tabular-nums' }}>{r.n} observations</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {strengths.length > 0 && (
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
            <Eyebrow>Consistent strengths</Eyebrow>
            {strengths.map((s, i) => (
              <p key={i} className="text-sm leading-snug py-1" style={{ color: C.strength }}>{s.text} <span style={{ color: C.faint }}>· {s.n}×</span></p>
            ))}
          </div>
        )}

        <div>
          <Eyebrow>History</Eyebrow>
          <div className="space-y-3">
            {obs.length === 0 && <p className="text-sm" style={{ color: C.sub }}>Nothing recorded yet.</p>}
            {obs.map((o) => {
              const g = Object.values(o.marks || {}).filter((v) => v === 'gap').length;
              const s = Object.values(o.marks || {}).filter((v) => v === 'strength').length;
              return (
                <div key={o.id} className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-sm font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{fmt(o.date)}</span>
                    <span className="text-xs" style={{ color: C.sub }}>
                      <span style={{ color: C.strength }}>{s} strength{s === 1 ? '' : 's'}</span> · <span style={{ color: C.gap }}>{g} gap{g === 1 ? '' : 's'}</span>
                    </span>
                  </div>
                  {(o.sit || o.beh || o.imp) && (
                    <div className="mt-2 space-y-1 text-sm leading-snug">
                      {o.sit && <p><span style={{ color: C.faint }}>S </span>{o.sit}</p>}
                      {o.beh && <p><span style={{ color: C.faint }}>B </span>{o.beh}</p>}
                      {o.imp && <p><span style={{ color: C.faint }}>I </span>{o.imp}</p>}
                    </div>
                  )}
                  {o.commitment && (
                    <p className="mt-2 pt-2 text-sm" style={{ borderTop: `1px solid ${C.rule}`, color: C.sub }}>
                      {o.commitment}
                      {o.resolved && <span style={{ color: o.stuck ? C.strength : C.gap }}> — {o.stuck ? 'stuck' : 'still there'}</span>}
                    </p>
                  )}

                  {pendingDelete === o.id ? (
                    <div className="mt-3 pt-3" style={{ borderTop: `1px solid ${C.rule}` }}>
                      <p className="text-sm leading-snug">Delete this observation? Its marks stop counting toward recurring gaps and strengths.</p>
                      <div className="flex gap-2 mt-3">
                        <button onClick={() => deleteObservation(o.id)} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: C.overdue }}>Delete</button>
                        <button onClick={() => setPendingDelete(null)} className="flex-1 py-2.5 rounded-lg text-sm" style={{ color: C.sub, border: `1px solid ${C.rule}` }}>Keep</button>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 pt-3 flex gap-4" style={{ borderTop: `1px solid ${C.rule}` }}>
                      <button onClick={() => edit(o.id)} className="flex items-center gap-1.5 text-sm font-medium" aria-label={`Edit the observation from ${fmt(o.date)}`} style={{ color: C.accent }}>
                        <Pencil size={14} /> Edit
                      </button>
                      <button onClick={() => setPendingDelete(o.id)} className="flex items-center gap-1.5 text-sm" aria-label={`Delete the observation from ${fmt(o.date)}`} style={{ color: C.sub }}>
                        <Trash2 size={14} /> Delete
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {confirmRemove ? (
          <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.overdue}` }}>
            <p className="text-sm leading-snug">
              Remove {person.name} and delete {obs.length} observation{obs.length === 1 ? '' : 's'}? This can't be undone.
            </p>
            <div className="flex gap-2 mt-3">
              <button onClick={remove} className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: C.overdue }}>Remove</button>
              <button onClick={() => setConfirmRemove(false)} className="flex-1 py-2.5 rounded-lg text-sm" style={{ color: C.sub, border: `1px solid ${C.rule}` }}>Keep</button>
            </div>
          </div>
        ) : (
          <button onClick={() => setConfirmRemove(true)} className="w-full py-3 rounded-lg text-sm flex items-center justify-center gap-2" style={{ color: C.overdue }}>
            <Trash2 size={16} /> Remove {person.name} and their history
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- Library ---------------- */

function LibraryView({ data, persist }) {
  const [text, setText] = useState('');
  const [phase, setPhase] = useState('Discover');
  const [pendingDelete, setPendingDelete] = useState(null);

  const usedIds = useMemo(() => {
    const s = new Set();
    data.observations.forEach((o) => Object.keys(o.marks || {}).forEach((id) => s.add(id)));
    return s;
  }, [data.observations]);

  const live = data.behaviors.filter((b) => !b.archived);
  const archived = data.behaviors.filter((b) => b.archived);

  const toggle = (id) => persist({ ...data, behaviors: data.behaviors.map((b) => b.id === id ? { ...b, on: !b.on } : b) });

  /* A behavior that history refers to gets archived, not deleted — otherwise
     past observations lose the wording they were scored against. */
  const del = (id) => {
    const next = usedIds.has(id)
      ? data.behaviors.map((b) => b.id === id ? { ...b, archived: true, on: false } : b)
      : data.behaviors.filter((b) => b.id !== id);
    persist({ ...data, behaviors: next });
    setPendingDelete(null);
  };

  const restore = (id) => persist({ ...data, behaviors: data.behaviors.map((b) => b.id === id ? { ...b, archived: false, on: true } : b) });

  const add = () => {
    const t = text.trim();
    if (!t) return;
    persist({ ...data, behaviors: [...data.behaviors, { id: uid(), phase, text: t, track: phase === 'Compliance' ? 'comply' : 'coach', on: true }] });
    setText('');
  };
  const setCadence = (n) => persist({ ...data, cadenceDays: n });

  const onCount = live.filter((b) => b.on).length;

  return (
    <div>
      <Header title="Behaviors" sub={`${onCount} of ${live.length} in rotation`} />

      <div className="p-4 space-y-5">
        <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <Eyebrow>Observation cadence</Eyebrow>
          <div className="flex gap-2">
            {[3, 5, 7, 14].map((n) => (
              <button key={n} onClick={() => setCadence(n)} aria-pressed={data.cadenceDays === n} className="flex-1 py-2.5 rounded-lg text-sm font-medium"
                style={data.cadenceDays === n ? { background: C.accent, color: '#fff' } : { background: C.paper, color: C.ink, border: `1px solid ${C.rule}` }}>
                {n}d
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-xl p-4" style={{ background: C.card, border: `1px solid ${C.rule}` }}>
          <Eyebrow>Add a behavior</Eyebrow>
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={2}
            placeholder="Write it the way you'd say it on the floor"
            aria-label="New behavior"
            className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none mb-3"
            style={{ background: C.paper, border: `1px solid ${C.rule}` }} />
          <div className="flex flex-wrap gap-1.5 mb-3">
            {PHASES.map((p) => (
              <button key={p} onClick={() => setPhase(p)} aria-pressed={phase === p} className="px-3 py-1.5 rounded-full text-xs font-medium"
                style={phase === p ? { background: C.ink, color: '#fff' } : { background: C.paper, color: C.sub, border: `1px solid ${C.rule}` }}>
                {p}
              </button>
            ))}
          </div>
          <button onClick={add} className="w-full py-2.5 rounded-lg text-sm font-semibold text-white" style={{ background: C.accent }}>Add to library</button>
        </div>

        {PHASES.filter((ph) => live.some((b) => b.phase === ph)).map((ph) => (
          <div key={ph}>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: ph === 'Compliance' ? C.overdue : C.faint }}>{ph}</div>
            <div className="space-y-1.5">
              {live.filter((b) => b.phase === ph).map((b) => (
                <div key={b.id} className="rounded-lg" style={{ background: C.card, border: `1px solid ${pendingDelete === b.id ? C.overdue : C.rule}`, opacity: b.on || pendingDelete === b.id ? 1 : 0.45 }}>
                  <div className="flex items-center gap-3 px-3 py-3">
                    <button onClick={() => toggle(b.id)} className="shrink-0 rounded" aria-label={b.on ? 'Remove from rotation' : 'Add to rotation'} aria-pressed={b.on}
                      style={{ width: 22, height: 22, background: b.on ? C.accent : 'transparent', border: `1.5px solid ${b.on ? C.accent : C.faint}` }}>
                      {b.on && <span aria-hidden className="block text-white text-sm leading-none" style={{ marginTop: 1 }}>✓</span>}
                    </button>
                    <span className="flex-1 text-sm leading-snug">{b.text}</span>
                    <button onClick={() => setPendingDelete(b.id)} aria-label={`Delete "${b.text}"`} style={{ color: C.faint }}><X size={16} /></button>
                  </div>
                  {pendingDelete === b.id && (
                    <div className="px-3 pb-3 -mt-1">
                      <p className="text-xs leading-snug mb-2" style={{ color: C.sub }}>
                        {usedIds.has(b.id)
                          ? 'Past observations scored this one, so it moves to Archived instead of being erased.'
                          : 'Delete this behavior? It has never been scored, so nothing is lost.'}
                      </p>
                      <div className="flex gap-2">
                        <button onClick={() => del(b.id)} className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white" style={{ background: C.overdue }}>
                          {usedIds.has(b.id) ? 'Archive' : 'Delete'}
                        </button>
                        <button onClick={() => setPendingDelete(null)} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: C.sub, border: `1px solid ${C.rule}` }}>Cancel</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {archived.length > 0 && (
          <div>
            <div className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: C.faint }}>Archived</div>
            <div className="space-y-1.5">
              {archived.map((b) => (
                <div key={b.id} className="flex items-center gap-3 px-3 py-3 rounded-lg" style={{ background: C.card, border: `1px solid ${C.rule}`, opacity: 0.6 }}>
                  <span className="flex-1 text-sm leading-snug">{b.text}</span>
                  <button onClick={() => restore(b.id)} className="flex items-center gap-1 text-xs font-medium" aria-label={`Restore "${b.text}"`} style={{ color: C.accent }}>
                    <RotateCcw size={14} /> Restore
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
