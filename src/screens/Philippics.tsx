import React, { useMemo } from 'react';
import { usePebbleStore, Logos } from '../store';
import { addDays, startOfDay, startOfWeek, subWeeks } from 'date-fns';

function buildGrid(logoi: Logos[]) {
  const now = new Date();
  const cells: string[] = [];
  for (let row = 0; row < 7; row++) {
    for (let col = 0; col < 15; col++) {
      const weeksBack = 14 - col;
      const weekStart = startOfWeek(subWeeks(now, weeksBack), { weekStartsOn: 1 });
      const cellDate = startOfDay(addDays(weekStart, row));
      if (cellDate > now) { cells.push(''); continue; }
      const count = logoi.filter(l => startOfDay(new Date(l.dateAdded)).getTime() === cellDate.getTime()).length;
      let cls = '';
      if (count >= 4)      cls = 'l4';
      else if (count >= 3) cls = 'l3';
      else if (count >= 2) cls = 'l2';
      else if (count >= 1) cls = 'l1';
      cells.push(cls);
    }
  }
  return cells;
}

export const Philippics = () => {
  const { logoi, streak } = usePebbleStore();

  const words   = useMemo(() => logoi.filter(l => l.tier === 'Word'),   [logoi]);
  const phrases = useMemo(() => logoi.filter(l => l.tier === 'Phrase'), [logoi]);

  const masteredWords   = words.filter(l => l.masteryLevel === 5).length;
  const masteredPhrases = phrases.filter(l => l.masteryLevel === 5).length;
  const mastered        = masteredWords + masteredPhrases;

  const wordPct   = words.length   > 0 ? Math.round((masteredWords   / words.length)   * 100) : 0;
  const phrasePct = phrases.length > 0 ? Math.round((masteredPhrases / phrases.length) * 100) : 0;

  const oneWeekAgo   = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; }, []);
  const newThisWeek  = useMemo(() => logoi.filter(l => new Date(l.dateAdded) >= oneWeekAgo), [logoi, oneWeekAgo]);
  const newWords     = newThisWeek.filter(l => l.tier === 'Word').length;
  const newPhrases   = newThisWeek.filter(l => l.tier === 'Phrase').length;

  // Forgotten = mastery level 0 and overdue (failed so often SRS sent them back to start)
  const forgotten        = useMemo(() => logoi.filter(l => l.masteryLevel === 0 && new Date(l.nextReviewDate) < new Date()), [logoi]);
  const forgottenWords   = forgotten.filter(l => l.tier === 'Word').length;
  const forgottenPhrases = forgotten.filter(l => l.tier === 'Phrase').length;

  const gridCells = useMemo(() => buildGrid(logoi), [logoi]);

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
          <div className="tbr-h"><span className="tbr-n">WORDS</span><span className="tbr-p">{wordPct}%</span></div>
          <div className="tbr-bg"><div className="tbr-f" style={{ width: `${wordPct}%` }}/></div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{masteredWords} of {words.length} mastered</div>
        </div>
        <div className="tbr">
          <div className="tbr-h"><span className="tbr-n">PHRASES</span><span className="tbr-p">{phrasePct}%</span></div>
          <div className="tbr-bg"><div className="tbr-f" style={{ width: `${phrasePct}%` }}/></div>
          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 4 }}>{masteredPhrases} of {phrases.length} mastered</div>
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
          <div className="cc-num">{mastered}</div>
          <div className="cc-label">Mastered Total</div>
          <div className="cc-sub" style={{ marginTop: 5 }}>
            <span style={{ color: '#60a5fa', fontSize: 10 }}>{masteredWords}W</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> · </span>
            <span style={{ color: '#c4a5e8', fontSize: 10 }}>{masteredPhrases}P</span>
          </div>
        </div>
        <div className="camp-card">
          <div className="cc-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c9a227" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/>
            </svg>
          </div>
          <div className="cc-num" style={{ color: 'var(--gold-bright)' }}>+{newThisWeek.length}</div>
          <div className="cc-label">New This Week</div>
          <div className="cc-sub" style={{ marginTop: 5 }}>
            <span style={{ color: '#60a5fa', fontSize: 10 }}>{newWords}W</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> · </span>
            <span style={{ color: '#c4a5e8', fontSize: 10 }}>{newPhrases}P</span>
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
          <div className="cc-num" style={{ color: '#f87171' }}>{forgotten.length}</div>
          <div className="cc-label">Forgotten</div>
          <div className="cc-sub" style={{ marginTop: 5 }}>
            <span style={{ color: '#60a5fa', fontSize: 10 }}>{forgottenWords}W</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10 }}> · </span>
            <span style={{ color: '#c4a5e8', fontSize: 10 }}>{forgottenPhrases}P</span>
          </div>
        </div>
      </div>
    </>
  );
};
