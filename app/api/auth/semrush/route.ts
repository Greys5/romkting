// app/api/auth/semrush/route.ts
// Semrush NO tiene OAuth 2.0 para terceros.
// El user ingresa su API Key personal desde su cuenta de Semrush.
// Esta route:
//   POST /api/auth/semrush  → valida la key contra la API real y la guarda en cookie httpOnly
//   DELETE /api/auth/semrush → borra la cookie (desconectar)

import { NextRequest, NextResponse } from "next/server"
import { getBaseUrl } from "@/lib/base-url"

const COOKIE = "mbr_semrush_apikey"
const BASE   = getBaseUrl()

export async function POST(req: NextRequest) {
  const { apiKey } = await req.json()

  if (!apiKey || typeof apiKey !== "string" || apiKey.trim().length < 10) {
    return NextResponse.json({ error: "API key inválida" }, { status: 400 })
  }

  const key = apiKey.trim()

  // Validar key contra Semrush API — endpoint de info del usuario
  // Si devuelve 200, la key es válida. Si 401/403, es inválida o sin plan.
  let planInfo: { plan: string; requestsLeft: number; hasAiOverview: boolean } | null = null

  try {
    const testRes = await fetch(
      `https://api.semrush.com/?type=phrase_this&key=${key}&phrase=test&database=us&export_columns=Ph,Nq&display_limit=1`,
      { signal: AbortSignal.timeout(8000) }
    )

    if (testRes.status === 403 || testRes.status === 401) {
      return NextResponse.json({ error: "API Key inválida o sin acceso. Verificá que sea correcta en tu cuenta de Semrush." }, { status: 401 })
    }

    const text = await testRes.text()

    // Detectar si el plan tiene AI Overview (Guru+)
    // El endpoint de AI Overview devuelve error específico si el plan no lo incluye
    const aiRes = await fetch(
      `https://api.semrush.com/analytics/v1/?key=${key}&type=domain_ai_overview&domain=example.com&database=us&display_limit=1`,
      { signal: AbortSignal.timeout(5000) }
    ).catch(() => null)

    const hasAiOverview = aiRes ? aiRes.status !== 403 : false

    planInfo = {
      plan: hasAiOverview ? "Guru / Business" : "Pro / Free",
      requestsLeft: 0,
      hasAiOverview,
    }

  } catch (e) {
    return NextResponse.json({ error: "No se pudo conectar con Semrush. Intentá de nuevo." }, { status: 502 })
  }

  // Guardar key en cookie httpOnly (nunca en DB)
  const res = NextResponse.json({ ok: true, planInfo })
  res.cookies.set(COOKIE, key, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8, // 8 horas
  })

  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.delete(COOKIE)
  return res
}
