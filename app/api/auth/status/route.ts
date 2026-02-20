// app/api/auth/status/route.ts
// Returns which sources are currently connected (have valid cookies)

import { NextRequest, NextResponse } from "next/server"

const COOKIES: Record<string, string> = {
  google_search_console: "mbr_google_token",
  google_analytics:      "mbr_google_token",
  google_ads:            "mbr_google_token",
  semrush:               "mbr_semrush_apikey",  // ← API key, not token
  linkedin:              "mbr_linkedin_token",
  meta_ads:              "mbr_meta_token",
  hubspot:               "mbr_hubspot_token",
}

export async function GET(req: NextRequest) {
  const connected: Record<string, boolean> = {}
  for (const [sourceId, cookieName] of Object.entries(COOKIES)) {
    connected[sourceId] = !!req.cookies.get(cookieName)?.value
  }
  return NextResponse.json({ connected })
}
