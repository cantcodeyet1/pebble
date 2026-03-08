import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getLogoi } from './db/logoi';
import { getActivityDates } from './db/activity';
import { getTodayWotd, saveWotd } from './db/wotd';
import { generateWotd } from './services/ai.service';
import { usePebbleStore } from './store';
import type { SlideData } from './store';
import type { ClassifyResult } from './services/ai.service';

// Render immediately — never block the UI on DB init
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// Load persisted data from DB into store on startup
getLogoi()
  .then(rows => { if (rows.length > 0) usePebbleStore.getState().setLogoi(rows); })
  .catch(err => console.warn('[Pebble] DB load failed — using in-memory seed data:', err));

getActivityDates()
  .then(dates => usePebbleStore.getState().setActivityDates(dates))
  .catch(() => {});

// ── Word of the Day ──────────────────────────────────────────────────────────

function classifyToSlide(r: ClassifyResult): SlideData {
  const isWord = r.tier === 'Word';
  return {
    tier: r.tier,
    tc: isWord ? 'tb-word' : 'tb-phrase',
    word: r.logos,
    ipa: r.phonetic || '',
    pos: r.pos,
    register: (r.register ?? '').toLowerCase(),
    def: `"${r.definition}"`,
    ex: `"${r.sentence}"`,
    syns: r.synonyms ?? [],
    btnLabel: isWord ? 'Train this word →' : 'Train this phrase →',
  };
}

async function refreshWotd(): Promise<void> {
  try {
    let entry = await getTodayWotd();
    if (!entry) {
      const existingEntries = usePebbleStore.getState().logoi.map(l => l.text);
      const result = await generateWotd(existingEntries);
      const today = new Date().toISOString().slice(0, 10);
      entry = { date: today, word: result.word, phrase: result.phrase };
      await saveWotd(entry);
    }
    usePebbleStore.getState().setTodaySlides([
      classifyToSlide(entry.word),
      classifyToSlide(entry.phrase),
    ]);
  } catch (err) {
    console.warn('[Pebble] WOTD generation failed:', err);
  }
}

function scheduleWotdRefresh(): void {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  const msUntilMidnight = midnight.getTime() - now.getTime();
  setTimeout(() => {
    void refreshWotd();
    scheduleWotdRefresh();
  }, msUntilMidnight);
}

void refreshWotd();
scheduleWotdRefresh();
