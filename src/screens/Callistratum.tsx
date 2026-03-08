import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePebbleStore, Logos, Tier, Register } from '../store';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { updateLogos, deleteLogos, enrichLogos } from '../db/logoi';
import { classify, ClassifyResult } from '../services/ai.service';

function toSentenceCase(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function masteryClass(level: number): string {
  if (level === 0) return '';
  if (level === 1) return 'ml';
  if (level === 2) return 'mfg';
  if (level === 3) return 'mf';
  return 'mm'; // 4 or 5
}

function tierClass(tier: Tier | ''): string {
  if (tier === 'Word') return 'tb-word';
  if (tier === 'Phrase') return 'tb-phrase';
  return '';
}

function cap(s: string): string {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

const TIERS: Tier[] = ['Word', 'Phrase'];
const REGISTERS: Register[] = ['Formal', 'Academic', 'Literary', 'Informal', 'Idiomatic'];

export const Callistratum = () => {
  const { logoi, removeLogos, setLogoi } = usePebbleStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<Tier | 'All'>('All');
  const [selectedLogos, setSelectedLogos] = useState<Logos | null>(null);

  const [starred, setStarred]           = useState<Set<string>>(new Set());
  const [confirmLogos, setConfirmLogos] = useState<Logos | null>(null);
  const [swipingId, setSwipingId]       = useState<string | null>(null);
  const [swipeX, setSwipeX]             = useState(0);
  const swipeStartX  = useRef(0);
  const swipeMoved   = useRef(false);
  const THRESHOLD    = 80;
  const LEFT_THRESH  = -60;
  const starredInitialized = useRef(false);

  // Enrichment state
  const [classifyingId, setClassifyingId] = useState<string | null>(null);
  const [enrichResult, setEnrichResult]   = useState<{ logos: Logos; result: ClassifyResult } | null>(null);
  const [editTier, setEditTier]           = useState<string>('');
  const [editRegister, setEditRegister]   = useState<string>('');
  const [editDef, setEditDef]             = useState('');

  // --- Classify on left swipe ---
  const doClassify = useCallback(async (logos: Logos) => {
    setClassifyingId(logos.id);
    try {
      const result = await classify(logos.text, logos.contextSentence);
      setEditTier(result.tier);
      setEditRegister(result.register);
      setEditDef(result.definition);
      setEnrichResult({ logos, result });
    } catch (err) {
      console.error('[Pebble] classify failed:', err);
    } finally {
      setClassifyingId(null);
    }
  }, []);

  const startSwipe = useCallback((id: string, x: number) => {
    setSwipingId(id);
    swipeStartX.current = x;
    swipeMoved.current = false;
  }, []);

  const moveSwipe = useCallback((x: number) => {
    setSwipeX(() => {
      const delta = x - swipeStartX.current;
      if (Math.abs(delta) > 5) swipeMoved.current = true;
      // Right swipe → delete reveal; left swipe → classify reveal
      return Math.max(-80, Math.min(delta, 130));
    });
  }, []);

  const endSwipe = useCallback((logos: Logos) => {
    setSwipingId(null);
    setSwipeX(curr => {
      if (curr >= THRESHOLD) {
        setTimeout(() => setConfirmLogos(logos), 0);
      } else if (curr <= LEFT_THRESH) {
        setTimeout(() => doClassify(logos), 0);
      }
      return 0;
    });
  }, [THRESHOLD, LEFT_THRESH, doClassify]);

  // --- Confirm enrichment ---
  const confirmEnrich = useCallback(async () => {
    if (!enrichResult) return;
    const { logos, result } = enrichResult;
    const tier     = editTier.toLowerCase();
    const register = editRegister.toLowerCase();
    try {
      await enrichLogos(logos.id, {
        tier, definition: editDef, example: result.sentence,
        register, phonetic: result.phonetic, pos: result.pos, synonyms: result.synonyms,
      });
      setLogoi(logoi.map(l => l.id !== logos.id ? l : {
        ...l,
        tier:            cap(tier) as Tier,
        definition:      editDef,
        exampleSentence: result.sentence,
        register:        cap(register) as Register,
        phonetic:        result.phonetic,
        pos:             result.pos,
        synonyms:        result.synonyms,
        enriched:        true,
      }));
    } catch (err) {
      console.error('[Pebble] enrichLogos failed:', err);
    }
    setEnrichResult(null);
  }, [enrichResult, editTier, editRegister, editDef, logoi, setLogoi]);

  // Sync starred from store once logoi is first populated
  useEffect(() => {
    if (!starredInitialized.current && logoi.length > 0) {
      starredInitialized.current = true;
      setStarred(new Set(logoi.filter(l => l.starred).map(l => l.id)));
    }
  }, [logoi]);

  const filteredLogoi = logoi
    .filter(l => {
      const matchesSearch = l.text.toLowerCase().includes(search.toLowerCase());
      const matchesTier = selectedTier === 'All' || l.tier === selectedTier;
      return matchesSearch && matchesTier;
    })
    .sort((a, b) => new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime());

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      const nowStarred = !next.has(id);
      if (nowStarred) next.add(id); else next.delete(id);
      updateLogos(id, { starred: nowStarred }).catch(() => {/* silent */});
      return next;
    });
  };

  const chips: (Tier | 'All')[] = ['All', 'Word', 'Phrase'];

  return (
    <>
      {/* Gold pulse keyframe — injected once */}
      <style>{`
        @keyframes goldPulse {
          0%, 100% { border-color: rgba(212,160,23,.3); box-shadow: none; }
          50%       { border-color: rgba(212,160,23,.85); box-shadow: 0 0 14px rgba(212,160,23,.18); }
        }
      `}</style>

      <div>
        <div className="screen-title">Callistratum</div>
        <div className="screen-sub">The Great Library</div>
      </div>

      {/* Search */}
      <div className="search-bar">
        <span style={{ color: 'var(--text-dim)', fontSize: 15 }}>⌕</span>
        <input
          className="search-input"
          placeholder="Search your logoi…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8 }}>
        {chips.map(t => (
          <button
            key={t}
            className={`f-chip${selectedTier === t ? ' active' : ''}`}
            onClick={() => { if (logoi.length > 0) setSelectedTier(t); }}
            disabled={logoi.length === 0}
            style={logoi.length === 0 ? { opacity: 0.3, cursor: 'default', pointerEvents: 'none' } : undefined}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Logos list */}
      <div className="logos-list">
        {filteredLogoi.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 20px 32px', gap: 18 }}>
            <svg width="52" height="52" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ opacity: 0.3 }}>
              <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76Z" stroke="rgba(212,160,23,0.9)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M16 8L2 22" stroke="rgba(212,160,23,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M17.5 15H9" stroke="rgba(212,160,23,0.5)" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 22, fontWeight: 600, fontStyle: 'italic', color: 'var(--gold-bright)', opacity: 0.75 }}>
                {logoi.length === 0 ? 'The library awaits' : 'No logoi found'}
              </div>
              {logoi.length === 0 ? (
                <>
                  <div style={{ fontSize: 12, color: 'var(--text-dim)', fontStyle: 'italic', lineHeight: 1.7, borderLeft: '2px solid rgba(212,160,23,0.25)', paddingLeft: 12, textAlign: 'left' }}>
                    "As a vessel is known by the sound, whether it be cracked or not — so men are proved by their words."
                  </div>
                  <div style={{ fontSize: 10, letterSpacing: '0.16em', color: 'var(--gold-dim)', textTransform: 'uppercase' }}>— Demosthenes</div>
                  <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-dim)', textTransform: 'uppercase', marginTop: 4 }}>
                    Tap <span style={{ color: 'var(--gold)', fontWeight: 600 }}>+</span> to inscribe your first logos
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 11, letterSpacing: '0.12em', color: 'var(--text-dim)', textTransform: 'uppercase' }}>
                  Try a different search or filter
                </div>
              )}
            </div>
          </div>
        )}

        {filteredLogoi.map(logos => {
          const isSwiping      = swipingId === logos.id;
          const dx             = isSwiping ? swipeX : 0;
          const isPending      = logos.enriched === false;
          const isClassifying  = classifyingId === logos.id;
          const rightReveal    = Math.min(Math.max(dx / THRESHOLD, 0), 1);   // delete
          const leftReveal     = Math.min(Math.max(-dx / 60, 0), 1);         // classify

          return (
            <div key={logos.id} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>

              {/* Right swipe → delete reveal (left side) */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 14,
                background: `rgba(239,68,68,${0.08 + rightReveal * 0.1})`,
                border: `1px solid rgba(239,68,68,${rightReveal * 0.3})`,
                display: 'flex', alignItems: 'center', paddingLeft: 18, gap: 8,
                opacity: rightReveal,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
                <span style={{ color: '#f87171', fontSize: 13, fontWeight: 500 }}>Delete</span>
              </div>

              {/* Left swipe → classify reveal (right side) */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 14,
                background: `rgba(212,160,23,${0.05 + leftReveal * 0.08})`,
                border: `1px solid rgba(212,160,23,${leftReveal * 0.35})`,
                display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
                paddingRight: 18, gap: 7, opacity: leftReveal,
              }}>
                <span style={{ color: 'var(--gold-bright)', fontSize: 13, fontWeight: 500 }}>
                  {isPending ? 'Classify' : 'Re-classify'}
                </span>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--gold-bright)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2l1.5 4.5H18l-3.75 2.7 1.5 4.5L12 11.1l-3.75 2.6 1.5-4.5L6 6.5h4.5z"/>
                  <path d="M5 19l2-2"/><path d="M19 19l-2-2"/><path d="M12 22v-3"/>
                </svg>
              </div>

              {/* Gold pulse border while classifying */}
              {isClassifying && (
                <div style={{
                  position: 'absolute', inset: 0, borderRadius: 14, pointerEvents: 'none',
                  border: '1.5px solid rgba(212,160,23,.3)',
                  animation: 'goldPulse 1.1s ease-in-out infinite',
                  zIndex: 2,
                }} />
              )}

              {/* Logos item */}
              <div
                className={`logos-item ${masteryClass(logos.masteryLevel)}`}
                style={{
                  transform: `translateX(${dx}px)`,
                  transition: isSwiping ? 'none' : 'transform 0.25s ease',
                  touchAction: 'pan-y',
                  opacity: isPending && !isClassifying ? 0.6 : 1,
                }}
                onClick={() => { if (!swipeMoved.current) setSelectedLogos(logos); }}
                onTouchStart={e => startSwipe(logos.id, e.touches[0].clientX)}
                onTouchMove={e => moveSwipe(e.touches[0].clientX)}
                onTouchEnd={() => endSwipe(logos)}
                onMouseDown={e => startSwipe(logos.id, e.clientX)}
                onMouseMove={e => { if (isSwiping) moveSwipe(e.clientX); }}
                onMouseUp={() => endSwipe(logos)}
                onMouseLeave={() => { if (isSwiping) { setSwipingId(null); setSwipeX(0); } }}
              >
                <div style={{ flex: 1 }}>
                  <div className="li-name">
                    {toSentenceCase(logos.text)}
                    {logos.tier ? (
                      <span className={`tier-badge ${tierClass(logos.tier)}`} style={{ fontSize: 8 }}>{logos.tier}</span>
                    ) : null}
                    {isPending && (
                      <span style={{
                        fontSize: 8, padding: '2px 6px', borderRadius: 8, lineHeight: 1,
                        background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.28)',
                        color: '#fbbf24', fontFamily: "'DM Sans', sans-serif",
                        letterSpacing: '.07em', fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center',
                      }}>
                        PENDING
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {logos.register
                      ? <span className="reg-lbl">{logos.register}</span>
                      : <span className="reg-lbl" style={{ color: 'rgba(255,255,255,.2)', fontStyle: 'italic' }}>unclassified</span>
                    }
                    <div className="mdots">
                      {[...Array(5)].map((_, i) => (
                        <div key={i} className={`mdot${i < logos.masteryLevel ? ' f' : ''}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <button
                  className={`star-btn${starred.has(logos.id) ? ' starred' : ''}`}
                  onClick={e => toggleStar(e, logos.id)}
                >★</button>
                <div className="chevron">›</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Delete confirm */}
      {confirmLogos && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 300, padding: '0 24px' }}
          onClick={() => setConfirmLogos(null)}
        >
          <div
            style={{ background: 'var(--glass)', backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)', border: '1px solid var(--glass-border)', borderRadius: 20, padding: '28px 24px', width: '100%', maxWidth: 340 }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 24, fontWeight: 600, fontStyle: 'italic', color: 'var(--text)', marginBottom: 4 }}>
              {toSentenceCase(confirmLogos.text)}
            </div>
            <div style={{ fontSize: 11, letterSpacing: '.12em', textTransform: 'uppercase', color: 'var(--gold-dim)', marginBottom: 16 }}>
              Remove from library
            </div>
            <div style={{ width: '100%', height: 1, background: 'var(--glass-border)', marginBottom: 16 }} />
            <div style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.7, marginBottom: 24 }}>
              This logos and all its training progress will be permanently deleted.
            </div>
            <button
              onClick={() => { deleteLogos(confirmLogos.id).catch(() => {}); removeLogos(confirmLogos.id); setConfirmLogos(null); }}
              style={{ width: '100%', background: 'rgba(248,113,113,.1)', border: '1px solid rgba(248,113,113,.2)', borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 600, color: '#f87171', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 8 }}
            >
              Delete
            </button>
            <button
              onClick={() => setConfirmLogos(null)}
              style={{ width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)', borderRadius: 12, padding: '13px', fontSize: 14, color: 'var(--text-mid)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedLogos && (
        <div className="det-ov" onClick={e => { if (e.target === e.currentTarget) setSelectedLogos(null); }}>
          <div className="det-card">
            <button className="dc-x" onClick={() => setSelectedLogos(null)}>✕</button>
            <div className="dc-top">Logos Detail</div>
            <div className="dc-word">{toSentenceCase(selectedLogos.text)}</div>

            {(selectedLogos.phonetic || selectedLogos.pos) && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                {selectedLogos.phonetic && <span className="lotd-sub">{selectedLogos.phonetic}</span>}
                {selectedLogos.pos && <span className="lotd-pos">{selectedLogos.pos}</span>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              {selectedLogos.tier && <span className={`tier-badge ${tierClass(selectedLogos.tier)}`}>{selectedLogos.tier}</span>}
              {selectedLogos.register && <span className="reg-lbl" style={{ display: 'flex', alignItems: 'center' }}>{selectedLogos.register}</span>}
              {selectedLogos.enriched === false && (
                <span style={{
                  fontSize: 9, padding: '3px 8px', borderRadius: 8,
                  background: 'rgba(251,191,36,.1)', border: '1px solid rgba(251,191,36,.28)',
                  color: '#fbbf24', fontFamily: "'DM Sans', sans-serif", fontWeight: 700, letterSpacing: '.07em',
                }}>PENDING</span>
              )}
            </div>

            {selectedLogos.definition ? (
              <div className="dc-sec">
                <div className="dc-sh">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                  </svg>
                  Definition
                </div>
                <div className="dc-st">"{selectedLogos.definition}"</div>
              </div>
            ) : (
              <div className="dc-sec">
                <div className="dc-st" style={{ fontStyle: 'italic', color: 'var(--text-dim)' }}>
                  Swipe left on this word in the library to classify it.
                </div>
              </div>
            )}

            {selectedLogos.exampleSentence && (
              <div className="dc-sec">
                <div className="dc-sh">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1z"/>
                    <path d="M15 21c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/>
                  </svg>
                  Example Usage
                </div>
                <div className="dc-st">{selectedLogos.exampleSentence}</div>
              </div>
            )}

            {selectedLogos.synonyms && selectedLogos.synonyms.length > 0 && (
              <div className="dc-sec">
                <div className="dc-sh">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 6H5a2 2 0 00-2 2v9a2 2 0 002 2h3"/><path d="M16 6h3a2 2 0 012 2v9a2 2 0 01-2 2h-3"/>
                    <line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                  Synonyms
                </div>
                <div className="syn-row" style={{ marginTop: 0 }}>
                  {selectedLogos.synonyms.map(s => <span className="syn-chip" key={s}>{s}</span>)}
                </div>
              </div>
            )}

            {selectedLogos.contextSentence && (
              <div className="dc-sec">
                <div className="dc-sh">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                  </svg>
                  Context
                </div>
                <div className="dc-st" style={{ fontStyle: 'italic' }}>{selectedLogos.contextSentence}</div>
              </div>
            )}

            {selectedLogos.source && (
              <div className="dc-sec">
                <div className="dc-sh">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                  </svg>
                  Source
                </div>
                <div className="dc-st">{selectedLogos.source}</div>
              </div>
            )}

            <hr className="dc-div" />

            <div className="dc-bot">
              <div>
                <div className="dc-ml">Mastery Level</div>
                <div className="dc-mdots">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className={`dc-md${i < selectedLogos.masteryLevel ? ' f' : ''}`} />
                  ))}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="dc-nl">Next Review</div>
                <div className="dc-nd">{format(selectedLogos.nextReviewDate, 'MMM d, yyyy')}</div>
              </div>
            </div>

            <button
              className="dc-train-btn"
              onClick={() => {
                const id = selectedLogos.id;
                setSelectedLogos(null);
                navigate('/palaestra', { state: { mode: 'agora', step: 3, manualIds: [id] } });
              }}
            >
              Train this Logos →
            </button>
          </div>
        </div>
      )}

      {/* Enrichment preview sheet */}
      {enrichResult && (
        <div
          className="add-backdrop open"
          style={{ zIndex: 250 }}
          onClick={() => setEnrichResult(null)}
        >
          <div className="add-sheet" onClick={e => e.stopPropagation()}>
            <div className="sheet-handle" />

            <div className="add-hdr">
              <button className="add-cls" onClick={() => setEnrichResult(null)}>✕</button>
              <div className="add-ttl">AI Classification</div>
              <button className="add-sv" onClick={() => { void confirmEnrich(); }}>Confirm</button>
            </div>

            {/* Word */}
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 26, fontStyle: 'italic', color: 'var(--text)', marginBottom: 6 }}>
              {toSentenceCase(enrichResult.logos.text)}
            </div>

            {/* Phonetic + POS */}
            {(enrichResult.result.phonetic || enrichResult.result.pos) && (
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                {enrichResult.result.phonetic && <span className="lotd-sub">{enrichResult.result.phonetic}</span>}
                {enrichResult.result.pos && <span className="lotd-pos">{enrichResult.result.pos}</span>}
              </div>
            )}

            {/* Tier selector */}
            <div className="field-lbl" style={{ marginBottom: 6 }}>Tier</div>
            <div className="ai-tr" style={{ marginBottom: 16 }}>
              {TIERS.map(t => (
                <button
                  key={t}
                  className={`ai-to${editTier === t ? ' sel' : ''}`}
                  onClick={() => setEditTier(t)}
                >
                  {t}
                </button>
              ))}
            </div>

            {/* Register selector */}
            <div className="field-lbl" style={{ marginBottom: 6 }}>Register</div>
            <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
              {REGISTERS.map(r => (
                <button
                  key={r}
                  className={`reg-opt${editRegister === r ? ' active' : ''}`}
                  onClick={() => setEditRegister(r)}
                >
                  {r}
                </button>
              ))}
            </div>

            {/* Definition (editable) */}
            <div className="field-lbl" style={{ marginBottom: 6 }}>Definition</div>
            <textarea
              className="src-txt"
              value={editDef}
              onChange={e => setEditDef(e.target.value)}
              style={{ marginBottom: 12 }}
            />

            {/* Synonyms */}
            {enrichResult.result.synonyms?.length > 0 && (
              <div className="syn-row" style={{ marginBottom: 20 }}>
                {enrichResult.result.synonyms.map(s => (
                  <span className="syn-chip" key={s}>{s}</span>
                ))}
              </div>
            )}

            {/* Actions */}
            <button
              onClick={() => { void confirmEnrich(); }}
              style={{
                width: '100%', background: 'rgba(212,160,23,.12)', border: '1px solid rgba(212,160,23,.3)',
                borderRadius: 12, padding: '13px', fontSize: 14, fontWeight: 600,
                color: 'var(--gold-bright)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", marginBottom: 8,
              }}
            >
              Confirm Classification
            </button>
            <button
              onClick={() => setEnrichResult(null)}
              style={{
                width: '100%', background: 'rgba(255,255,255,.04)', border: '1px solid var(--glass-border)',
                borderRadius: 12, padding: '13px', fontSize: 14, color: 'var(--text-mid)',
                cursor: 'pointer', fontFamily: "'DM Sans', sans-serif",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </>
  );
};
