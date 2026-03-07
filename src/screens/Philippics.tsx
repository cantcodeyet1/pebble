import React, { useMemo } from 'react';
import { usePebbleStore } from '../store';

// Generate the contribution grid with the same logic as the design
function buildGrid() {
  const lv = [0, 0, 1, 1, 2, 2, 3, 4, 0, 1, 2, 1, 0, 3, 2];
  const cells: string[] = [];
  for (let r = 0; r < 7; r++) {
    for (let c = 0; c < 15; c++) {
      const b = lv[c];
      const rd = Math.random();
      let cls = '';
      if (b >= 4)       cls = rd > 0.3 ? 'l4' : 'l3';
      else if (b >= 3)  cls = rd > 0.4 ? 'l3' : 'l2';
      else if (b >= 2)  cls = rd > 0.5 ? 'l2' : 'l1';
      else if (b >= 1 && rd > 0.5) cls = 'l1';
      cells.push(cls);
    }
  }
  return cells;
}

const sessionHistory = [
  { mode: '🪨 The Drill',             date: 'Today · 8 min',      score: '85%', meta: '7 reviewed' },
  { mode: '🏛 The Agora · Starred',   date: 'Yesterday · 12 min', score: '72%', meta: '8 reviewed' },
  { mode: '🪨 The Drill',             date: 'Mar 5 · 6 min',      score: '91%', meta: '5 reviewed' },
  { mode: '🏛 The Agora · Weakly Known', date: 'Mar 4 · 15 min',  score: '60%', meta: '12 reviewed' },
  { mode: '🪨 The Drill',             date: 'Mar 3 · 9 min',      score: '88%', meta: '9 reviewed' },
];

export const Philippics = () => {
  const { logoi, streak } = usePebbleStore();
  const gridCells = useMemo(() => buildGrid(), []);

  const mastered = logoi.filter(l => l.masteryLevel === 5).length;
  const words = logoi.filter(l => l.tier === 'Word');
  const phrases = logoi.filter(l => l.tier === 'Phrase');

  return (
    <>
      <div>
        <div className="screen-title">Philippics</div>
        <div className="screen-sub">Mastery &amp; Progress</div>
      </div>

      {/* Training History */}
      <div className="phil-section-hdr">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold-dim)', flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
        </svg>
        <span>Training History</span>
      </div>
      <div className="card" style={{ padding: 14 }}>
        <div className="contrib-grid">
          {gridCells.map((cls, i) => (
            <div key={i} className={`cc${cls ? ' ' + cls : ''}`} />
          ))}
        </div>
        <div className="grid-meta">
          <span>Last 15 weeks</span>
          <div className="g-legend">
            <span>Less</span>
            <div className="ld" style={{ background: 'rgba(255,255,255,.07)' }}/>
            <div className="ld" style={{ background: 'rgba(212,160,23,.2)' }}/>
            <div className="ld" style={{ background: 'rgba(212,160,23,.5)' }}/>
            <div className="ld" style={{ background: 'var(--gold-bright)' }}/>
            <span>More</span>
          </div>
        </div>
      </div>

      {/* Tier Mastery */}
      <div className="phil-section-hdr">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold-dim)', flexShrink: 0 }}>
          <circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/>
          <line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/>
          <line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/>
        </svg>
        <span>Tier Mastery</span>
      </div>
      <div className="card" style={{ padding: '16px 14px' }}>
        <div className="tbr">
          <div className="tbr-h"><span className="tbr-n">WORDS</span><span className="tbr-p">20%</span></div>
          <div className="tbr-bg"><div className="tbr-f" style={{ width: '20%' }}/></div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>4 of 20 mastered</div>
        </div>
        <div className="tbr">
          <div className="tbr-h"><span className="tbr-n">PHRASES</span><span className="tbr-p">40%</span></div>
          <div className="tbr-bg"><div className="tbr-f" style={{ width: '40%' }}/></div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>5 of 14 mastered</div>
        </div>
      </div>

      {/* Campaign Record */}
      <div className="phil-section-hdr">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold-dim)', flexShrink: 0 }}>
          <circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
        </svg>
        <span>Campaign Record</span>
      </div>
      <div className="campaign-grid">
        <div className="camp-card">
          <div className="cc-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#e07c3a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2c0 6-6 8-6 14a6 6 0 0012 0c0-6-6-8-6-14z"/>
              <path d="M12 12c0 3-2 4-2 6a2 2 0 004 0c0-2-2-3-2-6z"/>
            </svg>
          </div>
          <div className="cc-num">{streak}</div>
          <div className="cc-label">Day Streak</div>
        </div>
        <div className="camp-card">
          <div className="cc-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9H4a2 2 0 000 4h2"/><path d="M18 9h2a2 2 0 010 4h-2"/>
              <path d="M6 9v6"/><path d="M18 9v6"/>
              <path d="M6 9a6 6 0 0012 0"/><path d="M6 15a6 6 0 0012 0"/>
              <path d="M9 21h6"/><path d="M12 15v6"/>
            </svg>
          </div>
          <div className="cc-num">12</div>
          <div className="cc-label">Mastered Total</div>
          <div className="cc-sub" style={{ marginTop: 5 }}>
            <span style={{ color: '#60a5fa', fontSize: 10 }}>4W</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> · </span>
            <span style={{ color: '#c4a5e8', fontSize: 10 }}>5P</span>
          </div>
        </div>
        <div className="camp-card">
          <div className="cc-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </div>
          <div className="cc-num" style={{ color: 'var(--gold-bright)' }}>+9</div>
          <div className="cc-label">New This Week</div>
          <div className="cc-sub" style={{ marginTop: 5 }}>
            <span style={{ color: '#60a5fa', fontSize: 10 }}>3W</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> · </span>
            <span style={{ color: '#c4a5e8', fontSize: 10 }}>4P</span>
          </div>
        </div>
        <div className="camp-card">
          <div className="cc-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="8" r="5"/>
              <path d="M8 8c0 0 0 2 2 3s2 3 2 3"/><path d="M16 8c0 0 0 2-2 3s-2 3-2 3"/>
              <rect x="9" y="17" width="6" height="4" rx="1"/>
              <line x1="9" y1="19" x2="15" y2="19"/>
            </svg>
          </div>
          <div className="cc-num" style={{ color: '#f87171' }}>3</div>
          <div className="cc-label">Forgotten</div>
          <div className="cc-sub" style={{ marginTop: 5 }}>
            <span style={{ color: '#60a5fa', fontSize: 10 }}>1W</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> · </span>
            <span style={{ color: '#c4a5e8', fontSize: 10 }}>1P</span>
          </div>
        </div>
      </div>

      {/* Session History */}
      <div className="phil-section-hdr">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--gold-dim)', flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"/>
          <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
        </svg>
        <span>Session History</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12 }}>
        {sessionHistory.map((s, i) => (
          <div className="sess-hist-item" key={i}>
            <div>
              <div className="shi-mode">{s.mode}</div>
              <div className="shi-date">{s.date}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div className="shi-score">{s.score}</div>
              <div className="shi-meta">{s.meta}</div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};
