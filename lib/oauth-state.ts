// lib/oauth-state.ts
// Generates and validates OAuth `state` param to prevent CSRF attacks.
// The state cookie must be set on the NextResponse (not via cookies().set())
// because Route Handlers in Next.js don't flush cookies() mutations to the client.

import { cookies } from "next/headers"
import { NextResponse } from "next/server"
import { randomBytes } from "crypto"

const COOKIE_OPTS = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path:     "/",
  maxAge:   60 * 10, // 10 min
}

/**
 * Generates a random state value and attaches the cookie to the given response.
 * Always pass the redirect response so the Set-Cookie header is sent to the browser.
 */
export function generateOAuthState(provider: string, res: NextResponse): string {
  const state = randomBytes(16).toString("hex")
  res.cookies.set(`mbr_oauth_state_${provider}`, state, COOKIE_OPTS)
  return state
}

/**
 * Reads and validates the state cookie from the incoming request cookies.
 * Deletes the cookie by setting it with maxAge=0 on the given response.
 */
export function validateOAuthState(
  provider: string,
  state: string,
  res: NextResponse
): boolean {
  const stored = cookies().get(`mbr_oauth_state_${provider}`)?.value
  if (!stored || stored !== state) return false
  res.cookies.set(`mbr_oauth_state_${provider}`, "", { ...COOKIE_OPTS, maxAge: 0 })
  return true
}
