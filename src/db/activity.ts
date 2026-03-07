import { getConn } from './client';

export async function recordActivityDb(date: string): Promise<void> {
  const conn = getConn();
  await conn.run('INSERT OR IGNORE INTO activity (date) VALUES (?)', [date]);
}

export async function getActivityDates(): Promise<string[]> {
  const conn = getConn();
  const result = await conn.query('SELECT date FROM activity ORDER BY date DESC');
  return (result.values ?? []).map(r => r.date as string);
}
