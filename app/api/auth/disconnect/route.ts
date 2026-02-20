// app/api/auth/disconnect/route.ts
import { NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

const SOURCE_COOKIES: Record<string, string> = {
  google_search_console: "mbr_google_token",
  google_analytics:      "mbr_google_token",
  google_ads:            "mbr_google_token",
  semrush:               "mbr_semrush_token",
  linkedin:              "mbr_linkedin_token",
  meta_ads:              "mbr_meta_token",
  hubspot:               "mbr_hubspot_token",
}

export async function POST(req: NextRequest) {
  const { sourceId } = await req.json()
  const cookieName = SOURCE_COOKIES[sourceId]
  if (cookieName) cookies().delete(cookieName)
  return NextResponse.json({ ok: true })
}
