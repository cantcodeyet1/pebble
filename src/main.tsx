import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { getLogoi } from "./db/logoi";
import { getActivityDates } from "./db/activity";
import { getTodayLOTD, saveLOTD } from "./db/wotd";
import { generateLOTD } from "./services/ai.service";
import { usePebbleStore } from "./store";
import type { SlideData } from "./store";
import type { ClassifyResult } from "./services/ai.service";

// Render immediately — never block the UI on DB init
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Load persisted data from DB into store on startup
getLogoi()
  .then((rows) => {
    if (rows.length > 0) usePebbleStore.getState().setLogoi(rows);
  })
  .catch((err) => console.warn("[Pebble] DB load failed — using in-memory seed data:", err));

getActivityDates()
  .then((dates) => usePebbleStore.getState().setActivityDates(dates))
  .catch(() => {});

// ── Word of the Day ──────────────────────────────────────────────────────────

function classifyToSlide(r: ClassifyResult): SlideData {
  const isWord = r.tier === "Word";
  return {
    tier: r.tier,
    tc: isWord ? "tb-word" : "tb-phrase",
    word: r.logos,
    ipa: r.phonetic || "",
    pos: r.pos,
    register: (r.register ?? "").toLowerCase(),
    def: `"${r.definition}"`,
    ex: `"${r.sentence}"`,
    syns: r.synonyms ?? [],
    btnLabel: isWord ? "Train this word →" : "Train this phrase →",
  };
}

async function displayLogoi(): Promise<void> {
  usePebbleStore.getState().slidesStatus = "loading";
  
  try {
    let logoi: any[] = [];
    let logos = await getTodayLOTD();
    if (!logos) {
      const existingEntries = usePebbleStore.getState().logoi.map((l) => l.text);
      const result = await generateLOTD(existingEntries);

      console.log("entries", result);

      const today = new Date();

      logoi = result.entries.map((entry: any, i: number) => {
        const d = new Date(today);
        d.setDate(today.getDate() + i);

        return {
          date: d.toISOString().slice(0, 10),
          word: entry.word,
          phrase: entry.phrase,
        };
      });

      try {
        await saveLOTD(logoi);
      } catch (saveErr) {
        console.warn("[Pebble] WOTD save failed (will retry next session):", saveErr);
      }

      if (logoi[0]?.word && logoi[0]?.phrase) {
        usePebbleStore.getState().setTodaySlides([classifyToSlide(logoi[0].word), classifyToSlide(logoi[0].phrase)]);
        usePebbleStore.getState().slidesStatus = "success"
      }
    } else {
      usePebbleStore.getState().setTodaySlides([classifyToSlide(logos.word), classifyToSlide(logos.phrase)]);
      usePebbleStore.getState().slidesStatus = "success"
    }
  } catch (err) {
    console.warn("[Pebble] WOTD generation failed:", err);
    usePebbleStore.getState().slidesStatus = "error"
  }
}

void displayLogoi();
