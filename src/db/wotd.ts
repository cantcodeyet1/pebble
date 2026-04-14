import { getConn } from './client'
import type { ClassifyResult } from '../services/ai.service'

export type WotdEntry = {
  date: string
  word: ClassifyResult
  phrase: ClassifyResult
}

export async function getTodayLOTD (): Promise<WotdEntry | null> {
  const conn = getConn()
  const today = new Date().toISOString().slice(0, 10)
  const result = await conn.query('SELECT * FROM wotd_log WHERE date = ?', [
    today
  ])
  const row = (result.values ?? [])[0] as Record<string, unknown> | undefined
  if (!row) return null
  return {
    date: row.date as string,
    word: JSON.parse(row.word_data as string) as ClassifyResult,
    phrase: JSON.parse(row.phrase_data as string) as ClassifyResult
  }
}

export async function saveLOTD (entries: WotdEntry[]): Promise<void> {
  const conn = getConn()
  for (const i of entries) {
    await conn.run(
      'INSERT OR REPLACE INTO wotd_log (date, word_data, phrase_data) VALUES (?, ?, ?)',
      [i.date, JSON.stringify(i.word), JSON.stringify(i.phrase)]
    )
  }
}
