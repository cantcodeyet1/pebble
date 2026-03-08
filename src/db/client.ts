import { createClient } from '@libsql/client';

const client = createClient({
  url: 'file:pebble.db',
  syncUrl: import.meta.env.VITE_TURSO_DATABASE_URL as string,
  authToken: import.meta.env.VITE_TURSO_AUTH_TOKEN as string,
});

export async function initDb(): Promise<void> {
  await client.sync();
}

export function getConn() {
  return {
    async run(sql: string, params: unknown[] = []): Promise<{ changes: number }> {
      const result = await client.execute({ sql, args: params as import('@libsql/client').InValue[] });
      return { changes: result.rowsAffected };
    },
    async query(sql: string, params: unknown[] = []): Promise<{ values: Record<string, unknown>[] }> {
      const result = await client.execute({ sql, args: params as import('@libsql/client').InValue[] });
      return { values: result.rows as unknown as Record<string, unknown>[] };
    },
  };
}
