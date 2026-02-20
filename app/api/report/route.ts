// app/api/report/route.ts
// Llama a cada fuente conectada con los tokens/keys de las cookies del user
// Devuelve { sections: [...] } para que ReportView lo renderice

import { NextRequest, NextResponse } from "next/server"

export async function POST(req: NextRequest) {
  const { modules, config } = await req.json()
  const cookies = req.cookies

  const sections: any[] = []

  // ─── GOOGLE SEARCH CONSOLE ───
  const googleToken = cookies.get("mbr_google_token")?.value
  if (googleToken && modules.some((m: string) => m.startsWith("gsc_"))) {
    try {
      const site = config.gscSiteUrl || (config.domain ? `sc-domain:${config.domain}` : null)
      if (!site) throw new Error("Configurá el campo 'URL en GSC' o 'Dominio' en el paso anterior.")
      const body = {
        startDate: thirtyDaysAgo(),
        endDate:   today(),
        dimensions: ["query"],
        rowLimit: 20,
      }
      const res = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(site)}/searchAnalytics/query`,
        { method: "POST", headers: { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) }
      )
      const d = await res.json()
      if (!res.ok) throw new Error(`GSC API error ${res.status}: ${JSON.stringify(d)}`)
      const rows = d.rows ?? []

      const totalClicks = rows.reduce((s: number, r: any) => s + r.clicks, 0)
      const totalImpr   = rows.reduce((s: number, r: any) => s + r.impressions, 0)
      const avgCtr      = rows.length ? (rows.reduce((s: number, r: any) => s + r.ctr, 0) / rows.length * 100).toFixed(1) : "0"
      const avgPos      = rows.length ? (rows.reduce((s: number, r: any) => s + r.position, 0) / rows.length).toFixed(1) : "0"

      sections.push({
        title: "Search Console · Performance SEO",
        source: "Google Search Console",
        kpis: [
          { label: "Clicks",          value: totalClicks.toLocaleString("es"),   color: "#3b72f6" },
          { label: "Impresiones",     value: (totalImpr/1000).toFixed(0)+"K",    color: "#18c16a" },
          { label: "CTR promedio",    value: avgCtr+"%",                          color: "#f04b20" },
          { label: "Posición prom.",  value: avgPos,                              color: "#d4a72c" },
        ],
        table: modules.includes("gsc_queries") ? {
          headers: ["Query", "Clicks", "Impresiones", "CTR", "Posición"],
          rows: rows.slice(0, 20).map((r: any) => [
            r.keys[0],
            r.clicks.toLocaleString("es"),
            r.impressions.toLocaleString("es"),
            (r.ctr * 100).toFixed(1) + "%",
            r.position.toFixed(1),
          ]),
        } : undefined,
      })
    } catch (e: any) {
      sections.push({ title: "Search Console", source: "Google Search Console", error: e.message || "No se pudieron obtener los datos." })
    }
  }

  // ─── GOOGLE ANALYTICS 4 ───
  if (googleToken && modules.some((m: string) => m.startsWith("ga4_"))) {
    try {
      const propertyId = config.ga4PropertyId
      if (!propertyId) throw new Error("ga4PropertyId no configurado")

      const res = await fetch(
        `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${googleToken}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            dateRanges: [{ startDate: thirtyDaysAgo(), endDate: today() }],
            dimensions: [{ name: "sessionDefaultChannelGroup" }],
            metrics: [{ name: "sessions" }, { name: "totalUsers" }, { name: "conversions" }],
          }),
        }
      )
      const d = await res.json()
      const rows = d.rows ?? []

      const totalSess = rows.reduce((s: number, r: any) => s + parseInt(r.metricValues[0].value), 0)
      const totalUsers = rows.reduce((s: number, r: any) => s + parseInt(r.metricValues[1].value), 0)
      const totalConv  = rows.reduce((s: number, r: any) => s + parseInt(r.metricValues[2].value), 0)

      sections.push({
        title: "Tráfico · Google Analytics 4",
        source: "GA4",
        kpis: [
          { label: "Sesiones",      value: totalSess.toLocaleString("es"),  color: "#e37400" },
          { label: "Usuarios",      value: totalUsers.toLocaleString("es"), color: "#3b72f6" },
          { label: "Conversiones",  value: totalConv.toLocaleString("es"),  color: "#18c16a" },
          { label: "CR global",     value: totalSess ? ((totalConv/totalSess)*100).toFixed(1)+"%" : "0%", color: "#d4a72c" },
        ],
        table: modules.includes("ga4_traffic") ? {
          headers: ["Canal", "Sesiones", "Usuarios", "Conversiones", "CR"],
          rows: rows.map((r: any) => {
            const sess = parseInt(r.metricValues[0].value)
            const conv = parseInt(r.metricValues[2].value)
            return [
              r.dimensionValues[0].value,
              sess.toLocaleString("es"),
              parseInt(r.metricValues[1].value).toLocaleString("es"),
              conv.toLocaleString("es"),
              sess ? ((conv/sess)*100).toFixed(1)+"%" : "0%",
            ]
          }),
        } : undefined,
      })
    } catch (e: any) {
      sections.push({ title: "Google Analytics 4", source: "GA4", error: e.message || "Error al obtener datos." })
    }
  }

  // ─── SEMRUSH ───
  const semrushKey = cookies.get("mbr_semrush_apikey")?.value
  if (semrushKey && modules.some((m: string) => m.startsWith("semrush_"))) {
    try {
      const domain = config.domain || "tudominio.com"
      const db = "us" // database: us, es, ar, etc.

      // Organic keywords
      const kwRes = await fetch(
        `https://api.semrush.com/?type=domain_organic&key=${semrushKey}&domain=${domain}&database=${db}&export_columns=Ph,Po,Pp,Pd,Nq,Tr&display_limit=20&display_sort=tr_desc`
      )
      const kwText = await kwRes.text()
      const kwRows = parseSemrushCSV(kwText)

      // AI Overview (Guru+ plan)
      let aiRows: any[] = []
      if (modules.includes("semrush_ai_overview")) {
        const aiRes = await fetch(
          `https://api.semrush.com/analytics/v1/?key=${semrushKey}&type=domain_ai_overview&domain=${domain}&database=${db}&display_limit=20`
        ).catch(() => null)
        if (aiRes?.ok) {
          const aiText = await aiRes.text()
          aiRows = parseSemrushCSV(aiText)
        }
      }

      sections.push({
        title: "AI Overview & Posicionamiento SEO",
        source: "Semrush",
        kpis: [
          { label: "Keywords orgánicas",   value: kwRows.length.toString(),              color: "#ff642d" },
          { label: "Posición promedio",     value: kwRows.length ? (kwRows.reduce((s: number, r: any) => s + parseFloat(r.Po || "0"), 0) / kwRows.length).toFixed(1) : "—", color: "#3b72f6" },
          { label: "Aparic. AI Overview",  value: aiRows.length > 0 ? aiRows.length.toString() : "— (requiere Guru+)", color: "#18c16a" },
        ],
        table: modules.includes("semrush_rankings") && kwRows.length ? {
          headers: ["Keyword", "Posición", "Pos. ant.", "Volumen", "Tráfico est."],
          rows: kwRows.slice(0, 15).map((r: any) => [r.Ph, r.Po, r.Pp, r.Nq, r.Tr]),
        } : undefined,
      })
    } catch (e) {
      sections.push({ title: "Semrush", source: "Semrush", error: "No se pudieron obtener los datos. Verificá tu API Key." })
    }
  }

  // ─── LINKEDIN ───
  const linkedinToken = cookies.get("mbr_linkedin_token")?.value
  if (linkedinToken && modules.some((m: string) => m.startsWith("linkedin_"))) {
    try {
      const orgId = config.linkedinOrgId
      if (!orgId) throw new Error("linkedinOrgId no configurado")

      const [statsRes, followersRes] = await Promise.all([
        fetch(`https://api.linkedin.com/v2/organizationalEntityShareStatistics?q=organizationalEntity&organizationalEntity=urn:li:organization:${orgId}&timeIntervals.timeGranularityType=MONTH`, {
          headers: { Authorization: `Bearer ${linkedinToken}` }
        }),
        fetch(`https://api.linkedin.com/v2/networkSizes/urn:li:organization:${orgId}?edgeType=CompanyFollowedByMember`, {
          headers: { Authorization: `Bearer ${linkedinToken}` }
        }),
      ])

      const statsData = await statsRes.json()
      const followersData = await followersRes.json()

      const totalImpr = statsData.elements?.[0]?.totalShareStatistics?.impressionCount ?? 0
      const totalClicks = statsData.elements?.[0]?.totalShareStatistics?.clickCount ?? 0
      const totalEng = statsData.elements?.[0]?.totalShareStatistics?.engagement ?? 0
      const followers = followersData.firstDegreeSize ?? 0

      sections.push({
        title: "LinkedIn · Analytics & Benchmark",
        source: "LinkedIn Analytics",
        kpis: [
          { label: "Seguidores",      value: followers.toLocaleString("es"),        color: "#0077b5" },
          { label: "Impresiones",     value: (totalImpr/1000).toFixed(0)+"K",       color: "#18c16a" },
          { label: "Clicks",          value: totalClicks.toLocaleString("es"),       color: "#f04b20" },
          { label: "Eng. rate",       value: (totalEng * 100).toFixed(2)+"%",       color: "#d4a72c" },
        ],
      })
    } catch (e: any) {
      sections.push({ title: "LinkedIn Analytics", source: "LinkedIn", error: e.message || "Error al obtener datos." })
    }
  }

  // ─── META ADS ───
  const metaToken = cookies.get("mbr_meta_token")?.value
  if (metaToken && modules.some((m: string) => m.startsWith("meta_"))) {
    try {
      const adAccountId = config.metaAdAccountId
      if (!adAccountId) throw new Error("metaAdAccountId no configurado")

      const res = await fetch(
        `https://graph.facebook.com/v19.0/${adAccountId}/insights?fields=spend,reach,impressions,clicks,cpm,cpc,actions&date_preset=last_30d&access_token=${metaToken}`
      )
      const d = await res.json()
      const ins = d.data?.[0] ?? {}

      const conv = (ins.actions ?? []).find((a: any) => a.action_type === "purchase")?.value ?? "0"
      const roas = ins.spend && parseFloat(conv) ? (parseFloat(conv) / parseFloat(ins.spend)).toFixed(1) : "—"

      sections.push({
        title: "Meta Ads · Campañas",
        source: "Meta Ads Manager",
        kpis: [
          { label: "Inversión",    value: "$" + parseFloat(ins.spend ?? "0").toLocaleString("es", { minimumFractionDigits: 0 }), color: "#1877f2" },
          { label: "Alcance",      value: parseInt(ins.reach ?? "0").toLocaleString("es"),   color: "#18c16a" },
          { label: "CPC",          value: "$" + parseFloat(ins.cpc ?? "0").toFixed(2),        color: "#f04b20" },
          { label: "ROAS",         value: roas + "x",                                         color: "#d4a72c" },
        ],
      })
    } catch (e: any) {
      sections.push({ title: "Meta Ads", source: "Meta Ads Manager", error: e.message || "Error al obtener datos." })
    }
  }

  // ─── HUBSPOT ───
  const hubspotToken = cookies.get("mbr_hubspot_token")?.value
  if (hubspotToken && modules.some((m: string) => m.startsWith("hubspot_"))) {
    try {
      const [contactsRes, dealsRes] = await Promise.all([
        fetch(`https://api.hubapi.com/crm/v3/objects/contacts?limit=1&properties=createdate`, {
          headers: { Authorization: `Bearer ${hubspotToken}` }
        }),
        fetch(`https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,amount,dealstage,pipeline,closedate`, {
          headers: { Authorization: `Bearer ${hubspotToken}` }
        }),
      ])

      const contactsData = await contactsRes.json()
      const dealsData    = await dealsRes.json()

      const totalDeals   = dealsData.results?.length ?? 0
      const pipelineValue = (dealsData.results ?? []).reduce((s: number, d: any) => s + parseFloat(d.properties.amount || "0"), 0)

      sections.push({
        title: "HubSpot · CRM & Pipeline",
        source: "HubSpot",
        kpis: [
          { label: "Total contactos", value: contactsData.total?.toLocaleString("es") ?? "—", color: "#ff7a59" },
          { label: "Deals activos",   value: totalDeals.toString(),                             color: "#3b72f6" },
          { label: "Pipeline ($)",    value: "$" + pipelineValue.toLocaleString("es", { maximumFractionDigits: 0 }), color: "#18c16a" },
        ],
        table: modules.includes("hubspot_leads") && dealsData.results?.length ? {
          headers: ["Deal", "Etapa", "Monto"],
          rows: (dealsData.results ?? []).slice(0, 10).map((d: any) => [
            d.properties.dealname ?? "—",
            d.properties.dealstage ?? "—",
            "$" + parseFloat(d.properties.amount || "0").toLocaleString("es", { maximumFractionDigits: 0 }),
          ]),
        } : undefined,
      })
    } catch (e: any) {
      sections.push({ title: "HubSpot", source: "HubSpot", error: e.message || "Error al obtener datos." })
    }
  }

  return NextResponse.json({ sections })
}

// ─── Helpers ───
function today() { return new Date().toISOString().split("T")[0] }
function thirtyDaysAgo() {
  const d = new Date(); d.setDate(d.getDate() - 30)
  return d.toISOString().split("T")[0]
}
function parseSemrushCSV(text: string): any[] {
  const lines = text.trim().split("\n")
  if (lines.length < 2) return []
  const headers = lines[0].split(";")
  return lines.slice(1).map(line => {
    const vals = line.split(";")
    return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i]?.trim() ?? ""]))
  })
}
