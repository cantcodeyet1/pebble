import { createClient } from '@libsql/client'

const client = createClient({
  url: import.meta.env.VITE_TURSO_DATABASE_URL,
  authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN
})

export async function initDb(): Promise<void> {
  // no-op for now — offline sync to be added later
}

export function getConn() {
  return {
    async run(
      sql: string,
      params: unknown[] = []
    ): Promise<{ changes: number }> {
      const result = await client.execute({
        sql,
        args: params as import('@libsql/client').InValue[]
      })
      return { changes: result.rowsAffected }
    },
    async query(
      sql: string,
      params: unknown[] = []
    ): Promise<{ values: Record<string, unknown>[] }> {
      const result = await client.execute({
        sql,
        args: params as import('@libsql/client').InValue[]
      })
      return { values: result.rows as unknown as Record<string, unknown>[] }
    }
  }
}