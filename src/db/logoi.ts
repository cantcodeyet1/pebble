import { addDays } from 'date-fns';
import type { Logos, Tier, Register } from '../store';
import { getConn } from './client';
import type { LogosRow } from './schema';

// ---------- helpers ----------

function capitalize<T extends string>(s: string): T {
  return (s.charAt(0).toUpperCase() + s.slice(1)) as T;
}

function rowToLogos(r: Record<string, unknown>): Logos {
  return {
    id:              r.id as string,
    text:            r.entry as string,
    tier:            capitalize<Tier>(r.tier as string),
    definition:      r.definition as string,
    exampleSentence: r.example as string,
    contextSentence: r.context_sentence ? (r.context_sentence as string) : undefined,
    source:          r.source ? (r.source as string) : undefined,
    register:        capitalize<Register>(r.register as string),
    phonetic:        (r.phonetic as string) || undefined,
    pos:             (r.pos as string) || undefined,
    synonyms:        r.synonyms ? JSON.parse(r.synonyms as string) : undefined,
    masteryLevel:    r.mastery_level as number,
    nextReviewDate:  new Date(r.next_review_date as string),
    dateAdded:       new Date(r.date_added as string),
    starred:         Boolean(r.starred),
    lastDrilledAt:   r.last_drilled_at ? new Date(r.last_drilled_at as string) : undefined,
  };
}

// ---------- CRUD ----------

export type AddLogosInput = {
  entry:           string;
  tier:            string;   // capitalised or lowercase — normalised internally
  definition:      string;
  example:         string;
  source?:         string | null;
  contextSentence?: string | null;
  register:        string;
  phonetic?:       string;
  pos?:            string;
  synonyms?:       string[];
};

export async function addLogos(input: AddLogosInput): Promise<Logos> {
  const conn = getConn();
  const now        = new Date().toISOString();
  const nextReview = addDays(new Date(), 1).toISOString();
  const id         = crypto.randomUUID();
  const tier       = input.tier.toLowerCase();
  const register   = input.register.toLowerCase();

  const phonetic = input.phonetic ?? '';
  const pos      = input.pos ?? '';
  const synonyms = JSON.stringify(input.synonyms ?? []);

  await conn.run(
    `INSERT INTO logoi
       (id, entry, tier, definition, example, source, context_sentence, register,
        phonetic, pos, synonyms,
        mastery_level, next_review_date, date_added, starred, synced, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, 0, ?)`,
    [id, input.entry, tier, input.definition, input.example,
     input.source ?? null, input.contextSentence ?? null,
     register, phonetic, pos, synonyms,
     nextReview, now, now],
  );

  return rowToLogos({
    id, entry: input.entry, tier, definition: input.definition,
    example: input.example, source: input.source ?? null,
    context_sentence: input.contextSentence ?? null, register,
    phonetic, pos, synonyms,
    mastery_level: 0, next_review_date: nextReview, date_added: now,
    starred: 0, synced: 0, updated_at: now,
  });
}

export async function getLogoi(): Promise<Logos[]> {
  const conn = getConn();
  const result = await conn.query('SELECT * FROM logoi ORDER BY date_added DESC');
  return (result.values ?? []).map(rowToLogos);
}

export async function updateLogos(
  id: string,
  patch: Partial<Pick<LogosRow, 'mastery_level' | 'next_review_date' | 'starred' | 'synced' | 'last_drilled_at'>>,
): Promise<void> {
  const conn = getConn();
  const sets: string[] = [];
  const vals: unknown[] = [];

  if (patch.mastery_level    !== undefined) { sets.push('mastery_level = ?');    vals.push(patch.mastery_level); }
  if (patch.next_review_date !== undefined) { sets.push('next_review_date = ?'); vals.push(patch.next_review_date); }
  if (patch.starred          !== undefined) { sets.push('starred = ?');          vals.push(patch.starred ? 1 : 0); }
  if (patch.synced           !== undefined) { sets.push('synced = ?');           vals.push(patch.synced  ? 1 : 0); }
  if (patch.last_drilled_at  !== undefined) { sets.push('last_drilled_at = ?');  vals.push(patch.last_drilled_at); }

  sets.push('updated_at = ?');
  vals.push(new Date().toISOString(), id);

  await conn.run(`UPDATE logoi SET ${sets.join(', ')} WHERE id = ?`, vals as string[]);
}

export async function deleteLogos(id: string): Promise<void> {
  const conn = getConn();
  await conn.run('DELETE FROM logoi WHERE id = ?', [id]);
}

export async function getStarred(): Promise<Logos[]> {
  const conn = getConn();
  const result = await conn.query(
    'SELECT * FROM logoi WHERE starred = 1 ORDER BY date_added DESC',
  );
  return (result.values ?? []).map(rowToLogos);
}

export async function getByMastery(level: number): Promise<Logos[]> {
  const conn = getConn();
  const result = await conn.query(
    'SELECT * FROM logoi WHERE mastery_level = ? ORDER BY date_added DESC',
    [level],
  );
  return (result.values ?? []).map(rowToLogos);
}

export async function getByRegister(register: string): Promise<Logos[]> {
  const conn = getConn();
  const result = await conn.query(
    'SELECT * FROM logoi WHERE register = ? ORDER BY date_added DESC',
    [register.toLowerCase()],
  );
  return (result.values ?? []).map(rowToLogos);
}
