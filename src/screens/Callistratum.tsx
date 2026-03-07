import React, { useState } from 'react';
import { usePebbleStore, Logos, Tier } from '../store';
import { format } from 'date-fns';
import { useNavigate } from 'react-router-dom';

function masteryClass(level: number): string {
  if (level === 0) return '';
  if (level === 1) return 'ml';
  if (level === 2) return 'mfg';
  if (level === 3) return 'mf';
  return 'mm'; // 4 or 5
}

function tierClass(tier: Tier): string {
  if (tier === 'Word') return 'tb-word';
  if (tier === 'Phrase') return 'tb-phrase';
  return 'tb-colloc';
}

const CheckIcon = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
);

export const Callistratum = () => {
  const { logoi } = usePebbleStore();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [selectedTier, setSelectedTier] = useState<Tier | 'All'>('All');
  const [selectedLogos, setSelectedLogos] = useState<Logos | null>(null);
  const [starred, setStarred] = useState<Set<string>>(new Set(['1', '3']));

  const filteredLogoi = logoi.filter(l => {
    const matchesSearch = l.text.toLowerCase().includes(search.toLowerCase());
    const matchesTier = selectedTier === 'All' || l.tier === selectedTier;
    return matchesSearch && matchesTier;
  });

  const toggleStar = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    setStarred(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const chips: (Tier | 'All')[] = ['All', 'Word', 'Phrase', 'Collocation'];

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
            onClick={() => setSelectedTier(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Logos list */}
      <div className="logos-list">
        {filteredLogoi.map(logos => (
          <div
            key={logos.id}
            className={`logos-item ${masteryClass(logos.masteryLevel)}`}
            onClick={() => setSelectedLogos(logos)}
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
        ))}
      </div>

      {/* Detail Modal */}
      {selectedLogos && (
        <div className="det-ov" onClick={e => { if (e.target === e.currentTarget) setSelectedLogos(null); }}>
          <div className="det-card">
            <button className="dc-x" onClick={() => setSelectedLogos(null)}>✕</button>
            <div className="dc-top">Logos Detail</div>
            <div className="dc-word">{selectedLogos.text}</div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <span className={`tier-badge ${tierClass(selectedLogos.tier)}`}>{selectedLogos.tier}</span>
              <span className="reg-lbl" style={{ display: 'flex', alignItems: 'center' }}>{selectedLogos.register}</span>
            </div>

            <div className="dc-sec">
              <div className="dc-sh"><span>📖</span> Definition</div>
              <div className="dc-st">"{selectedLogos.definition}"</div>
            </div>

            <div className="dc-sec">
              <div className="dc-sh"><span>↗</span> Example Usage</div>
              <div className="dc-st">{selectedLogos.exampleSentence}</div>
            </div>

            {selectedLogos.sourceSentence && (
              <div className="dc-sec">
                <div className="dc-sh"><span>📍</span> Source</div>
                <div className="dc-st">{selectedLogos.sourceSentence}</div>
              </div>
            )}

            {selectedLogos.structuralSplit && (
              <div className="dc-sec">
                <div className="dc-sh"><span>⚙</span> Structure</div>
                <div className="dc-st">
                  [{selectedLogos.structuralSplit.part1}] + [{selectedLogos.structuralSplit.part2}] — {selectedLogos.structuralSplit.type}
                </div>
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
              onClick={() => { setSelectedLogos(null); navigate('/palaestra'); }}
            >
              Train this Logos →
            </button>
          </div>
        </div>
      )}
    </>
  );
};
