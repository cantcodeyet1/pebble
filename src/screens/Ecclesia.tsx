import React, { useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePebbleStore } from '../store';
import type { SlideData } from '../store';
import { addLogos as dbAddLogos } from '../db/logoi';
import { quotes } from '../data/quotes';

const DAY_LABELS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

const FALLBACK_SLIDES: SlideData[] = [
  {
    tier: 'Word',
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
    tier: 'Phrase',
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
  const { streak, logoi, appendLogos, activityDates, todaySlides } = usePebbleStore();
  const slides = todaySlides ?? FALLBACK_SLIDES;

  const weekDays = useMemo(() => {
    const today = new Date();
    const todayStr = today.toISOString().slice(0, 10);
    const monOffset = (today.getDay() + 6) % 7; // 0=Mon … 6=Sun
    return DAY_LABELS.map((lbl, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - monOffset + i);
      const dateStr = d.toISOString().slice(0, 10);
      let state = '';
      if (dateStr === todayStr) state = activityDates.includes(dateStr) ? 'done' : 'today';
      else if (dateStr < todayStr && activityDates.includes(dateStr)) state = 'done';
      return { lbl, state };
    });
  }, [activityDates]);
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const goSlide = (i: number) => setSlide(Math.max(0, Math.min(slides.length - 1, i)));
  const isSaved = (i: number) =>
    logoi.some(l => l.text.toLowerCase() === slides[i].word.toLowerCase());

  const saveSlide = async (i: number) => {
    if (isSaved(i)) return logoi.find(l => l.text.toLowerCase() === slides[i].word.toLowerCase()) ?? null;
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
      return result;
    } catch {
      return null;
    }
  };

  const trainSlide = async (i: number) => {
    const logos = await saveSlide(i);
    if (logos) {
      navigate('/palaestra', { state: { mode: 'agora', step: 3, manualIds: [logos.id] } });
    } else {
      navigate('/palaestra');
    }
  };
  const dragStartRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);

  const quote = quotes[Math.floor(Date.now() / 3_600_000) % quotes.length];

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
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 18, overflow: 'hidden' }}>

      {/* Header */}
      <div className="ecclesia-header" style={{ flexShrink: 0 }}>
        <div>
          <div className="screen-title">Ecclesia</div>
          <div className="screen-sub">The Path of Demosthenes</div>
        </div>
        <div className="streak-pill">🔥 {streak}</div>
      </div>

      {/* Carousel — grows to fill remaining vertical space */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div
          className="lotd-carousel-wrap"
          onMouseDown={e => onDragStart(e.clientX)}
          onMouseMove={e => onDragMove(e.clientX)}
          onMouseUp={onDragEnd}
          onTouchStart={e => onDragStart(e.touches[0].clientX)}
          onTouchMove={e => onDragMove(e.touches[0].clientX)}
          onTouchEnd={onDragEnd}
          style={{ flex: 1, minHeight: 0, touchAction: 'pan-y' }}
        >
          <div className="lotd-track" style={{ transform: `translateX(-${slide * 100}%)`, height: '100%' }}>
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
                <button className="train-btn" style={{ marginTop: 'auto' }} onClick={() => { void trainSlide(i); }}>{s.btnLabel}</button>
              </div>
            ))}
          </div>
        </div>
        <div className="carousel-dots" style={{ flexShrink: 0 }}>
          {slides.map((_, i) => (
            <div key={i} className={`cdot${slide === i ? ' active' : ''}`} onClick={() => goSlide(i)} />
          ))}
        </div>
      </div>

      {/* Weekly streak card */}
      <div className="card hero-card" style={{ padding: '16px 18px', flexShrink: 0 }}>
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

      {/* Quote card */}
      <div style={{
        flexShrink: 0,
        background: 'var(--glass)',
        border: '1px solid var(--glass-border)',
        borderLeft: '3px solid var(--gold-dim)',
        borderRadius: 14,
        padding: '16px 20px 16px 22px',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
      }}>
        <div style={{
          fontFamily: "'Cormorant Garamond', serif",
          fontSize: 17,
          fontStyle: 'italic',
          fontWeight: 500,
          color: 'var(--text)',
          lineHeight: 1.6,
        }}>
          "{quote.text}"
        </div>
        <div style={{
          textAlign: 'right',
          fontSize: 10,
          letterSpacing: '0.12em',
          color: 'var(--gold-dim)',
          marginTop: 10,
          textTransform: 'uppercase',
        }}>
          — {quote.author}
        </div>
      </div>

    </div>
  );
};
