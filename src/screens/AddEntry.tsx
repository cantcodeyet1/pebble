import React, { useState, useEffect } from "react";
import { usePebbleStore, Tier, Register } from "../store";
import { addLogos as dbAddLogos } from "../db/logoi";
import { classify } from "../services/ai.service";

const tiers: Tier[] = ["Word", "Phrase"];
const registers: Register[] = ["Formal", "Academic", "Literary", "Informal", "Idiomatic"];


export const AddEntry = () => {
  const addOpen = usePebbleStore((s) => s.addOpen);
  const setAddOpen = usePebbleStore((s) => s.setAddOpen);
  const addLogos = usePebbleStore((s) => s.addLogos);
  const appendLogos = usePebbleStore((s) => s.appendLogos);

  const [text, setText] = useState("");
  const [contextSentence, setContextSentence] = useState("");
  const [source, setSource] = useState("");
  const [tier, setTier] = useState<Tier>('');
  const [register, setRegister] = useState<Register>('');
  const [aiDef, setAiDef] = useState('');
  const [aiEx, setAiEx] = useState('');
  const [aiSyns, setAiSyns] = useState<string[]>([]);
  const [aiPos, setAiPos] = useState('');
  const [aiPhonetic, setAiPhonetic] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [offline, setOffline] = useState(false);

  // Reset state when sheet opens
  useEffect(() => {
    if (addOpen) {
      setText("");
      setContextSentence("");
      setSource("");
      setTier('');
      setRegister('');
      setAiDef('');
      setAiEx('');
      setAiSyns([]);
      setAiPos('');
      setAiPhonetic('');
      setAnalyzing(false);
      setOffline(false);
    }
  }, [addOpen]);

  useEffect(() => {
    if (text.length < 3) return;
    setOffline(false);
    const t = setTimeout(async () => {
      setAnalyzing(true);
      try {
        const logos = await classify(text, contextSentence || undefined);
        setTier(logos.tier as Tier);
        setRegister(logos.register as Register);
        setAiDef(logos.definition ?? '');
        setAiEx(logos.sentence ?? '');
        setAiSyns(logos.synonyms ?? []);
        setAiPos(logos.pos ?? '');
        setAiPhonetic(logos.phonetic ?? '');
      } catch (error) {
        const isNetworkError = !navigator.onLine
          || (error instanceof TypeError && /fetch|network|failed/i.test((error as Error).message));
        if (isNetworkError) {
          setOffline(true);
        } else {
          console.log(error);
        }
      } finally {
        setAnalyzing(false);
      }
    }, 900);
    return () => clearTimeout(t);
  }, [text, contextSentence]);

  const close = () => setAddOpen(false);

  const aiLocked = !analyzing && !!tier && !!register;

  const handleSave = async () => {
    if (!text) return;
    const entry = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    const definition = (aiDef || '').replace(/^"|"$/g, "");
    const exampleSentence = (aiEx || '').replace(/^"|"$/g, "");

    try {
      const saved = await dbAddLogos(offline ? {
        entry,
        tier: '',
        definition: '',
        example: '',
        source: source || null,
        contextSentence: contextSentence || null,
        register: '',
        phonetic: '',
        pos: '',
        synonyms: [],
        enriched: false,
      } : {
        entry,
        tier: (tier || '').toLowerCase(),
        definition,
        example: exampleSentence,
        source: source || null,
        contextSentence: contextSentence || null,
        register: (register || '').toLowerCase(),
        phonetic: aiPhonetic,
        pos: aiPos,
        synonyms: aiSyns,
        enriched: true,
      });
      appendLogos(saved);
    } catch (err) {
      console.warn("[Pebble] DB write failed — in-memory only:", err);
      addLogos({ text: entry, tier, definition, exampleSentence, contextSentence: contextSentence || undefined, source: source || undefined, register });
    }

    close();
  };

  return (
    <div
      className={`add-backdrop${addOpen ? " open" : ""}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="add-sheet">
        <div className="sheet-handle" />

        <div className="add-hdr">
          <button className="add-cls" onClick={close}>
            ✕
          </button>
          <div className="add-ttl">New Logos</div>
          <button
            className="add-sv"
            onClick={() => {
              void handleSave();
            }}
            disabled={!text}
          >
            Save
          </button>
        </div>

        <input
          className="lmi"
          placeholder="Enter logos…"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value.length > 0) setAnalyzing(true);
          }}
          autoFocus={addOpen}
        />

        <div>
          <div className="field-lbl">Context Sentence <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(Optional)</span></div>
          <textarea
            className="src-txt"
            placeholder="The sentence where you encountered this word or phrase…"
            value={contextSentence}
            onChange={(e) => setContextSentence(e.target.value)}
          />
        </div>

        <div>
          <div className="field-lbl">Source <span style={{ color: 'var(--text-dim)', fontWeight: 400 }}>(Optional)</span></div>
          <input
            className="lmi"
            style={{ marginTop: 0 }}
            placeholder="e.g. Crime and Punishment, Churchill…"
            value={source}
            onChange={(e) => setSource(e.target.value)}
          />
        </div>

        {/* Offline notice */}
        {offline && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 13px', borderRadius: 8,
            background: 'rgba(251,191,36,.08)',
            border: '1px solid rgba(251,191,36,.22)',
            color: '#fbbf24', fontSize: 12,
            fontFamily: "'DM Sans', sans-serif", lineHeight: 1.4,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
              <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            No connection — word will be classified when you reconnect
          </div>
        )}

        {/* AI card — hidden when offline */}
        {!offline && <div className="ai-card-add">
          <div className="ai-hdr">
            <div className="ai-pulse" />
            <div className="ai-lbl">{analyzing ? "Analysing…" : "AI Classification"}</div>
            {!analyzing && (aiPhonetic || aiPos) && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
                {aiPhonetic && <span className="lotd-sub">{aiPhonetic}</span>}
                {aiPos && <span className="lotd-pos">{aiPos}</span>}
              </div>
            )}
          </div>

          {text.length === 0 ? (
            <div className="ai-empty">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <circle cx="11" cy="11" r="8" />
                <path d="M21 21l-4.35-4.35" />
              </svg>
              <span>Enter a word or phrase above to classify</span>
            </div>
          ) : analyzing ? (
            <div className="ai-skel">
              <div className="ai-skel-row">
                <div className="skel-btn" />
                <div className="skel-btn" />
              </div>
              <div className="ai-skel-row" style={{ gap: 6 }}>
                <div className="skel-chip" style={{ width: 52 }} />
                <div className="skel-chip" style={{ width: 68 }} />
                <div className="skel-chip" style={{ width: 58 }} />
                <div className="skel-chip" style={{ width: 48 }} />
              </div>
              <div className="skel-line" style={{ width: "92%" }} />
              <div className="skel-line" style={{ width: "75%" }} />
              <div className="skel-line" style={{ width: "83%", marginTop: 4 }} />
            </div>
          ) : (
            <>
              <div className="ai-tr">
                {tiers.map((t) => (
                  <button key={t} className={`ai-to${tier === t ? " sel" : ""}`} onClick={() => setTier(t)} disabled={aiLocked && tier !== t}>
                    {t}
                  </button>
                ))}
              </div>

              <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>
                {registers.map((r) => (
                  <button
                    key={r}
                    className={`reg-opt${register === r ? " active" : ""}`}
                    onClick={() => setRegister(r)}
                    disabled={aiLocked && register !== r}
                  >
                    {r}
                  </button>
                ))}
              </div>

              <div className="ai-def">{aiDef}</div>
              <div className="ai-ex">{aiEx}</div>

              <div className="syn-row">
                {aiSyns.map((s) => (
                  <span className="syn-chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>}
      </div>
    </div>
  );
};
