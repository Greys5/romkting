"use client"
// app/components/ReportView.tsx
// Renderiza el reporte completo con Executive Summary generado por Claude (streaming)

import { useEffect, useRef, useState } from "react"

interface NorthStar { label: string; goal: string; real: string }
interface UserConfig {
  reportName: string; company: string; industry: string; domain: string
  northStars: NorthStar[]
}

export default function ReportView({ data, config, onBack }: { data: any; config: UserConfig; onBack: () => void }) {
  const [interpretation, setInterpretation] = useState("")
  const [actions, setActions]               = useState<{ u: string; o: string; s: string } | null>(null)
  const [aiLoading, setAiLoading]           = useState(true)
  const interpRef = useRef<HTMLDivElement>(null)

  // Stream Executive Summary from Claude
  useEffect(() => {
    streamExecSummary()
  }, [])

  async function streamExecSummary() {
    setAiLoading(true)
    const nsContext = config.northStars
      .filter(ns => ns.label)
      .map(ns => `- ${ns.label}: real ${ns.real || "—"} / meta ${ns.goal || "—"}`)
      .join("\n")

    const dataContext = JSON.stringify(data, null, 2).slice(0, 3000)

    const prompt = `Sos el CMO de ${config.company || "la empresa"} (industria: ${config.industry || "B2B"}).
Revisaste el MBR de marketing del mes. Escribí una nota ejecutiva de interpretación en primera persona del plural.

North Stars del mes (real vs. meta):
${nsContext || "No se especificaron North Stars."}

Datos del mes (JSON resumido):
${dataContext}

Instrucciones:
- 3-4 oraciones fluidas, sin bullet points ni títulos
- Compará lo logrado vs. el objetivo y explicá qué significa para el negocio
- Nombrá el principal driver del mes
- Cerrá con una recomendación accionable y con convicción
- Tono: estratégico, directo, opinión real de CMO senior
- Español rioplatense, primera persona del plural

Luego en nueva línea, solo este JSON sin backticks:
{"u":"[acción urgente, 1 oración]","o":"[oportunidad a capitalizar, 1 oración]","s":"[qué sostener, 1 oración]"}`

    try {
      const res = await fetch("/api/exec-summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      })

      let full = "", narrative = "", jsonPart = ""
      const reader = res.body!.getReader()
      const dec = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        for (const line of dec.decode(value).split("\n").filter(l => l.startsWith("data:"))) {
          try {
            const d = JSON.parse(line.slice(5).trim())
            if (d.type === "content_block_delta" && d.delta?.text) {
              full += d.delta.text
              const ji = full.indexOf('{"u":')
              if (ji !== -1) { narrative = full.slice(0, ji).trim(); jsonPart = full.slice(ji) }
              else narrative = full
              setInterpretation(narrative)
            }
          } catch {}
        }
      }

      setInterpretation(narrative)
      if (jsonPart) {
        try { setActions(JSON.parse(jsonPart.replace(/```json|```/g, "").trim())) } catch {}
      }
    } catch (e) {
      setInterpretation("No se pudo generar la interpretación automática. Revisá tu conexión o configurá ANTHROPIC_API_KEY en el servidor.")
    }
    setAiLoading(false)
  }

  function nsArrow(real: string, goal: string): { sym: string; color: string } {
    const r = parseFloat(real.replace(",", ".")), g = parseFloat(goal.replace(",", "."))
    if (isNaN(r) || isNaN(g)) return { sym: "=", color: "#d4a72c" }
    if (r >= g * 1.03) return { sym: "↑", color: "#18c16a" }
    if (r >= g * 0.95) return { sym: "=", color: "#d4a72c" }
    return { sym: "↓", color: "#f04b20" }
  }

  const ns = config.northStars.filter(n => n.label)

  return (
    <div style={{ background: "#0b0b0f", minHeight: "100vh", color: "#eceae4", fontFamily: "'Syne', sans-serif" }}>
      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.9rem 2.5rem", background: "rgba(11,11,15,.96)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,.07)", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "transparent", border: "1px solid rgba(255,255,255,.1)", color: "#888", fontFamily: "'Syne', sans-serif", fontSize: "0.75rem", padding: "7px 15px", borderRadius: 8, cursor: "pointer" }}>
          ← Volver
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontWeight: 700, fontSize: "0.92rem" }}>{config.reportName || "MBR"}</div>
          <div style={{ fontFamily: "monospace", fontSize: "0.58rem", color: "#666", letterSpacing: "1px" }}>
            DATOS REALES VÍA OAUTH · ANÁLISIS EJECUTIVO
          </div>
        </div>
        <button onClick={() => window.print()} style={{ background: "#f04b20", border: "none", color: "white", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.75rem", padding: "8px 18px", borderRadius: 8, cursor: "pointer" }}>
          ⬇ PDF
        </button>
      </div>

      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "2rem 2.5rem" }}>

        {/* Cover */}
        <div style={{ background: "linear-gradient(140deg, #0e0e1c, #180a04)", border: "1px solid rgba(255,255,255,.06)", borderRadius: 20, padding: "3.5rem", marginBottom: "1.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ fontFamily: "monospace", fontSize: "0.58rem", letterSpacing: "3px", textTransform: "uppercase", color: "#f04b20", marginBottom: "0.9rem" }}>
            Monthly Business Review · {new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" }).toUpperCase()}
          </div>
          <div style={{ fontFamily: "'Fraunces', serif", fontSize: "3.2rem", fontWeight: 300, letterSpacing: "-1.5px", lineHeight: 1.1, marginBottom: "0.5rem" }}>
            {config.reportName || "MBR Marketing"}
          </div>
          <div style={{ color: "#666", fontSize: "0.85rem", marginBottom: "2rem" }}>
            {new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div style={{ height: 1, background: "rgba(255,255,255,.06)", marginBottom: "2rem" }} />
          <div style={{ display: "flex", gap: "2rem" }}>
            {config.company && <div style={{ fontSize: "0.78rem", color: "#666" }}><strong style={{ color: "#eee", display: "block", fontFamily: "'Fraunces', serif" }}>{config.company}</strong>Empresa</div>}
            {config.industry && <div style={{ fontSize: "0.78rem", color: "#666" }}><strong style={{ color: "#eee", display: "block", fontFamily: "'Fraunces', serif" }}>{config.industry}</strong>Industria</div>}
          </div>
        </div>

        {/* Executive Summary */}
        <div style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.08)", borderRadius: 20, padding: "2.2rem", marginBottom: "1.5rem", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #f04b20, #3b72f6)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1.8rem" }}>
            <div style={{ fontFamily: "monospace", fontSize: "0.57rem", letterSpacing: "2px", textTransform: "uppercase", background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.1)", padding: "4px 12px", borderRadius: 20 }}>Executive Summary</div>

          </div>

          {/* North Stars */}
          {ns.length > 0 && (
            <>
              <div style={{ fontFamily: "monospace", fontSize: "0.58rem", color: "#666", letterSpacing: "1.5px", textTransform: "uppercase", marginBottom: "0.7rem" }}>North Stars · Estado vs. objetivo</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: "0.7rem", marginBottom: "2rem" }}>
                {ns.map((n, i) => {
                  const a = nsArrow(n.real, n.goal)
                  return (
                    <div key={i} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "0.9rem 1.1rem", display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: "0.82rem", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n.label}</div>
                        <div style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "#666" }}>
                          {n.real || "—"} <span style={{ color: "rgba(255,255,255,.2)" }}>/ meta</span> {n.goal || "—"}
                        </div>
                      </div>
                      <div style={{ fontSize: "1.3rem", color: a.color, flexShrink: 0 }}>{a.sym}</div>
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* AI Interpretation */}
          <div style={{ background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.6rem", marginBottom: actions ? "1.4rem" : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "1rem" }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#f04b20", flexShrink: 0 }} />
              <div style={{ fontFamily: "monospace", fontSize: "0.6rem", color: "#666", letterSpacing: "1.5px", textTransform: "uppercase" }}>Nota de interpretación ejecutiva</div>
              {aiLoading && <div style={{ fontFamily: "monospace", fontSize: "0.58rem", color: "#f04b20", marginLeft: "auto" }}>Analizando…</div>}
            </div>
            <div ref={interpRef} style={{ fontFamily: "'Fraunces', serif", fontStyle: "italic", fontSize: "1.02rem", lineHeight: 1.85, color: "#eceae4" }}>
              {interpretation || (aiLoading ? <span style={{ color: "#555" }}>Analizando los datos del mes…</span> : "—")}
              {aiLoading && interpretation && <span style={{ display: "inline-block", width: 2, height: "0.9em", background: "#f04b20", marginLeft: 2, animation: "blink .8s infinite", verticalAlign: "text-bottom" }} />}
            </div>
          </div>

          {/* Actions */}
          {actions && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.7rem" }}>
              {[
                { type: "🔴 Urgente",      color: "#ff6b6b", text: actions.u },
                { type: "🟢 Oportunidad",  color: "#18c16a", text: actions.o },
                { type: "🔵 Sostener",     color: "#7eb3ff", text: actions.s },
              ].map((a, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.03)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, padding: "0.9rem 1rem" }}>
                  <div style={{ fontFamily: "monospace", fontSize: "0.58rem", letterSpacing: "1.5px", textTransform: "uppercase", color: a.color, marginBottom: "0.4rem" }}>{a.type}</div>
                  <div style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "rgba(236,234,228,.75)" }}>{a.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data sections */}
        {data.sections?.map((section: any, i: number) => (
          <div key={i} style={{ background: "#131318", border: "1px solid rgba(255,255,255,.07)", borderRadius: 16, padding: "1.7rem", marginBottom: "1.1rem" }}>
            <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: "1.4rem" }}>
              <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.3rem", fontWeight: 600, letterSpacing: "-0.2px" }}>{section.title}</div>
              <div style={{ fontFamily: "monospace", fontSize: "0.56rem", letterSpacing: "2px", textTransform: "uppercase", color: "#666", padding: "3px 9px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 20 }}>{section.source}</div>
            </div>

            {/* KPIs */}
            {section.kpis && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(section.kpis.length, 4)}, 1fr)`, gap: "0.7rem", marginBottom: "1.1rem" }}>
                {section.kpis.map((kpi: any, j: number) => (
                  <div key={j} style={{ background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 11, padding: "1rem 1.1rem", borderTop: `3px solid ${kpi.color || "#f04b20"}` }}>
                    <div style={{ fontSize: "0.58rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "0.4rem" }}>{kpi.label}</div>
                    <div style={{ fontFamily: "'Fraunces', serif", fontSize: "1.85rem", lineHeight: 1, marginBottom: "0.2rem" }}>{kpi.value}</div>
                    {kpi.delta !== undefined && (
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: kpi.delta >= 0 ? "#18c16a" : "#f04b20" }}>
                        {kpi.delta >= 0 ? "▲" : "▼"} {Math.abs(kpi.delta)}{kpi.unit || "%"} vs. mes ant.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Table */}
            {section.table && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{section.table.headers.map((h: string, j: number) => (
                      <th key={j} style={{ fontSize: "0.58rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "1.5px", textAlign: "left", padding: "0.45rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,.07)" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row: any[], j: number) => (
                      <tr key={j}>
                        {row.map((cell, k) => (
                          <td key={k} style={{ fontSize: "0.78rem", padding: "0.6rem 0.75rem", borderBottom: "1px solid rgba(255,255,255,.04)", color: "rgba(236,234,228,.8)" }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        <div style={{ textAlign: "center", padding: "2rem 0 3rem", borderTop: "1px solid rgba(255,255,255,.07)", fontFamily: "monospace", fontSize: "0.6rem", color: "#555", letterSpacing: "1px", lineHeight: 1.8 }}>
          MBR MARKETING REPORT · {new Date().toLocaleString("es-AR").toUpperCase()}<br />
          DATOS REALES VÍA OAUTH SSO · ANÁLISIS EJECUTIVO
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin { to{transform:rotate(360deg)} }
        @media print {
          button { display: none !important; }
          body { background: white; color: black; }
        }
      `}</style>
    </div>
  )
}
