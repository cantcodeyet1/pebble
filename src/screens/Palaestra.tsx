import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { usePebbleStore } from '../store';
import { Bout, BoutHandle, Mode, Filter, TierFilter, TrainingStyle } from './Bout';

// ── helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ── icons ─────────────────────────────────────────────────────────────────────

const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);

export const DrillIcon = ({ size = 26, color = 'var(--gold)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
  </svg>
);

export const AgoraIcon = ({ size = 26, color = 'var(--gold-dim)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="21" x2="21" y2="21"/><line x1="3" y1="10" x2="21" y2="10"/>
    <polyline points="3 7 12 3 21 7"/>
    <line x1="5" y1="10" x2="5" y2="21"/><line x1="9" y1="10" x2="9" y2="21"/>
    <line x1="15" y1="10" x2="15" y2="21"/><line x1="19" y1="10" x2="19" y2="21"/>
  </svg>
);

const CheckMark = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill={filled ? 'var(--gold-bright)' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
  </svg>
);

// ── component ─────────────────────────────────────────────────────────────────

export const Palaestra = () => {
  const location = useLocation();
  const locState = (location.state ?? {}) as { mode?: Mode; step?: number; autoStart?: boolean; manualIds?: string[] };
  const { logoi } = usePebbleStore();
  const boutRef = useRef<BoutHandle>(null);

  // Panel state
  const [step, setStep]                       = useState(locState.step ?? 0);
  const [mode, setMode]                       = useState<Mode>(locState.mode ?? 'drill');
  const [filter, setFilter]                   = useState<Filter>((locState.manualIds?.length ?? 0) > 0 ? 'manual' : 'starred');
  const [tierFilter, setTierFilter]           = useState<TierFilter>('all');
  const [trainingStyle, setTrainingStyle]     = useState<TrainingStyle>('mixed');
  const [selectedRegisters, setSelectedRegisters] = useState<string[]>([]);
  const [manualSelection, setManualSelection]     = useState<Set<string>>(new Set(locState.manualIds ?? []));
  const [randomIds, setRandomIds]                 = useState<string[]>([]);

  // Live pool counts for panel UI
  const filteredByMode = useMemo(() => {
    let r = [...logoi];
    if (mode === 'drill') {
      const now = new Date();
      const due = r.filter(l => new Date(l.nextReviewDate) <= now);
      return due.length > 0 ? due : r;
    }
    if (filter === 'starred')  return r.filter(l => l.starred);
    if (filter === 'new')      return r.filter(l => l.masteryLevel === 0);
    if (filter === 'weak')     return r.filter(l => l.masteryLevel <= 2);
    if (filter === 'mild')     return r.filter(l => l.masteryLevel === 3);
    if (filter === 'strong')   return r.filter(l => l.masteryLevel >= 4);
    if (filter === 'register') return selectedRegisters.length > 0
      ? r.filter(l => selectedRegisters.includes(l.register.toLowerCase()))
      : r;
    if (filter === 'manual') return manualSelection.size > 0
      ? r.filter(l => manualSelection.has(l.id))
      : r;
    if (filter === 'random') return randomIds.length > 0
      ? r.filter(l => randomIds.includes(l.id))
      : r;
    return r;
  }, [logoi, mode, filter, selectedRegisters, manualSelection, randomIds]);

  const filteredByTier = useMemo(() => {
    if (tierFilter === 'word')   return filteredByMode.filter(l => l.tier === 'Word');
    if (tierFilter === 'phrase') return filteredByMode.filter(l => l.tier === 'Phrase');
    return filteredByMode;
  }, [filteredByMode, tierFilter]);

  // Re-roll random selection whenever the filter switches to 'random'
  useEffect(() => {
    if (filter === 'random') {
      setRandomIds(shuffle(logoi.map(l => l.id)).slice(0, 15));
    }
  }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const autoStarted = useRef(false);
  useEffect(() => {
    if (locState.autoStart && logoi.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      void boutRef.current?.startBout();
    }
  }, [logoi]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── navigation ────────────────────────────────────────────────────────────

  const palGo  = (s: number) => setStep(s);
  const p0Next = () => {
    if (mode === 'drill')   void boutRef.current?.startBout();
    else if (mode === 'enky') palGo(1);   // filter → tier → style → bout
    else                    palGo(4);     // askesis placeholder
  };

  // ── filter & style option definitions ────────────────────────────────────

  const filterOpts: { id: Filter; icon: React.ReactNode; name: string; sub: string; count: number }[] = [
    {
      id: 'starred', name: 'Starred Words',
      sub: `${logoi.filter(l => l.starred).length} logoi starred`,
      count: logoi.filter(l => l.starred).length,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--gold)" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    },
    {
      id: 'new', name: 'New',
      sub: `Untrained · ${logoi.filter(l => l.masteryLevel === 0).length} logoi`,
      count: logoi.filter(l => l.masteryLevel === 0).length,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
    },
    {
      id: 'weak', name: 'Weakly Known',
      sub: `Mastery 0–2 · ${logoi.filter(l => l.masteryLevel <= 2).length} logoi`,
      count: logoi.filter(l => l.masteryLevel <= 2).length,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
    },
    {
      id: 'mild', name: 'Mildly Known',
      sub: `Mastery 3 · ${logoi.filter(l => l.masteryLevel === 3).length} logoi`,
      count: logoi.filter(l => l.masteryLevel === 3).length,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    },
    {
      id: 'strong', name: 'Strong Knowledge',
      sub: `Mastery 4–5 · ${logoi.filter(l => l.masteryLevel >= 4).length} logoi`,
      count: logoi.filter(l => l.masteryLevel >= 4).length,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    {
      id: 'register', name: 'By Register',
      sub: 'Academic · Literary · Formal…',
      count: logoi.length,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
    },
    {
      id: 'random', name: 'Random',
      sub: `Surprise selection · 15 logoi`,
      count: logoi.length,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="4"/><circle cx="8" cy="8" r="1.2" fill="var(--gold-dim)"/><circle cx="16" cy="8" r="1.2" fill="var(--gold-dim)"/><circle cx="8" cy="16" r="1.2" fill="var(--gold-dim)"/><circle cx="16" cy="16" r="1.2" fill="var(--gold-dim)"/><circle cx="12" cy="12" r="1.2" fill="var(--gold-dim)"/></svg>,
    },
  ];

  const styleOpts: { id: TrainingStyle; icon: React.ReactNode; name: string; desc: string }[] = [
    {
      id: 'mixed', name: 'Mixed',
      desc: "Algorithm adapts the style to each word's mastery level",
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    },
    {
      id: 'blank', name: 'Fill in the Blank',
      desc: 'Complete the sentence with the missing word or phrase',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
    },
    {
      id: 'synonym', name: 'Find the Synonym',
      desc: 'Match words by meaning, register and semantic weight',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>,
    },
    {
      id: 'usage', name: 'Correct Usage',
      desc: 'Identify which sentence deploys the word correctly',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
    },
    {
      id: 'write', name: 'Write a Sentence',
      desc: 'Produce your own sentence — self-assess your usage',
      icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
    },
  ];

  // ── tier type cards data ──────────────────────────────────────────────────

  const tierCards: { id: TierFilter; badge?: 'tb-word' | 'tb-phrase'; label: string; sub: string; count: number; color?: string }[] = [
    { id: 'all',    label: 'All Logoi',  sub: 'Words and phrases mixed',                            count: filteredByMode.length },
    { id: 'word',   label: 'Words only', sub: 'Single lexical items · synonym, fill-in-blank, usage', count: filteredByMode.filter(l => l.tier === 'Word').length,   badge: 'tb-word',   color: '#60a5fa' },
    { id: 'phrase', label: 'Phrases',    sub: 'Idioms, collocations · register & context',            count: filteredByMode.filter(l => l.tier === 'Phrase').length, badge: 'tb-phrase', color: '#c4a5e8' },
  ];

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div className="pal-outer">

        {/* ── SLIDER ── */}
        <div className="pal-slider" style={{ transform: `translateX(-${step * 20}%)` }}>

          {/* PANEL 0 — Mode Select */}
          <div className="pal-panel">
            <div className="pal-top">
              <div className="pal-step-title">
                <div className="screen-title">Palaestra</div>
                <div className="screen-sub">The Wrestling Ground</div>
              </div>
            </div>

            <div className={`mode-card${mode === 'drill' ? ' sel' : ''}`} onClick={() => setMode('drill')}>
              <div className="mc-icon"><DrillIcon size={26} color={mode === 'drill' ? 'var(--gold)' : 'var(--gold-dim)'} /></div>
              <div className="mc-body">
                <div className="mc-name">Agon</div>
                <div className="mc-desc">Your daily spaced repetition session. The algorithm decides what's due — new words, forgotten words, and everything in between.</div>
                <div className="mc-badges">
                  <span className="mc-badge">{logoi.filter(l => new Date(l.nextReviewDate) <= new Date()).length} due today</span>
                  <span className="mc-badge green">{logoi.length} total</span>
                </div>
              </div>
            </div>

            <div className={`mode-card${mode === 'askesis' ? ' sel' : ''}`} onClick={() => setMode('askesis')}>
              <div className="mc-icon"><AgoraIcon size={26} color={mode === 'askesis' ? 'var(--gold)' : 'var(--gold-dim)'} /></div>
              <div className="mc-body">
                <div className="mc-name">Askesis</div>
                <div className="mc-desc">Free practice on your own terms. Filter by starred words, mastery level, or register. You pick the logoi, you set the pace.</div>
                <div className="mc-badges">
                  <span className="mc-badge">{logoi.length} logoi available</span>
                </div>
              </div>
            </div>

            <div className={`mode-card${mode === 'enky' ? ' sel' : ''}`} onClick={() => setMode('enky')}>
              <div className="mc-icon"><AgoraIcon size={26} color={mode === 'enky' ? 'var(--gold)' : 'var(--gold-dim)'} /></div>
              <div className="mc-body">
                <div className="mc-name">Enky</div>
                <div className="mc-desc">Free practice on your own terms. Filter by starred words, mastery level, or register. You pick the logoi, you set the pace.</div>
                <div className="mc-badges">
                  <span className="mc-badge">{logoi.length} logoi available</span>
                </div>
              </div>
            </div>

            <button className="pal-enter-btn" onClick={p0Next} disabled={logoi.length === 0}
              style={logoi.length === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>
              {logoi.length === 0 ? 'Add logoi to begin' : mode === 'drill' ? 'Enter the Palaestra →' : mode === 'enky' ? 'Choose Your Logoi →' : 'Enter Askesis →'}
            </button>
          </div>

          {/* PANEL 1 — Agora Filters */}
          <div className="pal-panel">
            <div className="pal-top">
              <button className="pal-back" onClick={() => palGo(0)}><ChevronLeft /></button>
              <div className="pal-step-title">
                <div className="screen-title" style={{ fontSize: 26 }}>Enky</div>
                <div className="screen-sub">Choose your filter</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filterOpts.map(f => {
                const disabled = f.count === 0;
                return (
                  <div
                    key={f.id}
                    className={`filter-row-item${filter === f.id ? ' sel' : ''}`}
                    onClick={disabled ? undefined : () => setFilter(f.id)}
                    style={disabled ? { opacity: 0.3, cursor: 'default', pointerEvents: 'none' } : undefined}
                  >
                    <div className="fri-icon">{f.icon}</div>
                    <div className="fri-body">
                      <div className="fri-name">{f.name}</div>
                      <div className="fri-sub">{f.sub}</div>
                    </div>
                    <div className="fri-check">{filter === f.id && <CheckMark />}</div>
                  </div>
                );
              })}
            </div>

            {filter === 'register' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="section-label" style={{ marginBottom: 0 }}>Select registers</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {['Academic', 'Literary', 'Formal', 'Informal', 'Idiomatic'].map(r => {
                    const active = selectedRegisters.includes(r.toLowerCase());
                    return (
                      <button
                        key={r}
                        className={`f-chip${active ? ' active' : ''}`}
                        onClick={() => setSelectedRegisters(prev =>
                          active ? prev.filter(x => x !== r.toLowerCase()) : [...prev, r.toLowerCase()]
                        )}
                      >
                        {r}
                      </button>
                    );
                  })}
                </div>
                {selectedRegisters.length > 0 && (
                  <div style={{ fontSize: 11, color: 'var(--text-dim)' }}>
                    {filteredByMode.length} logoi match
                  </div>
                )}
              </div>
            )}

            {filter === 'random' && randomIds.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{randomIds.length} logoi selected</span>
                <button
                  className="f-chip active"
                  onClick={() => setRandomIds(shuffle(logoi.map(l => l.id)).slice(0, 15))}
                >
                  Re-roll
                </button>
              </div>
            )}

            <button className="pal-enter-btn" onClick={() => palGo(2)}>Next →</button>
          </div>

          {/* PANEL 2 — Logos Type */}
          <div className="pal-panel">
            <div className="pal-top">
              <button className="pal-back" onClick={() => palGo(1)}><ChevronLeft /></button>
              <div className="pal-step-title">
                <div className="screen-title" style={{ fontSize: 26 }}>Logos Type</div>
                <div className="screen-sub">What will you wrestle with?</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tierCards.map(t => {
                const disabled = t.count === 0;
                return (
                <div key={t.id} className={`tier-type-card${tierFilter === t.id ? ' sel' : ''}`}
                  onClick={disabled ? undefined : () => setTierFilter(t.id)}
                  style={disabled ? { opacity: 0.3, cursor: 'default', pointerEvents: 'none' } : undefined}
                >
                  <div className="ttc-header">
                    <div>
                      {t.badge && <span className={`tier-badge ${t.badge}`} style={{ marginBottom: 6, display: 'inline-block' }}>{t.id === 'word' ? 'Word' : 'Phrase'}</span>}
                      <div className="ttc-name">{t.label}</div>
                      <div className="ttc-sub">{t.sub}</div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div className="ttc-count" style={t.color ? { color: t.color } : undefined}>{t.count}</div>
                      <div className="ttc-check">{tierFilter === t.id && <CheckMark />}</div>
                    </div>
                  </div>
                </div>
                );
              })}
            </div>

            <button className="pal-enter-btn" onClick={() => palGo(3)}>Next →</button>
          </div>

          {/* PANEL 3 — Training Style */}
          <div className="pal-panel">
            <div className="pal-top">
              <button className="pal-back" onClick={() => palGo(2)}><ChevronLeft /></button>
              <div className="pal-step-title">
                <div className="screen-title" style={{ fontSize: 26 }}>Training Style</div>
                <div className="screen-sub">How will you wrestle?</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {styleOpts.map(s => (
                <div key={s.id} className={`style-card${trainingStyle === s.id ? ' sel' : ''}`} onClick={() => setTrainingStyle(s.id)}>
                  <div className="sc-icon-s">{s.icon}</div>
                  <div className="sc-body-s">
                    <div className="sc-name-s">{s.name}</div>
                    <div className="sc-desc-s">{s.desc}</div>
                  </div>
                  <div className="sc-check-s">{trainingStyle === s.id && <CheckMark />}</div>
                </div>
              ))}
            </div>

            <button className="pal-enter-btn" onClick={() => void boutRef.current?.startBout()}>Enter the Palaestra →</button>
          </div>

          {/* PANEL 4 — Askesis placeholder */}
          <div className="pal-panel">
            <div className="pal-top">
              <button className="pal-back" onClick={() => palGo(0)}><ChevronLeft /></button>
              <div className="pal-step-title">
                <div className="screen-title" style={{ fontSize: 26 }}>Askesis</div>
                <div className="screen-sub">Free Practice</div>
              </div>
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, opacity: 0.5 }}>
              <AgoraIcon size={48} color="var(--gold-dim)" />
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, color: 'var(--text-dim)', textAlign: 'center' }}>Coming soon</div>
            </div>
          </div>
        </div>

        {/*{/* ── THE BOUT ── */}
        <Bout
          ref={boutRef}
          mode={mode}
          filter={filter}
          tierFilter={tierFilter}
          trainingStyle={trainingStyle}
          selectedRegisters={selectedRegisters}
          manualSelection={manualSelection}
          randomIds={randomIds}
          onExit={setStep}
        />
      </div>
    </div>
  );
};
