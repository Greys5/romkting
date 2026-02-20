// lib/base-url.ts
// Resolves the canonical app URL in this priority:
//   1. NEXT_PUBLIC_APP_URL              (explicit override)
//   2. VERCEL_PROJECT_PRODUCTION_URL    (Vercel injects this — always the production domain, never preview URLs)
//   3. VERCEL_URL                       (current deployment URL — fallback)
//   4. http://localhost:3000            (local dev)
//
// Must be called at REQUEST time (inside handlers), not at module level,
// so env vars are resolved fresh on every invocation.

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")
  }
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return "http://localhost:3000"
}
