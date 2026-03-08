import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePebbleStore, Logos } from '../store';
import { updateLogos } from '../db/logoi';
import { recordActivityDb } from '../db/activity';
import { addDays } from 'date-fns';
import { evaluateSentence, generateSessionContent, SessionContent } from '../services/ai.service';

type Mode = 'drill' | 'agora';
type Filter = 'starred' | 'weak' | 'mild' | 'strong' | 'new' | 'register' | 'manual';
type TierFilter = 'all' | 'word' | 'phrase';
type TrainingStyle = 'mixed' | 'blank' | 'synonym' | 'usage' | 'write';
type QuestionType = 'blank' | 'synonym' | 'usage' | 'write';

interface BoutQuestion {
  qType: QuestionType;
  logos: Logos;
  prompt: string;
  options: string[];
  correctIndex: number; // -1 for write
  feedback: string;
  isRetry?: boolean;
}

interface SessionResult {
  logos: Logos;
  correct: boolean;
}

// ── helpers ──────────────────────────────────────────────────────────────────

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickQType(style: TrainingStyle, logos: Logos): QuestionType {
  if (style !== 'mixed') return style as QuestionType;
  const hasSyns = !!(logos.synonyms?.length);
  const opts: QuestionType[] = logos.masteryLevel <= 2
    ? ['blank', 'usage']
    : hasSyns ? ['blank', 'synonym', 'usage'] : ['blank', 'usage'];
  return opts[Math.floor(Math.random() * opts.length)];
}

function buildQuestion(logos: Logos, qType: QuestionType, all: Logos[], content?: SessionContent): BoutQuestion {
  const pool = shuffle(all.filter(l => l.id !== logos.id));
  const feedback = logos.definition;

  if (qType === 'write') {
    return { qType, logos, prompt: `Use "${logos.text}" in a sentence that demonstrates its meaning.`, options: [], correctIndex: -1, feedback };
  }

  if (qType === 'synonym') {
    let correct: string;
    let wrongs: string[];
    if (content?.synonymCorrect && content?.synonymWrongs?.length === 3) {
      correct = content.synonymCorrect;
      wrongs = [...content.synonymWrongs];
    } else {
      correct = logos.synonyms?.[0] ?? logos.text;
      wrongs = pool.slice(0, 3).map(d => d.synonyms?.[0] ?? d.text);
      while (wrongs.length < 3) wrongs.push(pool[wrongs.length % Math.max(pool.length, 1)]?.text ?? '—');
    }
    const opts = shuffle([correct, ...wrongs.slice(0, 3)]);
    return { qType, logos, prompt: `Which is closest in meaning to "${logos.text}"?`, options: opts, correctIndex: opts.indexOf(correct), feedback };
  }

  if (qType === 'blank') {
    let blanked: string;
    if (content?.blankSentence) {
      blanked = content.blankSentence.replace(/BLANK/g, '______');
    } else {
      const esc = logos.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      blanked = logos.exampleSentence.replace(new RegExp(esc, 'gi'), '______');
    }
    const wrongs = pool.slice(0, 3).map(d => d.text);
    while (wrongs.length < 3) wrongs.push(pool[wrongs.length % Math.max(pool.length, 1)]?.text ?? '—');
    const opts = shuffle([logos.text, ...wrongs.slice(0, 3)]);
    return { qType, logos, prompt: blanked, options: opts, correctIndex: opts.indexOf(logos.text), feedback };
  }

  // usage
  let correctSentence: string;
  let wrongSentences: string[];
  if (content?.usageCorrect && content?.usageWrongs?.length === 3) {
    correctSentence = content.usageCorrect;
    wrongSentences = [...content.usageWrongs];
  } else {
    correctSentence = logos.exampleSentence;
    const targetLower = logos.text.toLowerCase();
    wrongSentences = pool.slice(0, 3).map(d => {
      const esc = d.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return d.exampleSentence.replace(new RegExp(esc, 'gi'), (match) => {
        const startsUpper = match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase();
        return startsUpper ? targetLower.charAt(0).toUpperCase() + targetLower.slice(1) : targetLower;
      });
    });
    while (wrongSentences.length < 3) wrongSentences.push(`The concept of ${logos.text} was misunderstood by everyone in the room.`);
  }
  const opts = shuffle([correctSentence, ...wrongSentences.slice(0, 3)]);
  return { qType, logos, prompt: `Which sentence uses "${logos.text}" correctly?`, options: opts, correctIndex: opts.indexOf(correctSentence), feedback };
}

const qTypeLabel: Record<QuestionType, string> = {
  blank:   'Fill in the Blank',
  synonym: 'Find the Synonym',
  usage:   'Correct Usage',
  write:   'Write a Sentence',
};

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
  const navigate = useNavigate();
  const location = useLocation();
  const locState = (location.state ?? {}) as { mode?: Mode; step?: number; autoStart?: boolean; manualIds?: string[] };
  const { logoi, setBoutOpen, boutOpen, updateMastery, recordActivity } = usePebbleStore();

  // Panel state
  const [step, setStep]                       = useState(locState.step ?? 0);
  const [mode, setMode]                       = useState<Mode>(locState.mode ?? 'drill');
  const [filter, setFilter]                   = useState<Filter>((locState.manualIds?.length ?? 0) > 0 ? 'manual' : 'starred');
  const [tierFilter, setTierFilter]           = useState<TierFilter>('all');
  const [trainingStyle, setTrainingStyle]     = useState<TrainingStyle>('mixed');
  const [selectedRegisters, setSelectedRegisters] = useState<string[]>([]);
  const [manualSelection, setManualSelection]     = useState<Set<string>>(new Set(locState.manualIds ?? []));

  // Bout state
  const [boutQuestions, setBoutQuestions]   = useState<BoutQuestion[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [qIndex, setQIndex]                 = useState(0);
  const [answered, setAnswered]             = useState<number | null>(null);
  const [boutDone, setBoutDone]             = useState(false);
  const [boutStarred, setBoutStarred]       = useState<Set<string>>(new Set());
  const [endStarred, setEndStarred]         = useState<Set<string>>(new Set());
  const [writeInput, setWriteInput]         = useState('');
  const [evaluating, setEvaluating]         = useState(false);
  const [aiFeedback, setAiFeedback]         = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);

  const currentQ = boutQuestions[qIndex] ?? null;
  const totalQ   = boutQuestions.length;

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
    return r;
  }, [logoi, mode, filter, selectedRegisters, manualSelection]);

  const filteredByTier = useMemo(() => {
    if (tierFilter === 'word')   return filteredByMode.filter(l => l.tier === 'Word');
    if (tierFilter === 'phrase') return filteredByMode.filter(l => l.tier === 'Phrase');
    return filteredByMode;
  }, [filteredByMode, tierFilter]);

  // ── navigation ────────────────────────────────────────────────────────────

  const palGo   = (s: number) => setStep(s);
  const p0Next  = () => { if (mode === 'drill') void startBout(); else palGo(1); };

  // ── bout lifecycle ────────────────────────────────────────────────────────

  const startBout = async () => {
    let pool = [...logoi];
    if (mode === 'drill') {
      const now = new Date();
      const due = pool.filter(l => new Date(l.nextReviewDate) <= now);
      pool = due.length > 0 ? due : pool;
    } else {
      if (filter === 'starred')       pool = pool.filter(l => l.starred);
      else if (filter === 'new')      pool = pool.filter(l => l.masteryLevel === 0);
      else if (filter === 'weak')     pool = pool.filter(l => l.masteryLevel <= 2);
      else if (filter === 'mild')     pool = pool.filter(l => l.masteryLevel === 3);
      else if (filter === 'strong')   pool = pool.filter(l => l.masteryLevel >= 4);
      else if (filter === 'register' && selectedRegisters.length > 0)
        pool = pool.filter(l => selectedRegisters.includes(l.register.toLowerCase()));
      else if (filter === 'manual' && manualSelection.size > 0)
        pool = pool.filter(l => manualSelection.has(l.id));
    }
    if (tierFilter === 'word')   pool = pool.filter(l => l.tier === 'Word');
    if (tierFilter === 'phrase') pool = pool.filter(l => l.tier === 'Phrase');
    if (pool.length === 0) pool = [...logoi];

    setSessionLoading(true);

    // Generate AI content for each word in the pool in parallel
    const distractorTexts = pool.map(l => l.text);
    const contentMap = new Map<string, SessionContent>();
    await Promise.all(pool.map(async (l) => {
      try {
        const hasSyns = !!(l.synonyms?.length);
        const distractors = distractorTexts.filter(t => t !== l.text);
        const content = await generateSessionContent(l.text, l.definition, hasSyns, distractors);
        contentMap.set(l.id, content);
      } catch {
        // fallback to static content for this word
      }
    }));

    setSessionLoading(false);

    let questions: BoutQuestion[];
    if (trainingStyle === 'mixed') {
      questions = shuffle(pool.flatMap(l => {
        const content = contentMap.get(l.id);
        const types: QuestionType[] = ['blank', 'usage', 'write'];
        if (l.synonyms?.length) types.push('synonym');
        return types.map(t => buildQuestion(l, t, logoi, content));
      }));
    } else {
      questions = shuffle(pool).map(l => buildQuestion(l, trainingStyle as QuestionType, logoi, contentMap.get(l.id)));
    }
    setBoutQuestions(questions);
    setSessionResults([]);
    setBoutDone(false);
    setBoutStarred(new Set());
    setQIndex(0);
    setAnswered(null);
    setWriteInput('');
    setAiFeedback(null);
    setBoutOpen(true);
  };

  const recordResult = (logos: Logos, correct: boolean) => {
    setSessionResults(prev => [...prev, { logos, correct }]);
    const newLevel   = correct ? Math.min(logos.masteryLevel + 1, 5) : Math.max(logos.masteryLevel - 1, 0);
    const nextReview = addDays(new Date(), Math.pow(2, newLevel)).toISOString();
    updateMastery(logos.id, correct);
    updateLogos(logos.id, { mastery_level: newLevel, next_review_date: nextReview }).catch(() => {});
  };

  const pickAnswer = (idx: number) => {
    if (answered !== null || !currentQ) return;
    setAnswered(idx);
    const correct = idx === currentQ.correctIndex;
    recordResult(currentQ.logos, correct);
    if (!correct && !currentQ.isRetry) {
      setBoutQuestions(prev => [...prev, { ...currentQ, isRetry: true }]);
    }
  };

  const selfMark = (correct: boolean) => {
    if (answered !== null || !currentQ) return;
    recordResult(currentQ.logos, correct);
    setAnswered(correct ? 0 : -1);
    if (!correct && !currentQ.isRetry) {
      setBoutQuestions(prev => [...prev, { ...currentQ, isRetry: true }]);
    }
  };

  const nextQ = () => {
    if (qIndex < totalQ - 1) {
      setQIndex(i => i + 1);
      setAnswered(null);
      setWriteInput('');
      setAiFeedback(null);
    } else {
      setBoutDone(true);
      recordActivity();
      const today = new Date().toISOString().slice(0, 10);
      recordActivityDb(today).catch(() => {});
    }
  };

  const exitBout = () => { setBoutOpen(false); setBoutDone(false); setStep(mode === 'agora' ? 3 : 0); };

  const toggleStar = () => {
    if (!currentQ) return;
    const id = currentQ.logos.id;
    setBoutStarred(prev => {
      const next      = new Set(prev);
      const nowStarred = !next.has(id);
      if (nowStarred) next.add(id); else next.delete(id);
      updateLogos(id, { starred: nowStarred }).catch(() => {});
      return next;
    });
  };

  useEffect(() => { return () => { setBoutOpen(false); }; }, []);

  const autoStarted = useRef(false);
  useEffect(() => {
    if (locState.autoStart && logoi.length > 0 && !autoStarted.current) {
      autoStarted.current = true;
      void startBout();
    }
  }, [logoi]);

  // Seed endStarred from store + in-session stars when bout ends
  useEffect(() => {
    if (boutDone) {
      setEndStarred(new Set([
        ...logoi.filter(l => l.starred).map(l => l.id),
        ...boutStarred,
      ]));
    }
  }, [boutDone]);

  const toggleEndStar = (id: string) => {
    setEndStarred(prev => {
      const next       = new Set(prev);
      const nowStarred = !next.has(id);
      if (nowStarred) next.add(id); else next.delete(id);
      updateLogos(id, { starred: nowStarred }).catch(() => {});
      return next;
    });
  };

  // ── derived end-screen stats ──────────────────────────────────────────────

  const correctCount = sessionResults.filter(r => r.correct).length;
  const pct          = sessionResults.length > 0 ? Math.round((correctCount / sessionResults.length) * 100) : 0;
  const missed       = sessionResults.filter(r => !r.correct);
  const optLabels    = ['A', 'B', 'C', 'D'];

  // ── filter & style option definitions ────────────────────────────────────

  const filterOpts: { id: Filter; icon: React.ReactNode; name: string; sub: string }[] = [
    {
      id: 'starred', name: 'Starred Words',
      sub: `${logoi.filter(l => l.starred).length} logoi starred`,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="var(--gold)" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    },
    {
      id: 'new', name: 'New',
      sub: `Untrained · ${logoi.filter(l => l.masteryLevel === 0).length} logoi`,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>,
    },
    {
      id: 'weak', name: 'Weakly Known',
      sub: `Mastery 0–2 · ${logoi.filter(l => l.masteryLevel <= 2).length} logoi`,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"/><polyline points="17 18 23 18 23 12"/></svg>,
    },
    {
      id: 'mild', name: 'Mildly Known',
      sub: `Mastery 3 · ${logoi.filter(l => l.masteryLevel === 3).length} logoi`,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
    },
    {
      id: 'strong', name: 'Strong Knowledge',
      sub: `Mastery 4–5 · ${logoi.filter(l => l.masteryLevel >= 4).length} logoi`,
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
    },
    {
      id: 'register', name: 'By Register',
      sub: 'Academic · Literary · Formal…',
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--gold-dim)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
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
                <div className="mc-name">The Drill</div>
                <div className="mc-desc">Your daily spaced repetition session. The algorithm decides what's due — new words, forgotten words, and everything in between.</div>
                <div className="mc-badges">
                  <span className="mc-badge">{logoi.filter(l => new Date(l.nextReviewDate) <= new Date()).length} due today</span>
                  <span className="mc-badge green">{logoi.length} total</span>
                </div>
              </div>
            </div>

            <div className={`mode-card${mode === 'agora' ? ' sel' : ''}`} onClick={() => setMode('agora')}>
              <div className="mc-icon"><AgoraIcon size={26} color={mode === 'agora' ? 'var(--gold)' : 'var(--gold-dim)'} /></div>
              <div className="mc-body">
                <div className="mc-name">The Agora</div>
                <div className="mc-desc">Free practice on your own terms. Filter by starred words, mastery level, or register. You pick the logoi, you set the pace.</div>
                <div className="mc-badges">
                  <span className="mc-badge">{logoi.length} logoi available</span>
                </div>
              </div>
            </div>

            <button className="pal-enter-btn" onClick={p0Next} disabled={logoi.length === 0}
              style={logoi.length === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : undefined}>
              {logoi.length === 0 ? 'Add logoi to begin' : mode === 'drill' ? 'Enter the Palaestra →' : 'Choose Your Logoi →'}
            </button>
          </div>

          {/* PANEL 1 — Agora Filters */}
          <div className="pal-panel">
            <div className="pal-top">
              <button className="pal-back" onClick={() => palGo(0)}><ChevronLeft /></button>
              <div className="pal-step-title">
                <div className="screen-title" style={{ fontSize: 26 }}>The Agora</div>
                <div className="screen-sub">Choose your filter</div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {filterOpts.map(f => (
                <div key={f.id} className={`filter-row-item${filter === f.id ? ' sel' : ''}`} onClick={() => setFilter(f.id)}>
                  <div className="fri-icon">{f.icon}</div>
                  <div className="fri-body">
                    <div className="fri-name">{f.name}</div>
                    <div className="fri-sub">{f.sub}</div>
                  </div>
                  <div className="fri-check">{filter === f.id && <CheckMark />}</div>
                </div>
              ))}
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
              {tierCards.map(t => (
                <div key={t.id} className={`tier-type-card${tierFilter === t.id ? ' sel' : ''}`} onClick={() => setTierFilter(t.id)}>
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
              ))}
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

            <button className="pal-enter-btn" onClick={() => void startBout()}>Enter the Palaestra →</button>
          </div>

          {/* Panel 4 placeholder (slider is 500% wide) */}
          <div className="pal-panel" />
        </div>

        {/* ── LOADING OVERLAY ── */}
        {sessionLoading && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, background: 'var(--bg)' }}>
            <div style={{ width: 36, height: 36, border: '3px solid rgba(212,160,23,.2)', borderTopColor: 'var(--gold)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, color: 'var(--text-dim)', letterSpacing: '.04em' }}>Preparing your session…</div>
          </div>
        )}

        {/* ── THE BOUT ── */}
        {boutOpen && (
          <div className="bout-wrap">

            {boutDone ? (
              /* ── END SCREEN ── */
              <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '24px 20px 20px', gap: 16, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <button className="bout-exit" onClick={exitBout}><ChevronLeft /></button>
                  <div className="bout-title">Session Complete</div>
                </div>

                {/* Score */}
                <div style={{ textAlign: 'center', padding: '12px 0' }}>
                  <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 72, fontWeight: 600, lineHeight: 1, color: pct >= 70 ? 'var(--gold-bright)' : '#f87171' }}>
                    {pct}%
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-dim)', marginTop: 6 }}>
                    {correctCount} of {sessionResults.length} correct
                  </div>
                </div>

                {/* Breakdown */}
                <div className="card" style={{ padding: '14px 16px' }}>
                  <div style={{ display: 'flex' }}>
                    {[
                      { val: correctCount,          label: 'Correct', color: '#4ade80' },
                      { val: missed.length,          label: 'Missed',  color: '#f87171' },
                      { val: sessionResults.length,  label: 'Total',   color: 'var(--gold)' },
                    ].map((stat, i, arr) => (
                      <React.Fragment key={stat.label}>
                        <div style={{ textAlign: 'center', flex: 1 }}>
                          <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.val}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', letterSpacing: '.1em', textTransform: 'uppercase', marginTop: 2 }}>{stat.label}</div>
                        </div>
                        {i < arr.length - 1 && <div style={{ width: 1, background: 'rgba(255,255,255,.07)', margin: '4px 0' }} />}
                      </React.Fragment>
                    ))}
                  </div>
                </div>

                {/* Missed words */}
                {missed.length > 0 && (
                  <>
                    <div className="section-label" style={{ marginBottom: 0 }}>Needs Review</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {missed.map(r => (
                        <div key={r.logos.id} style={{ background: 'rgba(248,113,113,.06)', border: '1px solid rgba(248,113,113,.15)', borderRadius: 10, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontFamily: "'Cormorant Garamond', serif", fontSize: 18, fontStyle: 'italic', color: 'var(--text)' }}>{r.logos.text}</div>
                            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2, lineHeight: 1.5 }}>{r.logos.definition}</div>
                          </div>
                          <button
                            className={`star-btn${endStarred.has(r.logos.id) ? ' starred' : ''}`}
                            onClick={() => toggleEndStar(r.logos.id)}
                          >
                            <StarIcon filled={endStarred.has(r.logos.id)} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* Actions */}
                <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 8 }}>
                  <button className="pal-enter-btn" onClick={() => void startBout()}>Train Again →</button>
                  <button
                    style={{ background: 'none', border: '1px solid rgba(255,255,255,.1)', borderRadius: 12, padding: '12px', fontSize: 14, color: 'var(--text-dim)', cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }}
                    onClick={() => { setBoutOpen(false); setBoutDone(false); setStep(0); }}
                  >
                    Return to Hall
                  </button>
                </div>
              </div>

            ) : currentQ ? (
              /* ── ACTIVE BOUT ── */
              <>
                <div className="bout-top">
                  <button className="bout-exit" onClick={exitBout}><ChevronLeft /></button>
                  <div className="bout-title" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {mode === 'drill' ? <DrillIcon size={16} color="var(--gold)" /> : <AgoraIcon size={16} color="var(--gold)" />}
                    {mode === 'drill' ? 'The Drill' : 'The Agora'}
                  </div>
                  <button className={`bout-star${boutStarred.has(currentQ.logos.id) ? ' starred' : ''}`} onClick={toggleStar}>
                    <StarIcon filled={boutStarred.has(currentQ.logos.id)} />
                  </button>
                </div>

                <div className="bout-prog-wrap">
                  <div className="prog-meta">
                    <span>{qIndex + 1} of {totalQ} logoi</span>
                    <span style={{ color: 'var(--gold)' }}>{qTypeLabel[currentQ.qType]}</span>
                  </div>
                  <div className="prog-bg">
                    <div className="prog-fill" style={{ width: `${((qIndex + 1) / totalQ) * 100}%` }} />
                  </div>
                </div>

                <div className="q-card">
                  <div className="q-type">{qTypeLabel[currentQ.qType]}</div>
                  {currentQ.qType !== 'blank' && (
                    <>
                      <div className="q-word">{currentQ.logos.text}</div>
                      {(currentQ.logos.phonetic || currentQ.logos.pos) && (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
                          {currentQ.logos.phonetic && <span className="lotd-sub">{currentQ.logos.phonetic}</span>}
                          {currentQ.logos.pos && <span className="lotd-pos">{currentQ.logos.pos}</span>}
                        </div>
                      )}
                    </>
                  )}
                  <div className="q-text">
                    {currentQ.qType === 'blank'
                      ? (() => {
                          const [before, after = ''] = currentQ.prompt.split('______');
                          return <>{before}<span className="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>{after}</>;
                        })()
                      : currentQ.prompt
                    }
                  </div>
                </div>

                {currentQ.qType === 'write' ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 20px', marginTop: -8 }}>
                    <textarea
                      style={{ background: 'rgba(255,255,255,.05)', border: '1px solid rgba(255,255,255,.1)', borderRadius: 10, padding: '14px', fontSize: 13, color: 'var(--text)', fontFamily: "'DM Sans', sans-serif", minHeight: 120, resize: 'none', outline: 'none', lineHeight: 1.6 }}
                      placeholder="Write your sentence here…"
                      value={writeInput}
                      onChange={e => setWriteInput(e.target.value)}
                      disabled={answered !== null}
                    />
                    {answered === null && (
                      <button
                        disabled={!writeInput.trim() || evaluating}
                        onClick={async () => {
                          if (!writeInput.trim() || !currentQ) return;
                          setEvaluating(true);
                          try {
                            const result = await evaluateSentence(currentQ.logos.text, currentQ.logos.definition, writeInput);
                            setAiFeedback(result.feedback);
                            selfMark(result.correct);
                          } catch {
                            selfMark(false);
                          } finally {
                            setEvaluating(false);
                          }
                        }}
                        style={{ background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 10, padding: '11px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif", opacity: (!writeInput.trim() || evaluating) ? 0.5 : 1 }}
                      >
                        {evaluating ? 'Evaluating…' : 'Submit →'}
                      </button>
                    )}
                    {answered !== null && (
                      <div className="feedback-bar" style={answered === -1 ? { background: 'rgba(107,26,26,.4)', borderColor: 'rgba(248,113,113,.25)' } : {}}>
                        {answered === 0
                          ? <div className="fb-correct" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Correct
                            </div>
                          : <div className="fb-correct" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f87171' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              Needs work
                            </div>
                        }
                        <div className="fb-note">{aiFeedback ?? currentQ.feedback}</div>
                        <button style={{ marginTop: 6, background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }} onClick={nextQ}>
                          {qIndex < totalQ - 1 ? 'Continue →' : 'Finish Session'}
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <>
                    <div className="ans-opts">
                      {currentQ.options.map((opt, i) => {
                        let cls = '';
                        if (answered !== null) {
                          if (i === currentQ.correctIndex) cls = 'correct';
                          else if (i === answered && i !== currentQ.correctIndex) cls = 'wrong';
                        }
                        return (
                          <button key={i} className={`ans-opt${cls ? ' ' + cls : ''}`} onClick={() => pickAnswer(i)} disabled={answered !== null}>
                            <div className="opt-l">{optLabels[i]}</div>
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {answered !== null && (
                      <div className="feedback-bar" style={answered !== currentQ.correctIndex ? { background: 'rgba(107,26,26,.4)', borderColor: 'rgba(248,113,113,.25)' } : {}}>
                        {answered === currentQ.correctIndex
                          ? <div className="fb-correct" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                              Correct — {currentQ.logos.text}
                            </div>
                          : <div className="fb-correct" style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#f87171' }}>
                              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                              Incorrect — "{currentQ.options[currentQ.correctIndex]}" was correct
                            </div>
                        }
                        <div className="fb-note">{currentQ.feedback}</div>
                        <button style={{ marginTop: 6, background: 'var(--gold)', color: '#000', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: "'DM Sans', sans-serif" }} onClick={nextQ}>
                          {qIndex < totalQ - 1 ? 'Continue →' : 'Finish Session'}
                        </button>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
};
