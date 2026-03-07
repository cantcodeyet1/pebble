import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePebbleStore } from '../store';

type Mode = 'drill' | 'agora';
type Filter = 'starred' | 'weak' | 'mild' | 'strong' | 'register' | 'manual';
type TierFilter = 'all' | 'word' | 'phrase' | 'colloc';
type TrainingStyle = 'mixed' | 'blank' | 'synonym' | 'usage' | 'write';

const ChevronLeft = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="15 18 9 12 15 6"/>
  </svg>
);
const ChevronRight = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="9 18 15 12 9 6"/>
  </svg>
);

export const DrillIcon = ({ size = 26, color = 'var(--gold)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>
  </svg>
);

export const AgoraIcon = ({ size = 26, color = 'var(--gold-dim)' }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="21" x2="21" y2="21"/>
    <line x1="3" y1="10" x2="21" y2="10"/>
    <polyline points="3 7 12 3 21 7"/>
    <line x1="5" y1="10" x2="5" y2="21"/>
    <line x1="9" y1="10" x2="9" y2="21"/>
    <line x1="15" y1="10" x2="15" y2="21"/>
    <line x1="19" y1="10" x2="19" y2="21"/>
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

// Bout question types
const boutQuestions = [
  {
    type: 'Fill in the Blank',
    word: 'Ephemeral',
    text: 'The beauty of cherry blossoms is ____ — they last only a week before falling.',
    blank: true,
    options: ['Persistent', 'Ephemeral', 'Mundane', 'Tenacious'],
    correctIndex: 1,
    feedback: 'The ephemeral quality of the blossoms is precisely what makes them precious in Japanese culture.',
  },
  {
    type: 'Find the Synonym',
    word: 'Bite the bullet',
    text: 'Which phrase is closest in meaning to "bite the bullet"?',
    blank: false,
    options: ['Avoid the issue', 'Soldier on through hardship', 'Change one\'s mind', 'Take the easy path'],
    correctIndex: 1,
    feedback: '"Bite the bullet" and "soldier on" both describe enduring something unavoidable with resolve.',
  },
  {
    type: 'Correct Usage',
    word: 'Deeply flawed',
    text: 'Which sentence uses "deeply flawed" correctly?',
    blank: false,
    options: [
      'The cake was deeply flawed with chocolate.',
      'His argument was deeply flawed, built on a false premise.',
      'She deeply flawed her way through the exam.',
      'The sunset was deeply flawed and beautiful.',
    ],
    correctIndex: 1,
    feedback: '"Deeply flawed" collocates with arguments, methods, reasoning — things that can have logical or structural errors.',
  },
];

export const Palaestra = () => {
  const navigate = useNavigate();
  const { logoi, setBoutOpen, boutOpen } = usePebbleStore();

  // Panel state
  const [step, setStep] = useState(0);
  const [mode, setMode] = useState<Mode>('drill');
  const [filter, setFilter] = useState<Filter>('starred');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [trainingStyle, setTrainingStyle] = useState<TrainingStyle>('mixed');

  // Bout state
  const [qIndex, setQIndex] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [boutStarred, setBoutStarred] = useState(false);

  const totalQ = boutQuestions.length;
  const currentQ = boutQuestions[qIndex];

  const palGo = (s: number) => setStep(s);

  const p0Next = () => {
    if (mode === 'drill') startBout();
    else palGo(1);
  };

  const startBout = () => {
    setQIndex(0);
    setAnswered(null);
    setBoutOpen(true);
  };

  const exitBout = () => {
    setBoutOpen(false);
    setStep(0);
  };

  const pickAnswer = (idx: number) => {
    if (answered !== null) return;
    setAnswered(idx);
  };

  const nextQ = () => {
    if (qIndex < totalQ - 1) {
      setQIndex(i => i + 1);
      setAnswered(null);
    } else {
      exitBout();
    }
  };

  // Clean up boutOpen on unmount
  useEffect(() => {
    return () => { setBoutOpen(false); };
  }, []);

  const optLabels = ['A', 'B', 'C', 'D'];

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <div className="pal-outer">
        {/* SLIDER */}
        <div
          className="pal-slider"
          style={{ transform: `translateX(-${step * 20}%)` }}
        >
          {/* ── PANEL 0: Mode Select ── */}
          <div className="pal-panel">
            <div className="pal-top">
              <div className="pal-step-title">
                <div className="screen-title">Palaestra</div>
                <div className="screen-sub">The Wrestling Ground</div>
              </div>
            </div>

            <div
              className={`mode-card${mode === 'drill' ? ' sel' : ''}`}
              onClick={() => setMode('drill')}
            >
              <div className="mc-icon"><DrillIcon size={26} color={mode === 'drill' ? 'var(--gold)' : 'var(--gold-dim)'} /></div>
              <div className="mc-body">
                <div className="mc-name">The Drill</div>
                <div className="mc-desc">Your daily spaced repetition session. The algorithm decides what's due — new words, forgotten words, and everything in between. Includes today's Logoi of the Day.</div>
                <div className="mc-badges">
                  <span className="mc-badge">7 due today</span>
                  <span className="mc-badge green">3 new</span>
                </div>
              </div>
            </div>

            <div
              className={`mode-card${mode === 'agora' ? ' sel' : ''}`}
              onClick={() => setMode('agora')}
            >
              <div className="mc-icon"><AgoraIcon size={26} color={mode === 'agora' ? 'var(--gold)' : 'var(--gold-dim)'} /></div>
              <div className="mc-body">
                <div className="mc-name">The Agora</div>
                <div className="mc-desc">Free practice on your own terms. Filter by starred words, mastery level, or register. You pick the logoi, you set the pace.</div>
                <div className="mc-badges">
                  <span className="mc-badge">{logoi.length} logoi available</span>
                </div>
              </div>
            </div>

            <button className="pal-enter-btn" onClick={p0Next}>
              {mode === 'drill' ? 'Enter the Palaestra →' : 'Choose Your Logoi →'}
            </button>
          </div>

          {/* ── PANEL 1: Agora Filters ── */}
          <div className="pal-panel">
            <div className="pal-top">
              <button className="pal-back" onClick={() => palGo(0)}><ChevronLeft /></button>
              <div className="pal-step-title">
                <div className="screen-title" style={{ fontSize: 26 }}>The Agora</div>
                <div className="screen-sub">Choose your filter</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { id: 'starred' as Filter, icon: '⭐', name: 'Starred Words', sub: '8 logoi starred' },
                { id: 'weak'    as Filter, icon: '🔴', name: 'Weakly Known',   sub: 'Mastery 1–2 · 12 logoi' },
                { id: 'mild'    as Filter, icon: '🟡', name: 'Mildly Known',   sub: 'Mastery 3 · 9 logoi' },
                { id: 'strong'  as Filter, icon: '🟢', name: 'Strong Knowledge', sub: 'Mastery 4–5 · 18 logoi' },
                { id: 'register'as Filter, icon: '📋', name: 'By Register',    sub: 'Academic · Literary · Formal…' },
                { id: 'manual'  as Filter, icon: '✋', name: 'Select Manually', sub: 'Pick individual logoi from your library' },
              ].map(f => (
                <div
                  key={f.id}
                  className={`filter-row-item${filter === f.id ? ' sel' : ''}`}
                  onClick={() => setFilter(f.id)}
                >
                  <div className="fri-icon">{f.icon}</div>
                  <div className="fri-body">
                    <div className="fri-name">{f.name}</div>
                    <div className="fri-sub">{f.sub}</div>
                  </div>
                  <div className="fri-check">
                    {filter === f.id && <CheckMark />}
                  </div>
                </div>
              ))}
            </div>

            {filter === 'register' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div className="section-label">Register</div>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {['Academic', 'Literary', 'Formal', 'Informal', 'Idiomatic'].map(r => (
                    <div key={r} className="f-chip active">{r}</div>
                  ))}
                </div>
              </div>
            )}

            <button className="pal-enter-btn" onClick={() => palGo(2)}>Next →</button>
          </div>

          {/* ── PANEL 2: Logos Type ── */}
          <div className="pal-panel">
            <div className="pal-top">
              <button className="pal-back" onClick={() => palGo(1)}><ChevronLeft /></button>
              <div className="pal-step-title">
                <div className="screen-title" style={{ fontSize: 26 }}>Logos Type</div>
                <div className="screen-sub">What will you wrestle with?</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div
                className={`tier-type-card${tierFilter === 'all' ? ' sel' : ''}`}
                onClick={() => setTierFilter('all')}
              >
                <div className="ttc-header">
                  <div>
                    <div className="ttc-name">All Logoi</div>
                    <div className="ttc-sub">Words, phrases and collocations mixed</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="ttc-count">8</div>
                    <div className="ttc-check">{tierFilter === 'all' && <CheckMark />}</div>
                  </div>
                </div>
              </div>

              <div
                className={`tier-type-card${tierFilter === 'word' ? ' sel' : ''}`}
                onClick={() => setTierFilter('word')}
              >
                <div className="ttc-header">
                  <div>
                    <span className="tier-badge tb-word" style={{ marginBottom: 6, display: 'inline-block' }}>Word</span>
                    <div className="ttc-name">Words only</div>
                    <div className="ttc-sub">Single lexical items · synonym, fill-in-blank, usage</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="ttc-count" style={{ color: 'var(--gold)' }}>5</div>
                    <div className="ttc-check">{tierFilter === 'word' && <CheckMark />}</div>
                  </div>
                </div>
              </div>

              <div
                className={`tier-type-card${tierFilter === 'phrase' ? ' sel' : ''}`}
                onClick={() => setTierFilter('phrase')}
              >
                <div className="ttc-header">
                  <div>
                    <span className="tier-badge tb-phrase" style={{ marginBottom: 6, display: 'inline-block' }}>Phrase</span>
                    <div className="ttc-name">Phrases &amp; Idioms</div>
                    <div className="ttc-sub">Meaning is the whole unit · register &amp; context</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="ttc-count" style={{ color: '#5ec4c4' }}>2</div>
                    <div className="ttc-check">{tierFilter === 'phrase' && <CheckMark />}</div>
                  </div>
                </div>
              </div>

              <div
                className={`tier-type-card${tierFilter === 'colloc' ? ' sel' : ''}`}
                onClick={() => setTierFilter('colloc')}
              >
                <div className="ttc-header">
                  <div>
                    <span className="tier-badge tb-colloc" style={{ marginBottom: 6, display: 'inline-block' }}>Collocation</span>
                    <div className="ttc-name">Collocations</div>
                    <div className="ttc-sub">Word pairs that travel together · which word fits?</div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div className="ttc-count" style={{ color: '#c4a5e8' }}>1</div>
                    <div className="ttc-check">{tierFilter === 'colloc' && <CheckMark />}</div>
                  </div>
                </div>
              </div>
            </div>

            <button className="pal-enter-btn" onClick={() => palGo(3)}>Next →</button>
          </div>

          {/* ── PANEL 3: Training Style ── */}
          <div className="pal-panel">
            <div className="pal-top">
              <button className="pal-back" onClick={() => palGo(2)}><ChevronLeft /></button>
              <div className="pal-step-title">
                <div className="screen-title" style={{ fontSize: 26 }}>Training Style</div>
                <div className="screen-sub">How will you wrestle?</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { id: 'mixed'   as TrainingStyle, icon: '⚡', name: 'Mixed',             desc: 'Algorithm adapts the style to each word\'s mastery level' },
                { id: 'blank'   as TrainingStyle, icon: '🔲', name: 'Fill in the Blank',  desc: 'Complete the sentence with the missing word or phrase' },
                { id: 'synonym' as TrainingStyle, icon: '≈',  name: 'Find the Synonym',   desc: 'Match words by meaning, register and semantic weight' },
                { id: 'usage'   as TrainingStyle, icon: '✓',  name: 'Correct Usage',      desc: 'Identify which sentence deploys the word correctly' },
                { id: 'write'   as TrainingStyle, icon: '✍',  name: 'Write a Sentence',   desc: 'Produce your own sentence — AI evaluates naturalness' },
              ].map(s => (
                <div
                  key={s.id}
                  className={`style-card${trainingStyle === s.id ? ' sel' : ''}`}
                  onClick={() => setTrainingStyle(s.id)}
                >
                  <div className="sc-icon-s">{s.icon}</div>
                  <div className="sc-body-s">
                    <div className="sc-name-s">{s.name}</div>
                    <div className="sc-desc-s">{s.desc}</div>
                  </div>
                  <div className="sc-check-s">
                    {trainingStyle === s.id && <CheckMark />}
                  </div>
                </div>
              ))}
            </div>

            <button className="pal-enter-btn" onClick={startBout}>Enter the Palaestra →</button>
          </div>

          {/* Panel 4 placeholder (slider is 500% wide) */}
          <div className="pal-panel" />
        </div>

        {/* ── THE BOUT ── */}
        {boutOpen && (
          <div className="bout-wrap">
            <div className="bout-top">
              <button className="bout-exit" onClick={exitBout}><ChevronLeft /></button>
              <div className="bout-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                {mode === 'drill' ? <DrillIcon size={16} color="var(--gold)" /> : <AgoraIcon size={16} color="var(--gold)" />}
                {mode === 'drill' ? 'The Drill' : 'The Agora'}
              </div>
              <button
                className={`bout-star${boutStarred ? ' starred' : ''}`}
                onClick={() => setBoutStarred(s => !s)}
              >
                <StarIcon filled={boutStarred} />
              </button>
            </div>

            <div className="bout-prog-wrap">
              <div className="prog-meta">
                <span>{qIndex + 1} of {totalQ} logoi</span>
                <span style={{ color: 'var(--gold)' }}>{currentQ.type}</span>
              </div>
              <div className="prog-bg">
                <div className="prog-fill" style={{ width: `${((qIndex + 1) / totalQ) * 100}%` }} />
              </div>
            </div>

            <div className="q-card">
              <div className="q-type">{currentQ.type}</div>
              <div className="q-word">{currentQ.word}</div>
              <div className="q-text">
                {currentQ.blank
                  ? <>The beauty of cherry blossoms is <span className="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span> — they last only a week before falling.</>
                  : currentQ.text
                }
              </div>
            </div>

            <div className="ans-opts">
              {currentQ.options.map((opt, i) => {
                let cls = '';
                if (answered !== null) {
                  if (i === currentQ.correctIndex) cls = 'correct';
                  else if (i === answered && i !== currentQ.correctIndex) cls = 'wrong';
                }
                return (
                  <button
                    key={i}
                    className={`ans-opt${cls ? ' ' + cls : ''}`}
                    onClick={() => pickAnswer(i)}
                    disabled={answered !== null}
                  >
                    <div className="opt-l">{optLabels[i]}</div>
                    {opt}
                  </button>
                );
              })}
            </div>

            {answered !== null && (
              <div className="feedback-bar" style={answered !== currentQ.correctIndex ? { background: 'rgba(107,26,26,.4)', borderColor: 'rgba(248,113,113,.25)' } : {}}>
                {answered === currentQ.correctIndex
                  ? <div className="fb-correct">✓ Correct — {currentQ.word}</div>
                  : <div className="fb-correct" style={{ color: '#f87171' }}>✗ Incorrect — "{currentQ.options[currentQ.correctIndex]}" was correct</div>
                }
                <div className="fb-note">{currentQ.feedback}</div>
                <button
                  style={{ marginTop: 6, background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                  onClick={nextQ}
                >
                  {qIndex < totalQ - 1 ? 'Continue →' : 'Finish Session'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
