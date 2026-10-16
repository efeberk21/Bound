import { neon, neonConfig } from '@neondatabase/serverless';
// A fresh timeout per fetch; a signal created with the client would expire all
// subsequent queries after eight seconds in a warm function instance.
neonConfig.fetchFunction = (input: string | URL | Request, init?: RequestInit) => fetch(input, { ...init, signal: AbortSignal.timeout(8_000) });
export function database(connectionUrl = process.env.DATABASE_URL) {
  const url = connectionUrl;
  if (!url) throw new Error('DATABASE_NOT_CONFIGURED');
  return neon(url);
}
