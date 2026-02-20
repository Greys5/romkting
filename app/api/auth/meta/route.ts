// app/api/auth/meta/route.ts
import { NextRequest, NextResponse } from "next/server"
import { generateOAuthState, validateOAuthState } from "@/lib/oauth-state"

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function GET(req: NextRequest) {
  if (!process.env.META_APP_ID || !process.env.META_APP_SECRET) {
    return NextResponse.json({ error: "Meta not configured" }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const state = searchParams.get("state")

  if (code) {
    if (!validateOAuthState("meta", state ?? ""))
      return NextResponse.redirect(`${BASE}/?error=meta_state`)

    const tokenRes = await fetch(
      `https://graph.facebook.com/v19.0/oauth/access_token?` +
      new URLSearchParams({
        client_id:     process.env.META_APP_ID,
        client_secret: process.env.META_APP_SECRET,
        redirect_uri:  `${BASE}/api/auth/meta`,
        code,
      })
    )

    if (!tokenRes.ok) return NextResponse.redirect(`${BASE}/?error=meta_token`)
    const { access_token } = await tokenRes.json()

    const res = NextResponse.redirect(`${BASE}/setup`)
    res.cookies.set("mbr_meta_token", access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
    })
    return res
  }

  const oauthState = generateOAuthState("meta")
  const params = new URLSearchParams({
    client_id:     process.env.META_APP_ID,
    redirect_uri:  `${BASE}/api/auth/meta`,
    scope:         "ads_read,ads_management,business_management,read_insights",
    state:         oauthState,
    response_type: "code",
  })
  return NextResponse.redirect(`https://www.facebook.com/v19.0/dialog/oauth?${params}`)
}
