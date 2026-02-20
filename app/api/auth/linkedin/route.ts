// app/api/auth/linkedin/route.ts
import { NextRequest, NextResponse } from "next/server"
import { generateOAuthState, validateOAuthState } from "@/lib/oauth-state"

const BASE = process.env.NEXT_PUBLIC_APP_URL!

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const code  = searchParams.get("code")
  const state = searchParams.get("state")

  if (code) {
    if (!validateOAuthState("linkedin", state ?? ""))
      return NextResponse.redirect(`${BASE}/?error=linkedin_state`)

    const tokenRes = await fetch("https://www.linkedin.com/oauth/v2/accessToken", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type:    "authorization_code",
        code,
        client_id:     process.env.LINKEDIN_CLIENT_ID!,
        client_secret: process.env.LINKEDIN_CLIENT_SECRET!,
        redirect_uri:  `${BASE}/api/auth/linkedin`,
      }),
    })

    if (!tokenRes.ok) return NextResponse.redirect(`${BASE}/?error=linkedin_token`)
    const { access_token } = await tokenRes.json()

    const res = NextResponse.redirect(`${BASE}/setup`)
    res.cookies.set("mbr_linkedin_token", access_token, {
      httpOnly: true, secure: process.env.NODE_ENV === "production",
      sameSite: "lax", path: "/", maxAge: 60 * 60 * 8,
    })
    return res
  }

  const oauthState = generateOAuthState("linkedin")
  const params = new URLSearchParams({
    response_type: "code",
    client_id:     process.env.LINKEDIN_CLIENT_ID!,
    redirect_uri:  `${BASE}/api/auth/linkedin`,
    scope:         "r_liteprofile r_emailaddress r_organization_social rw_organization_admin",
    state:         oauthState,
  })
  return NextResponse.redirect(`https://www.linkedin.com/oauth/v2/authorization?${params}`)
}
