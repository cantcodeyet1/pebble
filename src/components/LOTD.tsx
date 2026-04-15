import React, { useState, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePebbleStore } from "../store";
import { addLogos as dbAddLogos } from "../db/logoi";
import type { SlideData } from "../store";
import LogoiAudio from "./LogoiAudio";

const FALLBACK_SLIDES: SlideData[] = [
  {
    tier: "Word",
    tc: "tb-word",
    word: "Ephemeral",
    ipa: "/ɪˈfem.ər.əl/",
    pos: "Adjective",
    register: "literary",
    def: '"Lasting for a very short time; transitory."',
    ex: '"The beauty of the sunset was ephemeral, fading into darkness within minutes."',
    syns: ["Transient", "Fleeting", "Momentary"],
    btnLabel: "Train this word →",
  },
  {
    tier: "Phrase",
    tc: "tb-phrase",
    word: "Bite the bullet",
    ipa: "",
    pos: "Idiomatic Expression",
    register: "informal",
    def: '"To endure a painful or difficult situation that is unavoidable."',
    ex: '"I had to bite the bullet and rewrite the entire proposal from scratch."',
    syns: ["Endure", "Soldier on", "Grin and bear it"],
    btnLabel: "Train this phrase →",
  },
];

export const LOTD = () => {
  const { logoi, appendLogos, todaySlides } = usePebbleStore();
  const slides = todaySlides ?? FALLBACK_SLIDES;

  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const goSlide = (i: number) => setSlide(Math.max(0, Math.min(slides.length - 1, i)));
  const isSaved = (i: number) => logoi.some((l) => l.text.toLowerCase() === slides[i].word.toLowerCase());

  const saveSlide = async (i: number) => {
    if (isSaved(i)) return logoi.find((l) => l.text.toLowerCase() === slides[i].word.toLowerCase()) ?? null;
    const s = slides[i];
    try {
      const result = await dbAddLogos({
        entry: s.word,
        tier: s.tier.toLowerCase(),
        definition: s.def.replace(/^"|"$/g, ""),
        example: s.ex.replace(/^"|"$/g, ""),
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
      navigate("/palaestra", { state: { mode: "agora", step: 3, manualIds: [logos.id] } });
    } else {
      navigate("/palaestra");
    }
  };
  const dragStartRef = useRef<number | null>(null);
  const dragDeltaRef = useRef(0);

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

  const [forceLoading, setForceLoading] = useState(false); // Set to false to exit

  const slidesStatus = forceLoading ? "loading" : usePebbleStore.getState().slidesStatus;

  return (
    <>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div
          className="lotd-carousel-wrap"
          onMouseDown={(e) => onDragStart(e.clientX)}
          onMouseMove={(e) => onDragMove(e.clientX)}
          onMouseUp={onDragEnd}
          onTouchStart={(e) => onDragStart(e.touches[0].clientX)}
          onTouchMove={(e) => onDragMove(e.touches[0].clientX)}
          onTouchEnd={onDragEnd}
          style={{ touchAction: "pan-y" }}
        >
          <div className="lotd-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
            {slides.map((s, i) => (
              <div className="lotd-slide" key={i}>
                {slidesStatus === "loading" ? (
                  <div className="ai-skel">
                    {/* Header row: tier badge, "Today", save button */}
                    <div className="ai-skel-row" style={{ gap: 12, marginBottom: 10 }}>
                      <div className="skel-chip" style={{ width: 45, height: 20 }} />
                      <div className="skel-chip" style={{ width: 50, height: 20 }} />
                      <div style={{ marginLeft: "auto" }}>
                        <div className="skel-chip" style={{ width: 20, height: 20, borderRadius: "50%" }} />
                      </div>
                    </div>

                    {/* Word (large line) */}
                    <div className="skel-line" style={{ width: "85%", height: 32, marginBottom: 5 }} />

                    {/* IPA and POS row */}
                    <div className="ai-skel-row" style={{ gap: 12, marginBottom: 5 }}>
                      <div className="skel-line" style={{ width: 120, height: 16 }} />
                      <div className="skel-line" style={{ width: 100, height: 16 }} />
                    </div>

                    {/* Definition */}
                    <div className="skel-line" style={{ width: "95%", height: 31, marginBottom: 5 }} />

                    {/* Synonyms row */}
                    <div className="ai-skel-row" style={{ gap: 8, marginBottom: 0 }}>
                      <div className="skel-chip" style={{ width: 70, height: 30 }} />
                      <div className="skel-chip" style={{ width: 85, height: 30 }} />
                      <div className="skel-chip" style={{ width: 75, height: 30 }} />
                    </div>

                    {/* Train button */}
                    <div
                      className="skel-line"
                      style={{ width: "100%", height: 40, marginTop: "auto", borderRadius: 6 }}
                    />
                  </div>
                ) : (
                  <>
                    <div className="lotd-type-row">
                      <span className={`tier-badge ${s.tc}`}>{s.tier}</span>
                      <span className="lotd-day">Today</span>
                      <button
                        className="lotd-save-btn"
                        onClick={() => {
                          void saveSlide(i);
                        }}
                        title="Save to Callistratum"
                      >
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill={isSaved(i) ? "var(--gold)" : "none"}
                          stroke="var(--gold)"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z" />
                        </svg>
                      </button>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <div className="lotd-word">{s.word}</div>
                      <LogoiAudio logos={s.word} />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      {s.ipa && <span className="lotd-sub">{s.ipa}</span>}
                      <span className="lotd-pos">{s.pos}</span>
                    </div>
                    <div className="lotd-def">{s.def}</div>
                    <div className="lotd-ex">{s.ex}</div>
                    <div className="syn-row">
                      {s.syns.map((syn) => (
                        <span className="syn-chip" key={syn}>
                          {syn}
                        </span>
                      ))}
                    </div>
                    <button
                      className="train-btn"
                      style={{ marginTop: "auto" }}
                      onClick={() => {
                        void trainSlide(i);
                      }}
                    >
                      {s.btnLabel}
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="carousel-dots" style={{ flexShrink: 0 }}>
          {slides.map((_, i) => (
            <div key={i} className={`cdot${slide === i ? " active" : ""}`} onClick={() => goSlide(i)} />
          ))}
        </div>
      </div>
    </>
  );
};
