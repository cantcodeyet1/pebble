import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePebbleStore } from '../store';
import { DrillIcon, AgoraIcon } from './Palaestra';
import { addLogos as dbAddLogos } from '../db/logoi';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const slides = [
  {
    tier: 'Word' as const,
    tc: 'tb-word',
    word: 'Ephemeral',
    ipa: '/ɪˈfem.ər.əl/',
    pos: 'Adjective',
    register: 'literary',
    def: '"Lasting for a very short time; transitory."',
    ex: '"The beauty of the sunset was ephemeral, fading into darkness within minutes."',
    syns: ['Transient', 'Fleeting', 'Momentary'],
    btnLabel: 'Train this word →',
  },
  {
    tier: 'Phrase' as const,
    tc: 'tb-phrase',
    word: 'Bite the bullet',
    ipa: '',
    pos: 'Idiomatic Expression',
    register: 'informal',
    def: '"To endure a painful or difficult situation that is unavoidable."',
    ex: '"I had to bite the bullet and rewrite the entire proposal from scratch."',
    syns: ['Endure', 'Soldier on', 'Grin and bear it'],
    btnLabel: 'Train this phrase →',
  },
];

export const Ecclesia = () => {
  const { streak, logoi, appendLogos, activityDates } = usePebbleStore();

  const weekDays = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const monOffset = (today.getDay() + 6) % 7; // 0=Mon … 6=Sun
    return DAY_LABELS.map((lbl, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - monOffset + i);
      const dateStr = d.toISOString().slice(0, 10);
      let state = '';
      if (dateStr === todayStr) state = 'today';
      else if (dateStr < todayStr && activityDates.includes(dateStr)) state = 'done';
      return { lbl, state };
    });
  }, [activityDates]);
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const isSaved = (i: number) =>
    logoi.some(l => l.text.toLowerCase() === slides[i].word.toLowerCase());

  const saveSlide = async (i: number) => {
    if (isSaved(i)) return;
    const s = slides[i];
    try {
      const result = await dbAddLogos({
        entry: s.word,
        tier: s.tier.toLowerCase(),
        definition: s.def.replace(/^"|"$/g, ''),
        example: s.ex.replace(/^"|"$/g, ''),
        register: s.register,
        phonetic: s.ipa,
        pos: s.pos,
        synonyms: s.syns,
      });
      appendLogos(result);
    } catch {
      // DB unavailable — silently ignore
    }
  };
  const dragStartRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);

  const dueCount = logoi.filter(l => l.nextReviewDate <= new Date()).length;

  const goSlide = (i: number) => setSlide(Math.max(0, Math.min(1, i)));

  const onDragStart = (clientX: number) => {
    dragStartRef.current = clientX;
    dragDeltaRef.current = 0;
  };
  const onDragMove = (clientX: number) => {
    if (dragStartRef.current !== null) {
      dragDeltaRef.current = clientX - dragStartRef.current;
    }
  };
  const onDragEnd = () => {
    if (dragDeltaRef.current < -40) goSlide(slide + 1);
    else if (dragDeltaRef.current > 40) goSlide(slide - 1);
    dragStartRef.current = null;
    dragDeltaRef.current = 0;
  };

  return (
    <>
      {/* Header */}
      <div className="ecclesia-header">
        <div>
          <div className="screen-title">Ecclesia</div>
          <div className="screen-sub">The Path of Demosthenes</div>
        </div>
        <div className="streak-pill">🔥 {streak}</div>
      </div>

      {/* Carousel */}
      <div>
        <div
          className="lotd-carousel-wrap"
          onMouseDown={e => onDragStart(e.clientX)}
          onMouseMove={e => onDragMove(e.clientX)}
          onMouseUp={onDragEnd}
          onTouchStart={e => onDragStart(e.touches[0].clientX)}
          onTouchMove={e => onDragMove(e.touches[0].clientX)}
          onTouchEnd={onDragEnd}
          style={{ touchAction: 'pan-y' }}
        >
          <div className="lotd-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {slides.map((s, i) => (
              <div className="lotd-slide" key={i}>
                <div className="lotd-type-row">
                  <span className={`tier-badge ${s.tc}`}>{s.tier}</span>
                  <span className="lotd-day">Today</span>
                  <button className="lotd-save-btn" onClick={() => { void saveSlide(i); }} title="Save to Callistratum">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill={isSaved(i) ? 'var(--gold)' : 'none'} stroke="var(--gold)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z"/>
                    </svg>
                  </button>
                </div>
                <div className="lotd-word">{s.word}</div>
                <div style={{ display: 'flex', gap: 10 }}>
                  {s.ipa && <span className="lotd-sub">{s.ipa}</span>}
                  <span className="lotd-pos">{s.pos}</span>
                </div>
                <div className="lotd-def">{s.def}</div>
                <div className="lotd-ex">{s.ex}</div>
                <div className="syn-row">
                  {s.syns.map(syn => <span className="syn-chip" key={syn}>{syn}</span>)}
                </div>
                <button className="train-btn" onClick={() => navigate('/palaestra')}>{s.btnLabel}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="carousel-dots">
          {[0, 1].map(i => (
            <div key={i} className={`cdot${slide === i ? ' active' : ''}`} onClick={() => goSlide(i)} />
          ))}
        </div>
      </div>

      {/* Weekly streak card */}
      <div className="card hero-card" style={{ padding: '16px 18px' }}>
        <div className="week-row" style={{ marginBottom: 0 }}>
          {weekDays.map((d, i) => (
            <div className="week-day" key={i}>
              <div className="wlbl">{d.lbl}</div>
              <div className={`wdot${d.state === 'done' ? ' done' : d.state === 'today' ? ' today' : ''}`}>
                {d.state === 'done' ? '✓' : d.state === 'today' ? '•' : ''}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Begin a Session */}
      <div className="section-label">Begin a Session</div>
      <div className="session-cards">
        <div className="session-card-h primary" onClick={() => navigate('/palaestra', { state: { mode: 'drill', autoStart: true } })}>
          <div className="sch-icon"><DrillIcon size={26} color="var(--gold)" /></div>
          <div className="sch-body">
            <div className="sch-name">The Drill</div>
            <div className="sch-desc">Daily spaced repetition — algorithm decides what's due, including new words and Logoi of the Day</div>
            <div className="mc-badges">
              <span className="mc-badge">{dueCount} due today</span>
              <span className="mc-badge green">3 new</span>
            </div>
          </div>
          <div className="sch-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        <div className="session-card-h" onClick={() => navigate('/palaestra', { state: { mode: 'agora', step: 1 } })}>
          <div className="sch-icon"><AgoraIcon size={22} color="var(--gold-dim)" /></div>
          <div className="sch-body">
            <div className="sch-name">The Agora</div>
            <div className="sch-desc">Free practice on your own terms — filter by starred words, mastery level or register</div>
            <div className="mc-badges">
              <span className="mc-badge">{logoi.length} logoi available</span>
            </div>
          </div>
          <div className="sch-arrow">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </div>
    </>
  );
};
