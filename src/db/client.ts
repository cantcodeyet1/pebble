type MockConn = {
  run(sql: string, params?: unknown[]): Promise<{ changes: number }>;
  query(sql: string, params?: unknown[]): Promise<{ values: Record<string, unknown>[] }>;
};

const conn: MockConn = {
  async run(sql, params = []) {
    const res = await fetch('/api/db/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
  async query(sql, params = []) {
    const res = await fetch('/api/db/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql, params }),
    });
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  },
};

export async function initDb(): Promise<void> {
  // Table creation is handled by the Vite dev server on startup.
}

export function getConn() {
  return conn;
}
