// lib/oauth-state.ts
// Generates and validates OAuth `state` param to prevent CSRF attacks.
// Stored temporarily in a short-lived cookie during the OAuth dance.

import { cookies } from "next/headers"
import { randomBytes } from "crypto"

export function generateOAuthState(provider: string): string {
  const state = randomBytes(16).toString("hex")
  cookies().set(`mbr_oauth_state_${provider}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10, // 10 min — enough for the OAuth dance
  })
  return state
}

export function validateOAuthState(provider: string, state: string): boolean {
  const stored = cookies().get(`mbr_oauth_state_${provider}`)?.value
  if (!stored || stored !== state) return false
  cookies().delete(`mbr_oauth_state_${provider}`)
  return true
}
