import React, { useState, useEffect, useRef, useCallback } from 'react';
import { usePebbleStore, Logos, Tier } from '../store';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { updateLogos, deleteLogos } from '../db/logoi';

function masteryClass(level: number): string {
  if (level === 0) return '';
  if (level === 1) return 'ml';
  if (level === 2) return 'mfg';
  if (level === 3) return 'mf';
  return 'mm'; // 4 or 5
}

function tierClass(tier: Tier): string {
  if (tier === 'Word') return 'tb-word';
  return 'tb-phrase';
}

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export const Callistratum = () => {
  const { logoi, removeLogos } = usePebbleStore();
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
  const starredInitialized = useRef(false);

  const startSwipe = useCallback((id: string, x: number) => {
    setSwipingId(id);
    swipeStartX.current = x;
    swipeMoved.current = false;
  }, []);

  const moveSwipe = useCallback((x: number) => {
    setSwipeX(prev => {
      const delta = x - swipeStartX.current;
      if (delta > 5) swipeMoved.current = true;
      return Math.max(0, Math.min(delta, 130));
    });
  }, []);

  const endSwipe = useCallback((logos: Logos) => {
    setSwipingId(null);
    setSwipeX(curr => {
      if (curr >= THRESHOLD) setConfirmLogos(logos);
      return 0;
    });
  }, [THRESHOLD]);

  // Sync starred from store once logoi is first populated (handles async DB load on startup)
  useEffect(() => {
    if (!starredInitialized.current && logoi.length > 0) {
      starredInitialized.current = true;
      setStarred(new Set(logoi.filter(l => l.starred).map(l => l.id)));
    }
  }, [logoi]);

  const filteredLogoi = logoi.filter(l => {
    const matchesSearch = l.text.toLowerCase().includes(search.toLowerCase());
    const matchesTier = selectedTier === 'All' || l.tier === selectedTier;
    return matchesSearch && matchesTier;
  });

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
          const isSwiping = swipingId === logos.id;
          const dx = isSwiping ? swipeX : 0;
          const revealOpacity = Math.min(dx / THRESHOLD, 1);
          return (
            <div key={logos.id} style={{ position: 'relative', borderRadius: 14, overflow: 'hidden' }}>
              {/* Delete reveal panel */}
              <div style={{
                position: 'absolute', inset: 0, borderRadius: 14,
                background: `rgba(239,68,68,${0.08 + revealOpacity * 0.1})`,
                border: `1px solid rgba(239,68,68,${revealOpacity * 0.3})`,
                display: 'flex', alignItems: 'center', paddingLeft: 18, gap: 8,
                opacity: revealOpacity,
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
                </svg>
                <span style={{ color: '#f87171', fontSize: 13, fontWeight: 500 }}>Delete</span>
              </div>

              {/* Logos item */}
              <div
                className={`logos-item ${masteryClass(logos.masteryLevel)}`}
                style={{
                  transform: `translateX(${dx}px)`,
                  transition: isSwiping ? 'none' : 'transform 0.25s ease',
                  touchAction: 'pan-y',
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
                    {logos.text}
                    <span className={`tier-badge ${tierClass(logos.tier)}`} style={{ fontSize: 8 }}>{logos.tier}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span className="reg-lbl">{logos.register}</span>
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

      {/* Detail Modal */}
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
              {confirmLogos.text}
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

      {selectedLogos && (
        <div className="det-ov" onClick={e => { if (e.target === e.currentTarget) setSelectedLogos(null); }}>
          <div className="det-card">
            <button className="dc-x" onClick={() => setSelectedLogos(null)}>✕</button>
            <div className="dc-top">Logos Detail</div>
            <div className="dc-word">{selectedLogos.text}</div>

            {(selectedLogos.phonetic || selectedLogos.pos) && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                {selectedLogos.phonetic && <span className="lotd-sub">{selectedLogos.phonetic}</span>}
                {selectedLogos.pos && <span className="lotd-pos">{selectedLogos.pos}</span>}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`tier-badge ${tierClass(selectedLogos.tier)}`}>{selectedLogos.tier}</span>
              <span className="reg-lbl" style={{ display: 'flex', alignItems: 'center' }}>{selectedLogos.register}</span>
            </div>

            <div className="dc-sec">
              <div className="dc-sh">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z"/><path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z"/>
                </svg>
                Definition
              </div>
              <div className="dc-st">"{selectedLogos.definition}"</div>
            </div>

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

            {selectedLogos.sourceSentence && (
              <div className="dc-sec">
                <div className="dc-sh">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/>
                  </svg>
                  Source
                </div>
                <div className="dc-st">{selectedLogos.sourceSentence}</div>
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
    </>
  );
};
