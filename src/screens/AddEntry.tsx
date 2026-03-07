import React, { useState, useEffect } from 'react';
import { usePebbleStore, Tier, Register } from '../store';
import { addLogos as dbAddLogos } from '../db/logoi';

const tiers: Tier[] = ['Word', 'Phrase', 'Collocation'];
const registers: Register[] = ['Formal', 'Academic', 'Literary', 'Informal', 'Idiomatic'];

const DEFAULT = {
  tier: 'Word' as Tier,
  register: 'Formal' as Register,
  def: '"Expressing or promoting a particular cause or point of view; having an underlying purpose."',
  ex: '"The report was tendentious, framing every statistic to support a predetermined conclusion."',
  syns: ['Biased', 'Partisan', 'Slanted'],
};

export const AddEntry = () => {
  const addOpen = usePebbleStore(s => s.addOpen);
  const setAddOpen = usePebbleStore(s => s.setAddOpen);
  const addLogos = usePebbleStore(s => s.addLogos);
  const appendLogos = usePebbleStore(s => s.appendLogos);

  const [text, setText] = useState('');
  const [source, setSource] = useState('');
  const [tier, setTier] = useState<Tier>(DEFAULT.tier);
  const [register, setRegister] = useState<Register>(DEFAULT.register);
  const [aiDef, setAiDef] = useState(DEFAULT.def);
  const [aiEx, setAiEx] = useState(DEFAULT.ex);
  const [aiSyns, setAiSyns] = useState<string[]>(DEFAULT.syns);
  const [analyzing, setAnalyzing] = useState(false);

  // Reset state when sheet opens
  useEffect(() => {
    if (addOpen) {
      setText('');
      setSource('');
      setTier(DEFAULT.tier);
      setRegister(DEFAULT.register);
      setAiDef(DEFAULT.def);
      setAiEx(DEFAULT.ex);
      setAiSyns(DEFAULT.syns);
      setAnalyzing(false);
    }
  }, [addOpen]);

  useEffect(() => {
    if (text.length > 3) {
      setAnalyzing(true);
      const t = setTimeout(() => {
        setAnalyzing(false);
        if (text.includes(' ')) {
          setTier('Phrase');
          setRegister('Idiomatic');
          setAiDef(`"A common expression or idiom conveying a particular idea."`);
          setAiEx(`"He had to bite the bullet and accept the consequences."`);
          setAiSyns(['Related idiom', 'Equivalent phrase']);
        } else {
          setTier('Word');
          setRegister('Formal');
          setAiDef(`"Expressing or promoting a particular cause or point of view; having an underlying purpose."`);
          setAiEx(`"The report was ${text.toLowerCase()}, framing every statistic to support a predetermined conclusion."`);
          setAiSyns(['Biased', 'Partisan', 'Slanted']);
        }
      }, 900);
      return () => clearTimeout(t);
    } else if (text.length === 0) {
      setAnalyzing(false);
      setTier(DEFAULT.tier);
      setRegister(DEFAULT.register);
      setAiDef(DEFAULT.def);
      setAiEx(DEFAULT.ex);
      setAiSyns(DEFAULT.syns);
    }
  }, [text]);

  const close = () => setAddOpen(false);

  const handleSave = async () => {
    if (!text) return;
    const entry           = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    const definition      = aiDef.replace(/^"|"$/g, '');
    const exampleSentence = aiEx.replace(/^"|"$/g, '');

    try {
      // Persist to SQLite; returned Logos is already mapped to store shape
      const saved = await dbAddLogos({
        entry:    entry,
        tier:     tier.toLowerCase(),
        definition,
        example:  exampleSentence,
        source:   source || null,
        register: register.toLowerCase(),
      });
      appendLogos(saved);
    } catch (err) {
      // DB unavailable (e.g. cold dev start) — fall back to in-memory only
      console.warn('[Pebble] DB write failed — in-memory only:', err);
      addLogos({ text: entry, tier, definition, exampleSentence, sourceSentence: source || undefined, register });
    }

    close();
  };

  return (
    <div
      className={`add-backdrop${addOpen ? ' open' : ''}`}
      onClick={e => { if (e.target === e.currentTarget) close(); }}
    >
      <div className="add-sheet">
        <div className="sheet-handle" />

        <div className="add-hdr">
          <button className="add-cls" onClick={close}>✕</button>
          <div className="add-ttl">New Logos</div>
          <button className="add-sv" onClick={() => { void handleSave(); }} disabled={!text}>Save</button>
        </div>

        <input
          className="lmi"
          placeholder="Enter logos…"
          value={text}
          onChange={e => setText(e.target.value)}
          autoFocus={addOpen}
        />

        <div>
          <div className="field-lbl">Source Context (Optional)</div>
          <textarea
            className="src-txt"
            placeholder="Where did you encounter this?"
            value={source}
            onChange={e => setSource(e.target.value)}
          />
        </div>

        {/* AI card — always visible */}
        <div className="ai-card-add">
          <div className="ai-hdr">
            <div className="ai-pulse" />
            <div className="ai-lbl">{analyzing ? 'Analysing…' : 'AI Classification'}</div>
          </div>

          <div className="ai-tr">
            {tiers.map(t => (
              <button
                key={t}
                className={`ai-to${tier === t ? ' sel' : ''}`}
                onClick={() => setTier(t)}
              >
                {t}
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {registers.map(r => (
              <button
                key={r}
                className={`reg-opt${register === r ? ' active' : ''}`}
                onClick={() => setRegister(r)}
              >
                {r}
              </button>
            ))}
          </div>

          <div className="ai-def">{aiDef}</div>
          <div className="ai-ex">{aiEx}</div>

          <div className="syn-row">
            {aiSyns.map(s => <span className="syn-chip" key={s}>{s}</span>)}
          </div>
        </div>
      </div>
    </div>
  );
};
