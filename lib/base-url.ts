// lib/base-url.ts
// Resolves the canonical app URL in this priority:
//   1. NEXT_PUBLIC_APP_URL  (explicit override, set in GitHub Secrets / Vercel env)
//   2. VERCEL_URL           (auto-injected by Vercel on every deployment)
//   3. http://localhost:3000 (local dev fallback)
//
// VERCEL_URL has no protocol, so we always prepend https://

export function getBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.trim().replace(/\/$/, "")
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }
  return "http://localhost:3000"
}
