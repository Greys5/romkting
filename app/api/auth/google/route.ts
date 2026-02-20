// app/api/auth/google/route.ts
import { NextRequest, NextResponse } from "next/server"
import { generateOAuthState, validateOAuthState } from "@/lib/oauth-state"
import { setTokenCookie } from "@/lib/session"
import { getBaseUrl } from "@/lib/base-url"

// Scopes per product — user only grants what they need
const SCOPE_MAP: Record<string, string[]> = {
  gsc: [
    "openid email profile",
    "https://www.googleapis.com/auth/webmasters.readonly",
  ],
  ga4: [
    "openid email profile",
    "https://www.googleapis.com/auth/analytics.readonly",
  ],
  ads: [
    "openid email profile",
    "https://www.googleapis.com/auth/adwords",
  ],
  all: [
    "openid email profile",
    "https://www.googleapis.com/auth/webmasters.readonly",
    "https://www.googleapis.com/auth/analytics.readonly",
    "https://www.googleapis.com/auth/adwords",
  ],
}

// GET /api/auth/google?scope=gsc  → redirects to Google consent screen
// GET /api/auth/google?code=...   → handles callback from Google
export async function GET(req: NextRequest) {
  const BASE = getBaseUrl()
  const { searchParams } = new URL(req.url)
  const scope = searchParams.get("scope") ?? "all"
  const code  = searchParams.get("code")
  const state = searchParams.get("state")
  const error = searchParams.get("error")

  // ── Callback from Google ──────────────────────────────────────────────────
  if (code) {
    if (error) return NextResponse.redirect(`${BASE}/?error=google_denied`)

    if (!validateOAuthState("google", state ?? "")) {
      return NextResponse.redirect(`${BASE}/?error=google_state_mismatch`)
    }

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id:     process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri:  `${BASE}/api/auth/google`,
        grant_type:    "authorization_code",
      }),
    })

    if (!tokenRes.ok) {
      return NextResponse.redirect(`${BASE}/?error=google_token_failed`)
    }

    const { access_token } = await tokenRes.json()

    // Store in encrypted httpOnly cookie — never in DB, never logged
    const res = NextResponse.redirect(`${BASE}/`)
    res.cookies.set("mbr_google_token", access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 8,
    })
    return res
  }

  // ── Initiate OAuth flow ───────────────────────────────────────────────────
  const oauthState = generateOAuthState("google")
  const scopes = SCOPE_MAP[scope] ?? SCOPE_MAP["all"]

  const params = new URLSearchParams({
    response_type: "code",
    client_id:     process.env.GOOGLE_CLIENT_ID!,
    redirect_uri:  `${BASE}/api/auth/google`,
    scope:         scopes.join(" "),
    state:         oauthState,
    access_type:   "online",  // no refresh token — fresh each session
    prompt:        "select_account",
  })

  return NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params}`
  )
}
