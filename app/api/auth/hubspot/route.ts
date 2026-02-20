// app/api/auth/hubspot/route.ts
import { NextRequest, NextResponse } from "next/server"
import { generateOAuthState, validateOAuthState } from "@/lib/oauth-state"

const BASE = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"

export async function GET(req: NextRequest) {
  if (!process.env.HUBSPOT_CLIENT_ID || !process.env.HUBSPOT_CLIENT_SECRET) {
    return NextResponse.json({ error: "HubSpot not configured" }, { status: 503 })
  }

  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const state = searchParams.get("state")

  if (code) {
    if (!validateOAuthState("hubspot", state ?? ""))
      return NextResponse.redirect(`${BASE}/?error=hubspot_state`)

    const tokenRes = await fetch("https://api.hubapi.com/oauth/v1/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        client_id:     process.env.HUBSPOT_CLIENT_ID,
        client_secret: process.env.HUBSPOT_CLIENT_SECRET,
        redirect_uri:  `${BASE}/api/auth/hubspot`,
        code,
      }),
    })

    if (!tokenRes.ok) return NextResponse.redirect(`${BASE}/?error=hubspot_token`)
    const { access_token } = await tokenRes.json()

    const res = NextResponse.redirect(`${BASE}/setup`)
    res.cookies.set("mbr_hubspot_token", access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
    })
    return res
  }

  const oauthState = generateOAuthState("hubspot")
  const params = new URLSearchParams({
    client_id:     process.env.HUBSPOT_CLIENT_ID,
    redirect_uri:  `${BASE}/api/auth/hubspot`,
    scope:         "crm.objects.contacts.read crm.objects.deals.read marketing-email campaigns",
    state:         oauthState,
  })
  return NextResponse.redirect(`https://app.hubspot.com/oauth/authorize?${params}`)
}
