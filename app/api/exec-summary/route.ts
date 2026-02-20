// app/api/exec-summary/route.ts
// Proxy streaming de Claude para el Executive Summary
// El cliente llama a este endpoint y recibe el stream de Anthropic

import { NextRequest } from "next/server"

export async function POST(req: NextRequest) {
  const { prompt } = await req.json()

  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 700,
      stream: true,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  // Pipe el stream directo al cliente
  return new Response(upstream.body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  })
}
