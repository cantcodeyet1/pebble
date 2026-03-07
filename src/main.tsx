import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { getLogoi } from './db/logoi';
import { getActivityDates } from './db/activity';
import { usePebbleStore } from './store';

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
