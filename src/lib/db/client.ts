import { drizzle } from "drizzle-orm/neon-http";
import { neon, neonConfig } from "@neondatabase/serverless";
import * as schema from "./schema";

// The Neon HTTP driver occasionally hits a transient "fetch failed" (observed
// during the seed run) even though the endpoint itself is reachable — retry a
// couple of times with a short backoff before giving up.
const nativeFetch = fetch;
neonConfig.fetchFunction = async (url: string | URL, init?: RequestInit) => {
  const attempts = 3;
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await nativeFetch(url, init);
    } catch (err) {
      lastErr = err;
      if (i < attempts - 1) await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
  throw lastErr;
};

// Lazily initialized: importing this module must not read process.env.DATABASE_URL
// immediately, since scripts (e.g. scripts/seed.ts) load .env.local themselves
// before making their first query, after the ESM import graph has already
// resolved. Route handlers/pages get DATABASE_URL from the platform at runtime,
// so this resolves on first real use either way.
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function getDb() {
  if (!_db) {
    const sql = neon(process.env.DATABASE_URL!);
    _db = drizzle(sql, { schema });
  }
  return _db;
}

export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop) {
    return Reflect.get(getDb(), prop);
  },
});
