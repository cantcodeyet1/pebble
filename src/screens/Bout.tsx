import React, { useState, useEffect, useRef, forwardRef, useImperativeHandle } from "react";
import { usePebbleStore, Logos } from "../store";
import { updateLogos } from "../db/logoi";
import { recordActivityDb } from "../db/activity";
import { addDays } from "date-fns";
import {
  evaluateSentence,
  generateSessionContent,
  SessionContent,
  challengeGrading,
  ChallengeResult,
} from "../services/ai.service";

export type Mode = "drill" | "askesis" | "enky";
export type Filter = "starred" | "weak" | "mild" | "strong" | "new" | "register" | "manual" | "random";
export type TierFilter = "all" | "word" | "phrase";
export type TrainingStyle = "mixed" | "blank" | "synonym" | "usage" | "write";
type QuestionType = "blank" | "synonym" | "usage" | "write";

export interface BoutHandle {
  startBout: () => Promise<void>;
}

interface BoutProps {
  mode: Mode;
  filter: Filter;
  tierFilter: TierFilter;
  trainingStyle: TrainingStyle;
  selectedRegisters: string[];
  manualSelection: Set<string>;
  randomIds: string[];
  onExit: (returnToStep: number) => void;
}

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
  if (style !== "mixed") return style as QuestionType;
  const hasSyns = !!logos.synonyms?.length;
  const opts: QuestionType[] = ["blank", "usage"];
  if (hasSyns) opts.push("synonym");
  if (logos.masteryLevel >= 1) opts.push("write");
  return opts[Math.floor(Math.random() * opts.length)];
}

/** For a whole session in mixed mode, build a balanced type list so every
 *  style appears roughly equally rather than clustering by chance. */
function assignMixedTypes(pool: Logos[]): QuestionType[] {
  const base: QuestionType[] = ["blank", "synonym", "usage", "write"];
  const assignments: QuestionType[] = [];
  while (assignments.length < pool.length) {
    assignments.push(...shuffle([...base]));
  }
  return pool.map((l, i) => {
    let t = assignments[i];
    const hasSyns = !!l.synonyms?.length;
    if (t === "synonym" && !hasSyns) t = "blank";
    if (t === "write" && l.masteryLevel < 1) t = "usage";
    return t;
  });
}

function buildQuestion(logos: Logos, qType: QuestionType, all: Logos[], content?: SessionContent): BoutQuestion {
  const pool = shuffle(all.filter((l) => l.id !== logos.id));
  const feedback = logos.definition;

  if (qType === "write") {
    return {
      qType,
      logos,
      prompt: `Use "${logos.text}" in a sentence that demonstrates its meaning.`,
      options: [],
      correctIndex: -1,
      feedback,
    };
  }

  if (qType === "synonym") {
    let correct: string;
    let wrongs: string[];
    if (content?.synonymCorrect && content?.synonymWrongs?.length === 3) {
      correct = content.synonymCorrect;
      wrongs = [...content.synonymWrongs];
    } else {
      correct = logos.synonyms?.[0] ?? logos.text;
      wrongs = pool.slice(0, 3).map((d) => d.synonyms?.[0] ?? d.text);
      while (wrongs.length < 3) wrongs.push(pool[wrongs.length % Math.max(pool.length, 1)]?.text ?? "—");
    }
    const opts = shuffle([correct, ...wrongs.slice(0, 3)]);
    return {
      qType,
      logos,
      prompt: `Which is closest in meaning to "${logos.text}"?`,
      options: opts,
      correctIndex: opts.indexOf(correct),
      feedback,
    };
  }

  if (qType === "blank") {
    const esc = logos.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const isPhrase = logos.text.includes(" ");
    // Always find the exact target word/phrase in the sentence (case-insensitive, first occurrence only).
    const regex = isPhrase ? new RegExp(esc, "i") : new RegExp("\\b" + esc + "\\b", "i");
    const source = logos.exampleSentence;
    const blanked = source.replace(regex, "______");
    const wrongs = pool.slice(0, 3).map((d) => d.text);
    while (wrongs.length < 3) wrongs.push(pool[wrongs.length % Math.max(pool.length, 1)]?.text ?? "—");
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
    wrongSentences = pool.slice(0, 3).map((d) => {
      const esc = d.text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return d.exampleSentence.replace(new RegExp(esc, "gi"), (match) => {
        const startsUpper = match[0] === match[0].toUpperCase() && match[0] !== match[0].toLowerCase();
        return startsUpper ? targetLower.charAt(0).toUpperCase() + targetLower.slice(1) : targetLower;
      });
    });
    while (wrongSentences.length < 3)
      wrongSentences.push(`The concept of ${logos.text} was misunderstood by everyone in the room.`);
  }
  const opts = shuffle([correctSentence, ...wrongSentences.slice(0, 3)]);
  return {
    qType,
    logos,
    prompt: `Which sentence uses "${logos.text}" correctly?`,
    options: opts,
    correctIndex: opts.indexOf(correctSentence),
    feedback,
  };
}

const qTypeLabel: Record<QuestionType, string> = {
  blank: "Fill in the Blank",
  synonym: "Find the Synonym",
  usage: "Correct Usage",
  write: "Write a Sentence",
};

// ── icons ─────────────────────────────────────────────────────────────────────

const ChevronLeft = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

export const DrillIcon = ({ size = 26, color = "var(--gold)" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z" />
  </svg>
);

export const AgoraIcon = ({ size = 26, color = "var(--gold-dim)" }: { size?: number; color?: string }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="3" y1="21" x2="21" y2="21" />
    <line x1="3" y1="10" x2="21" y2="10" />
    <polyline points="3 7 12 3 21 7" />
    <line x1="5" y1="10" x2="5" y2="21" />
    <line x1="9" y1="10" x2="9" y2="21" />
    <line x1="15" y1="10" x2="15" y2="21" />
    <line x1="19" y1="10" x2="19" y2="21" />
  </svg>
);

const CheckMark = () => (
  <svg
    width="10"
    height="10"
    viewBox="0 0 24 24"
    fill="none"
    stroke="#000"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const StarIcon = ({ filled }: { filled: boolean }) => (
  <svg
    width="17"
    height="17"
    viewBox="0 0 24 24"
    fill={filled ? "var(--gold-bright)" : "none"}
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);

// ── component ─────────────────────────────────────────────────────────────────

export const Bout = forwardRef<BoutHandle, BoutProps>(({
  mode,
  filter,
  tierFilter,
  trainingStyle,
  selectedRegisters,
  manualSelection,
  randomIds,
  onExit,
}, ref) => {
  const { logoi, setBoutOpen, boutOpen, updateMastery, recordActivity } = usePebbleStore();

  // Bout state
  const [boutQuestions, setBoutQuestions] = useState<BoutQuestion[]>([]);
  const [sessionResults, setSessionResults] = useState<SessionResult[]>([]);
  const [qIndex, setQIndex] = useState(0);
  const [answered, setAnswered] = useState<number | null>(null);
  const [boutDone, setBoutDone] = useState(false);
  const [boutStarred, setBoutStarred] = useState<Set<string>>(new Set());
  const [endStarred, setEndStarred] = useState<Set<string>>(new Set());
  const [writeInput, setWriteInput] = useState("");
  const [evaluating, setEvaluating] = useState(false);
  const [aiFeedback, setAiFeedback] = useState<string | null>(null);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeInput, setChallengeInput] = useState("");
  const [challenging, setChallenging] = useState(false);
  const [challengeResult, setChallengeResult] = useState<ChallengeResult | null>(null);

  const currentQ = boutQuestions[qIndex] ?? null;
  const totalQ = boutQuestions.length;

  // ── bout lifecycle ────────────────────────────────────────────────────────

  const startBout = async () => {
    let pool = [...logoi];
    if (mode === "drill") {
      const now = new Date();
      const due = pool.filter((l) => new Date(l.nextReviewDate) <= now);
      pool = due.length > 0 ? due : pool;
    } else {
      if (filter === "starred") pool = pool.filter((l) => l.starred);
      else if (filter === "new") pool = pool.filter((l) => l.masteryLevel === 0);
      else if (filter === "weak") pool = pool.filter((l) => l.masteryLevel <= 2);
      else if (filter === "mild") pool = pool.filter((l) => l.masteryLevel === 3);
      else if (filter === "strong") pool = pool.filter((l) => l.masteryLevel >= 4);
      else if (filter === "register" && selectedRegisters.length > 0)
        pool = pool.filter((l) => selectedRegisters.includes(l.register.toLowerCase()));
      else if (filter === "manual" && manualSelection.size > 0) pool = pool.filter((l) => manualSelection.has(l.id));
      else if (filter === "random" && randomIds.length > 0) pool = pool.filter((l) => randomIds.includes(l.id));
    }
    if (tierFilter === "word") pool = pool.filter((l) => l.tier === "Word");
    if (tierFilter === "phrase") pool = pool.filter((l) => l.tier === "Phrase");
    if (pool.length === 0) pool = [...logoi];

    // Cap at 20 logoi, prioritising due-today then weakest mastery
    const SESSION_CAP = 20;
    if (pool.length > SESSION_CAP) {
      const now = new Date();
      pool = [...pool]
        .sort((a, b) => {
          const aDue = new Date(a.nextReviewDate) <= now;
          const bDue = new Date(b.nextReviewDate) <= now;
          if (aDue !== bDue) return aDue ? -1 : 1;
          if (a.masteryLevel !== b.masteryLevel) return a.masteryLevel - b.masteryLevel;
          return Math.random() - 0.5;
        })
        .slice(0, SESSION_CAP);
    }

    setSessionLoading(true);

    // Generate AI content for each word in the pool in parallel
    const distractorTexts = pool.map((l) => l.text);
    const contentMap = new Map<string, SessionContent>();
    await Promise.all(
      pool.map(async (l) => {
        try {
          const hasSyns = !!l.synonyms?.length;
          const distractors = distractorTexts.filter((t) => t !== l.text);
          const content = await generateSessionContent(l.text, l.definition, hasSyns, distractors);
          contentMap.set(l.id, content);
        } catch {
          // fallback to static content for this word
        }
      }),
    );

    setSessionLoading(false);

    let questions: BoutQuestion[];
    if (trainingStyle === "mixed") {
      const shuffledPool = shuffle(pool);
      const types = assignMixedTypes(shuffledPool);
      questions = shuffledPool.map((l, i) => buildQuestion(l, types[i], logoi, contentMap.get(l.id)));
    } else {
      questions = shuffle(pool).map((l) =>
        buildQuestion(l, trainingStyle as QuestionType, logoi, contentMap.get(l.id)),
      );
    }
    setBoutQuestions(questions);
    setSessionResults([]);
    setBoutDone(false);
    setBoutStarred(new Set());
    setQIndex(0);
    setAnswered(null);
    setWriteInput("");
    setAiFeedback(null);
    setChallengeResult(null);
    setChallengeInput("");
    setBoutOpen(true);
  };

  useImperativeHandle(ref, () => ({ startBout }));

  const recordResult = (logos: Logos, correct: boolean) => {
    setSessionResults((prev) => [...prev, { logos, correct }]);
    const newLevel = correct ? Math.min(logos.masteryLevel + 1, 5) : Math.max(logos.masteryLevel - 1, 0);
    const nextReview = addDays(new Date(), Math.pow(2, newLevel)).toISOString();
    updateMastery(logos.id, correct);
    updateLogos(logos.id, {
      mastery_level: newLevel,
      next_review_date: nextReview,
      last_drilled_at: new Date().toISOString(),
    }).catch(() => {});
  };

  const pickAnswer = (idx: number) => {
    if (answered !== null || !currentQ) return;
    setAnswered(idx);
    const correct = idx === currentQ.correctIndex;
    recordResult(currentQ.logos, correct);
    if (!correct && !currentQ.isRetry) {
      setBoutQuestions((prev) => [...prev, { ...currentQ, isRetry: true }]);
    }
  };

  const selfMark = (correct: boolean) => {
    if (answered !== null || !currentQ) return;
    recordResult(currentQ.logos, correct);
    setAnswered(correct ? 0 : -1);
    if (!correct && !currentQ.isRetry) {
      setBoutQuestions((prev) => [...prev, { ...currentQ, isRetry: true }]);
    }
  };

  const nextQ = () => {
    if (qIndex < totalQ - 1) {
      setQIndex((i) => i + 1);
      setAnswered(null);
      setWriteInput("");
      setAiFeedback(null);
      setChallengeResult(null);
      setChallengeInput("");
    } else {
      setBoutDone(true);
      if (mode === "drill") {
        recordActivity();
        const today = new Date().toISOString().slice(0, 10);
        recordActivityDb(today).catch(() => {});
      }
    }
  };

  const exitBout = () => {
    setBoutOpen(false);
    setBoutDone(false);
    onExit(mode === "enky" ? 3 : 0);
  };

  const toggleStar = () => {
    if (!currentQ) return;
    const id = currentQ.logos.id;
    setBoutStarred((prev) => {
      const next = new Set(prev);
      const nowStarred = !next.has(id);
      if (nowStarred) next.add(id);
      else next.delete(id);
      updateLogos(id, { starred: nowStarred }).catch(() => {});
      return next;
    });
  };

  const handleChallenge = async () => {
    if (!challengeInput.trim() || !currentQ) return;
    setChallenging(true);
    try {
      const result = await challengeGrading(
        currentQ.logos.text,
        writeInput,
        aiFeedback ?? currentQ.feedback,
        challengeInput,
      );
      setChallengeResult(result);
      setChallengeOpen(false);
      setChallengeInput("");
      if (result.accepted) {
        setSessionResults((prev) => {
          const lastIdx = [...prev].reverse().findIndex((r) => r.logos.id === currentQ.logos.id);
          if (lastIdx === -1) return prev;
          const actualIdx = prev.length - 1 - lastIdx;
          return prev.map((r, i) => (i === actualIdx ? { ...r, correct: true } : r));
        });
        // Undo the incorrect penalty then apply correct: two updateMastery(true) calls
        // bring store from (original-1) → original → original+1
        updateMastery(currentQ.logos.id, true);
        updateMastery(currentQ.logos.id, true);
        const newLevel = Math.min(currentQ.logos.masteryLevel + 1, 5);
        const nextReview = addDays(new Date(), Math.pow(2, newLevel)).toISOString();
        updateLogos(currentQ.logos.id, {
          mastery_level: newLevel,
          next_review_date: nextReview,
          last_drilled_at: new Date().toISOString(),
        }).catch(() => {});
      }
    } catch {
      // silent — leave feedback bar as-is
    } finally {
      setChallenging(false);
    }
  };

  useEffect(() => {
    return () => {
      setBoutOpen(false);
    };
  }, []);

  // Seed endStarred from store + in-session stars when bout ends
  useEffect(() => {
    if (boutDone) {
      setEndStarred(new Set([...logoi.filter((l) => l.starred).map((l) => l.id), ...boutStarred]));
    }
  }, [boutDone]);

  const toggleEndStar = (id: string) => {
    setEndStarred((prev) => {
      const next = new Set(prev);
      const nowStarred = !next.has(id);
      if (nowStarred) next.add(id);
      else next.delete(id);
      updateLogos(id, { starred: nowStarred }).catch(() => {});
      return next;
    });
  };

  // ── derived end-screen stats ──────────────────────────────────────────────

  const correctCount = sessionResults.filter((r) => r.correct).length;
  const pct = sessionResults.length > 0 ? Math.round((correctCount / sessionResults.length) * 100) : 0;
  const missed = sessionResults.filter((r) => !r.correct);
  const optLabels = ["A", "B", "C", "D"];

  // ── render ────────────────────────────────────────────────────────────────

  if (!boutOpen && !sessionLoading) return null;

  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      {/* ── LOADING OVERLAY ── */}
      {sessionLoading && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 200,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            background: "var(--bg)",
          }}
        >
          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path
              d="M12 2L3 7v5c0 5.25 3.75 10.15 9 11.35C17.25 22.15 21 17.25 21 12V7L12 2z"
              style={{ strokeDasharray: 57, animation: "shieldDraw 2.4s ease-in-out infinite" }}
            />
          </svg>
          <div
            style={{
              fontFamily: "'Cormorant Garamond', serif",
              fontSize: 18,
              color: "var(--text-dim)",
              letterSpacing: ".04em",
            }}
          >
            Preparing your session…
          </div>
        </div>
      )}

      {/*{/* ── THE BOUT ── */}
      {boutOpen && (
        <div className="bout-wrap">
          {boutDone ? (
            /* ── END SCREEN ── */
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                height: "100%",
                padding: "24px 20px 20px",
                gap: 16,
                overflowY: "auto",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <button className="bout-exit" onClick={exitBout}>
                  <ChevronLeft />
                </button>
                <div className="bout-title">Session Complete</div>
              </div>

              {/* Score */}
              <div style={{ textAlign: "center", padding: "12px 0" }}>
                <div
                  style={{
                    fontFamily: "'Cormorant Garamond', serif",
                    fontSize: 72,
                    fontWeight: 600,
                    lineHeight: 1,
                    color: pct >= 70 ? "var(--gold-bright)" : "#f87171",
                  }}
                >
                  {pct}%
                </div>
                <div style={{ fontSize: 13, color: "var(--text-dim)", marginTop: 6 }}>
                  {correctCount} of {sessionResults.length} correct
                </div>
              </div>

              {/* Breakdown */}
              <div className="card" style={{ padding: "14px 16px" }}>
                <div style={{ display: "flex" }}>
                  {[
                    { val: correctCount, label: "Correct", color: "#4ade80" },
                    { val: missed.length, label: "Missed", color: "#f87171" },
                    { val: sessionResults.length, label: "Total", color: "var(--gold)" },
                  ].map((stat, i, arr) => (
                    <React.Fragment key={stat.label}>
                      <div style={{ textAlign: "center", flex: 1 }}>
                        <div style={{ fontSize: 24, fontWeight: 700, color: stat.color }}>{stat.val}</div>
                        <div
                          style={{
                            fontSize: 10,
                            color: "var(--text-dim)",
                            letterSpacing: ".1em",
                            textTransform: "uppercase",
                            marginTop: 2,
                          }}
                        >
                          {stat.label}
                        </div>
                      </div>
                      {i < arr.length - 1 && (
                        <div style={{ width: 1, background: "rgba(255,255,255,.07)", margin: "4px 0" }} />
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Missed words */}
              {missed.length > 0 && (
                <>
                  <div className="section-label" style={{ marginBottom: 0 }}>
                    Needs Review
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {missed.map((r) => (
                      <div
                        key={r.logos.id}
                        style={{
                          background: "rgba(248,113,113,.06)",
                          border: "1px solid rgba(248,113,113,.15)",
                          borderRadius: 10,
                          padding: "10px 14px",
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontFamily: "'Cormorant Garamond', serif",
                              fontSize: 18,
                              fontStyle: "italic",
                              color: "var(--text)",
                            }}
                          >
                            {r.logos.text}
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-dim)", marginTop: 2, lineHeight: 1.5 }}>
                            {r.logos.definition}
                          </div>
                        </div>
                        <button
                          className={`star-btn${endStarred.has(r.logos.id) ? " starred" : ""}`}
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
              <div style={{ marginTop: "auto", display: "flex", flexDirection: "column", gap: 8, paddingTop: 8 }}>
                <button className="pal-enter-btn" onClick={() => void startBout()}>
                  Train Again →
                </button>
                <button
                  style={{
                    background: "none",
                    border: "1px solid rgba(255,255,255,.1)",
                    borderRadius: 12,
                    padding: "12px",
                    fontSize: 14,
                    color: "var(--text-dim)",
                    cursor: "pointer",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                  onClick={() => {
                    setBoutOpen(false);
                    setBoutDone(false);
                    onExit(0);
                  }}
                >
                  Return to Hall
                </button>
              </div>
            </div>
          ) : currentQ ? (
            /* ── ACTIVE BOUT ── */
            <>
              <div className="bout-top">
                <button className="bout-exit" onClick={exitBout}>
                  <ChevronLeft />
                </button>
                <div className="bout-title" style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  {mode === "drill" ? (
                    <DrillIcon size={16} color="var(--gold)" />
                  ) : (
                    <AgoraIcon size={16} color="var(--gold)" />
                  )}
                  {mode === "drill" ? "Agon" : mode === "enky" ? "Enky" : "Askesis"}
                </div>
                <button
                  className={`bout-star${boutStarred.has(currentQ.logos.id) ? " starred" : ""}`}
                  onClick={toggleStar}
                >
                  <StarIcon filled={boutStarred.has(currentQ.logos.id)} />
                </button>
              </div>

              <div className="bout-prog-wrap">
                <div className="prog-meta">
                  <span>
                    {qIndex + 1} of {totalQ} logoi
                  </span>
                  <span style={{ color: "var(--gold)" }}>{qTypeLabel[currentQ.qType]}</span>
                </div>
                <div className="prog-bg">
                  <div className="prog-fill" style={{ width: `${((qIndex + 1) / totalQ) * 100}%` }} />
                </div>
              </div>

              <div className="q-card">
                <div className="q-type">{qTypeLabel[currentQ.qType]}</div>
                {currentQ.qType !== "blank" && (
                  <>
                    <div className="q-word">{currentQ.logos.text}</div>
                    {(currentQ.logos.phonetic || currentQ.logos.pos) && (
                      <div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 2 }}>
                        {currentQ.logos.phonetic && <span className="lotd-sub">{currentQ.logos.phonetic}</span>}
                        {currentQ.logos.pos && <span className="lotd-pos">{currentQ.logos.pos}</span>}
                      </div>
                    )}
                  </>
                )}
                <div className="q-text">
                  {currentQ.qType === "blank"
                    ? (() => {
                        const [before, after = ""] = currentQ.prompt.split("______");
                        return (
                          <>
                            {before}
                            <span className="blank">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                            {after}
                          </>
                        );
                      })()
                    : currentQ.prompt}
                </div>
              </div>

              {currentQ.qType === "write" ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10, padding: "0 20px", marginTop: -8 }}>
                  <textarea
                    style={{
                      background: "rgba(255,255,255,.05)",
                      border: "1px solid rgba(255,255,255,.1)",
                      borderRadius: 10,
                      padding: "14px",
                      fontSize: 13,
                      color: "var(--text)",
                      fontFamily: "'DM Sans', sans-serif",
                      minHeight: 120,
                      resize: "none",
                      outline: "none",
                      lineHeight: 1.6,
                    }}
                    placeholder="Write your sentence here…"
                    value={writeInput}
                    onChange={(e) => setWriteInput(e.target.value)}
                    disabled={answered !== null}
                  />
                  {answered === null && (
                    <button
                      disabled={!writeInput.trim() || evaluating}
                      onClick={async () => {
                        if (!writeInput.trim() || !currentQ) return;
                        setEvaluating(true);
                        try {
                          const result = await evaluateSentence(
                            currentQ.logos.text,
                            currentQ.logos.definition,
                            writeInput,
                          );
                          setAiFeedback(result.feedback);
                          selfMark(result.correct);
                        } catch {
                          selfMark(false);
                        } finally {
                          setEvaluating(false);
                        }
                      }}
                      style={{
                        background: "var(--gold)",
                        color: "#000",
                        border: "none",
                        borderRadius: 10,
                        padding: "11px",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        fontFamily: "'DM Sans', sans-serif",
                        opacity: !writeInput.trim() || evaluating ? 0.5 : 1,
                      }}
                    >
                      {evaluating ? "Evaluating…" : "Submit →"}
                    </button>
                  )}
                  {answered !== null && (
                    <div
                      className="feedback-bar"
                      style={
                        challengeResult?.accepted
                          ? { background: "rgba(26,107,26,.4)", borderColor: "rgba(74,222,128,.25)" }
                          : answered === -1 && !challengeResult
                            ? { background: "rgba(107,26,26,.4)", borderColor: "rgba(248,113,113,.25)" }
                            : {}
                      }
                    >
                      {challengeResult ? (
                        <>
                          <div
                            className="fb-correct"
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 6,
                              color: challengeResult.accepted ? "#4ade80" : "#f87171",
                            }}
                          >
                            {challengeResult.accepted ? (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#4ade80"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                            ) : (
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#f87171"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                            )}
                            {challengeResult.accepted ? "Accepted" : "Challenge Rejected"}
                          </div>
                          <div className="fb-note">{challengeResult.verdict}</div>
                          <div className="fb-note" style={{ marginTop: 4, opacity: 0.75 }}>
                            {challengeResult.learning}
                          </div>
                        </>
                      ) : (
                        <>
                          {answered === 0 ? (
                            <div className="fb-correct" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#4ade80"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <polyline points="20 6 9 17 4 12" />
                              </svg>
                              Correct
                            </div>
                          ) : (
                            <div
                              className="fb-correct"
                              style={{ display: "flex", alignItems: "center", gap: 6, color: "#f87171" }}
                            >
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="#f87171"
                                strokeWidth="2.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                              </svg>
                              Needs work
                            </div>
                          )}
                          <div className="fb-note">{aiFeedback ?? currentQ.feedback}</div>
                          {answered === -1 && (
                            <button
                              onClick={() => setChallengeOpen(true)}
                              style={{
                                background: "none",
                                border: "none",
                                color: "rgba(248,113,113,.75)",
                                fontSize: 12,
                                cursor: "pointer",
                                padding: "4px 0 0",
                                textDecoration: "underline",
                                fontFamily: "'DM Sans', sans-serif",
                                textAlign: "left",
                              }}
                            >
                              Challenge this →
                            </button>
                          )}
                        </>
                      )}
                      <button
                        style={{
                          marginTop: 8,
                          background: "var(--gold)",
                          color: "#000",
                          border: "none",
                          borderRadius: 10,
                          padding: "9px 18px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                        onClick={nextQ}
                      >
                        {qIndex < totalQ - 1 ? "Continue →" : "Finish Session"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="ans-opts">
                    {currentQ.options.map((opt, i) => {
                      let cls = "";
                      if (answered !== null) {
                        if (i === currentQ.correctIndex) cls = "correct";
                        else if (i === answered && i !== currentQ.correctIndex) cls = "wrong";
                      }
                      return (
                        <button
                          key={i}
                          className={`ans-opt${cls ? " " + cls : ""}`}
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
                    <div
                      className="feedback-bar"
                      style={
                        answered !== currentQ.correctIndex
                          ? { background: "rgba(107,26,26,.4)", borderColor: "rgba(248,113,113,.25)" }
                          : {}
                      }
                    >
                      {answered === currentQ.correctIndex ? (
                        <div className="fb-correct" style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#4ade80"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          Correct — {currentQ.logos.text}
                        </div>
                      ) : (
                        <div
                          className="fb-correct"
                          style={{ display: "flex", alignItems: "center", gap: 6, color: "#f87171" }}
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="#f87171"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          Incorrect — "{currentQ.options[currentQ.correctIndex]}" was correct
                        </div>
                      )}
                      <div className="fb-note">{currentQ.feedback}</div>
                      <button
                        style={{
                          marginTop: 6,
                          background: "var(--gold)",
                          color: "#000",
                          border: "none",
                          borderRadius: 10,
                          padding: "9px 18px",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "'DM Sans', sans-serif",
                        }}
                        onClick={nextQ}
                      >
                        {qIndex < totalQ - 1 ? "Continue →" : "Finish Session"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </>
          ) : null}
        </div>
      )}

      {/* Challenge overlay */}
      {challengeOpen && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,.65)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 200,
            padding: "0 24px",
          }}
          onClick={() => {
            if (!challenging) {
              setChallengeOpen(false);
              setChallengeInput("");
            }
          }}
        >
          <div
            style={{
              background: "var(--glass)",
              backdropFilter: "blur(24px)",
              WebkitBackdropFilter: "blur(24px)",
              border: "1px solid var(--glass-border)",
              borderRadius: 20,
              padding: "28px 24px",
              width: "100%",
              maxWidth: 342,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                fontFamily: "'Cormorant Garamond', serif",
                fontSize: 26,
                fontWeight: 600,
                fontStyle: "italic",
                color: "var(--text)",
                marginBottom: 6,
              }}
            >
              Make Your Case
            </div>
            <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 18, lineHeight: 1.5 }}>
              Argue why your sentence is correct.
            </div>
            <textarea
              style={{
                width: "100%",
                background: "rgba(255,255,255,.05)",
                border: "1px solid rgba(255,255,255,.1)",
                borderRadius: 10,
                padding: "14px",
                fontSize: 13,
                color: "var(--text)",
                fontFamily: "'DM Sans', sans-serif",
                minHeight: 120,
                resize: "none",
                outline: "none",
                lineHeight: 1.6,
                boxSizing: "border-box",
              }}
              placeholder="Make your argument here…"
              value={challengeInput}
              onChange={(e) => setChallengeInput(e.target.value)}
              disabled={challenging}
              autoFocus
            />
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                onClick={() => {
                  setChallengeOpen(false);
                  setChallengeInput("");
                }}
                disabled={challenging}
                style={{
                  flex: 1,
                  background: "rgba(255,255,255,.04)",
                  border: "1px solid var(--glass-border)",
                  borderRadius: 12,
                  padding: "12px",
                  fontSize: 14,
                  color: "var(--text-dim)",
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  void handleChallenge();
                }}
                disabled={!challengeInput.trim() || challenging}
                style={{
                  flex: 1,
                  background: "var(--gold)",
                  color: "#000",
                  border: "none",
                  borderRadius: 12,
                  padding: "12px",
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                  fontFamily: "'DM Sans', sans-serif",
                  opacity: !challengeInput.trim() || challenging ? 0.5 : 1,
                }}
              >
                {challenging ? "Reviewing…" : "Submit Challenge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});
