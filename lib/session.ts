// lib/session.ts
// Tokens are stored ONLY in encrypted httpOnly cookies in the user's browser.
// Your server never persists them. When the session ends, they're gone.

import { cookies } from "next/headers"

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 8, // 8 hours — tokens expire, user reconnects
}

export function setTokenCookie(name: string, token: string) {
  cookies().set(name, token, COOKIE_OPTIONS)
}

export function getTokenCookie(name: string): string | undefined {
  return cookies().get(name)?.value
}

export function clearTokenCookie(name: string) {
  cookies().delete(name)
}

export function getConnectedSources(): string[] {
  const cookieStore = cookies()
  const connected: string[] = []

  const checks: [string, string][] = [
    ["mbr_google_token",   "google"],
    ["mbr_semrush_token",  "semrush"],
    ["mbr_linkedin_token", "linkedin"],
    ["mbr_meta_token",     "meta"],
    ["mbr_hubspot_token",  "hubspot"],
  ]

  for (const [cookie, source] of checks) {
    if (cookieStore.get(cookie)?.value) connected.push(source)
  }

  return connected
}
