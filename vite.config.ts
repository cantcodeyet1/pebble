import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { createRequire } from 'module';

const _require = createRequire(import.meta.url);

const CREATE_LOGOI_TABLE = `
CREATE TABLE IF NOT EXISTS logoi (
  id               TEXT PRIMARY KEY NOT NULL,
  entry            TEXT NOT NULL,
  tier             TEXT NOT NULL,
  definition       TEXT NOT NULL,
  example          TEXT NOT NULL,
  source           TEXT,
  register         TEXT NOT NULL,
  phonetic         TEXT NOT NULL DEFAULT '',
  pos              TEXT NOT NULL DEFAULT '',
  synonyms         TEXT NOT NULL DEFAULT '[]',
  mastery_level    INTEGER NOT NULL DEFAULT 0,
  next_review_date TEXT NOT NULL,
  date_added       TEXT NOT NULL,
  starred          INTEGER NOT NULL DEFAULT 0,
  synced           INTEGER NOT NULL DEFAULT 0,
  updated_at       TEXT NOT NULL
)`;

const CREATE_ACTIVITY_TABLE = `
CREATE TABLE IF NOT EXISTS activity (
  date TEXT PRIMARY KEY NOT NULL
)`;

const MIGRATIONS = [
  `ALTER TABLE logoi ADD COLUMN phonetic TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE logoi ADD COLUMN pos      TEXT NOT NULL DEFAULT ''`,
  `ALTER TABLE logoi ADD COLUMN synonyms TEXT NOT NULL DEFAULT '[]'`,
];

function parseBody(req: any): Promise<any> {
  return new Promise(resolve => {
    let body = '';
    req.on('data', (chunk: Buffer) => { body += chunk; });
    req.on('end', () => resolve(JSON.parse(body)));
  });
}

const sqliteApiPlugin = {
  name: 'sqlite-api',
  configureServer(server: any) {
    const Database = _require('better-sqlite3');
    const db = new Database('./pebble.db');
    db.exec(CREATE_LOGOI_TABLE);
    db.exec(CREATE_ACTIVITY_TABLE);
    for (const sql of MIGRATIONS) {
      try { db.exec(sql); } catch { /* column already exists */ }
    }

    server.middlewares.use('/api/db/run', async (req: any, res: any) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      try {
        const { sql, params } = await parseBody(req);
        const info = db.prepare(sql).run(...(params ?? []));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ changes: info.changes }));
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });

    server.middlewares.use('/api/db/query', async (req: any, res: any) => {
      if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
      try {
        const { sql, params } = await parseBody(req);
        const rows = db.prepare(sql).all(...(params ?? []));
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ values: rows }));
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });
  },
};

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [
      react(),
      tailwindcss(),
      sqliteApiPlugin,
      viteStaticCopy({
        targets: [
          { src: 'node_modules/sql.js/dist/sql-wasm.wasm', dest: '.' },
        ],
      }),
    ],
    optimizeDeps: {
      exclude: [],
    },
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
  };
});
