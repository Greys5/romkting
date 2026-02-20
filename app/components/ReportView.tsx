"use client"

import { useEffect, useRef, useState } from "react"

interface NorthStar { label: string; goal: string; real: string }
interface UserConfig {
  reportName: string; company: string; industry: string; domain: string
  northStars: NorthStar[]
}

export default function ReportView({ data, config, onBack }: { data: any; config: UserConfig; onBack: () => void }) {
  const [interpretation, setInterpretation] = useState("")
  const [actions, setActions]               = useState<{ u: string; o: string; s: string } | null>(null)
  const [loading, setLoading]               = useState(true)

  useEffect(() => { streamSummary() }, [])

  async function streamSummary() {
    setLoading(true)
    const nsContext  = config.northStars.filter(ns => ns.label).map(ns => `- ${ns.label}: real ${ns.real || "—"} / meta ${ns.goal || "—"}`).join("\n")
    const dataContext = JSON.stringify(data, null, 2).slice(0, 3000)
    const prompt = `Sos el CMO de ${config.company || "la empresa"} (industria: ${config.industry || "B2B"}).
Revisaste el MBR de marketing del mes. Escribí una nota ejecutiva de interpretación en primera persona del plural.

North Stars del mes (real vs. meta):
${nsContext || "No se especificaron."}

Datos del mes:
${dataContext}

Instrucciones:
- 3-4 oraciones fluidas, sin bullets ni títulos
- Compará lo logrado vs. el objetivo y explicá qué significa para el negocio
- Nombrá el principal driver del mes
- Cerrá con una recomendación accionable y con convicción
- Tono: estratégico, directo, opinión real de CMO senior
- Español rioplatense, primera persona del plural

Luego en nueva línea, solo este JSON sin backticks:
{"u":"[acción urgente, 1 oración]","o":"[oportunidad a capitalizar, 1 oración]","s":"[qué sostener, 1 oración]"}`

    try {
      const res = await fetch("/api/exec-summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt }) })
      let full = "", narrative = "", jsonPart = ""
      const reader = res.body!.getReader()
      const dec    = new TextDecoder()
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
      if (jsonPart) try { setActions(JSON.parse(jsonPart.replace(/```json|```/g, "").trim())) } catch {}
    } catch {
      setInterpretation("No se pudo generar el análisis. Verificá la configuración del servidor.")
    }
    setLoading(false)
  }

  function nsArrow(real: string, goal: string) {
    const r = parseFloat(real.replace(",", ".")), g = parseFloat(goal.replace(",", "."))
    if (isNaN(r) || isNaN(g)) return { sym: "→", color: "#f59e0b" }
    if (r >= g * 1.03) return { sym: "↑", color: "#22c55e" }
    if (r >= g * 0.95) return { sym: "→", color: "#f59e0b" }
    return { sym: "↓", color: "#ef4444" }
  }

  const ns  = config.northStars.filter(n => n.label)
  const month = new Date().toLocaleDateString("es-AR", { month: "long", year: "numeric" })

  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8", fontFamily: "'Inter', sans-serif" }}>
      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes spin   { to{transform:rotate(360deg)} }
        @media print { .no-print { display:none !important } body { background: white } }
      `}</style>

      {/* Topbar */}
      <div className="no-print" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0 2.5rem", height: 60, background: "#fff", borderBottom: "1px solid #ede8e0", position: "sticky", top: 0, zIndex: 100 }}>
        <button onClick={onBack} style={{ background: "none", border: "1px solid #ede8e0", borderRadius: 8, padding: "6px 14px", fontSize: "0.78rem", color: "#888", cursor: "pointer", fontWeight: 500 }}>
          ← Volver
        </button>
        <div style={{ flex: 1, textAlign: "center" }}>
          <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1rem", color: "#1a1a1a" }}>{config.reportName || "MBR Marketing"}</div>
          <div style={{ fontSize: "0.6rem", color: "#bbb", textTransform: "uppercase", letterSpacing: "1px", marginTop: 1 }}>Reporte mensual · {month}</div>
        </div>
        <button onClick={() => window.print()} style={{ background: "#e8522a", border: "none", borderRadius: 8, padding: "7px 18px", color: "#fff", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer" }}>
          ↓ PDF
        </button>
      </div>

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "2.5rem 2rem" }}>

        {/* Cover */}
        <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: 16, padding: "2.5rem 3rem", marginBottom: "1.5rem", borderTop: "4px solid #e8522a" }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "2px", color: "#e8522a", marginBottom: "0.8rem" }}>
            Monthly Business Review · {month.toUpperCase()}
          </div>
          <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "2.8rem", fontWeight: 400, color: "#1a1a1a", letterSpacing: "-1px", lineHeight: 1.1, margin: "0 0 0.4rem" }}>
            {config.reportName || "MBR Marketing"}
          </h1>
          <div style={{ color: "#aaa", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
            {new Date().toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" })}
          </div>
          <div style={{ height: 1, background: "#f0ece6", marginBottom: "1.5rem" }} />
          <div style={{ display: "flex", gap: "2rem" }}>
            {config.company  && <div><div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1rem", color: "#1a1a1a" }}>{config.company}</div><div style={{ fontSize: "0.72rem", color: "#aaa" }}>Empresa</div></div>}
            {config.industry && <div><div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1rem", color: "#1a1a1a" }}>{config.industry}</div><div style={{ fontSize: "0.72rem", color: "#aaa" }}>Industria</div></div>}
          </div>
        </div>

        {/* Executive Summary */}
        <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: 16, padding: "2rem 2.5rem", marginBottom: "1.5rem" }}>
          <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "2px", color: "#aaa", marginBottom: "1.5rem" }}>Resumen ejecutivo</div>

          {/* North Stars */}
          {ns.length > 0 && (
            <div style={{ marginBottom: "1.8rem" }}>
              <div style={{ fontSize: "0.7rem", fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.7rem" }}>North Stars · Meta vs. real</div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "0.6rem" }}>
                {ns.map((n, i) => {
                  const a = nsArrow(n.real, n.goal)
                  return (
                    <div key={i} style={{ background: "#fafaf8", border: "1px solid #ede8e0", borderRadius: 10, padding: "0.8rem 1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1a1a1a", marginBottom: 3 }}>{n.label}</div>
                        <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.68rem", color: "#aaa" }}>{n.real || "—"} <span style={{ color: "#ddd" }}>/</span> {n.goal || "—"}</div>
                      </div>
                      <div style={{ fontSize: "1.4rem", color: a.color }}>{a.sym}</div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Interpretation */}
          <div style={{ background: "#fafaf8", border: "1px solid #ede8e0", borderRadius: 12, padding: "1.5rem", marginBottom: actions ? "1.2rem" : 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.9rem" }}>
              <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8522a", flexShrink: 0 }} />
              <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#aaa" }}>Análisis del mes</div>
              {loading && <div style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#e8522a" }}>Analizando…</div>}
            </div>
            <div style={{ fontFamily: "'Instrument Serif', serif", fontStyle: "italic", fontSize: "1.05rem", lineHeight: 1.8, color: "#1a1a1a" }}>
              {interpretation || (loading
                ? <span style={{ color: "#ccc" }}>Analizando los datos del mes…</span>
                : "—"
              )}
              {loading && interpretation && <span style={{ display: "inline-block", width: 2, height: "0.9em", background: "#e8522a", marginLeft: 2, animation: "blink .8s infinite", verticalAlign: "text-bottom" }} />}
            </div>
          </div>

          {/* Actions */}
          {actions && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: "0.6rem" }}>
              {[
                { label: "Urgente",     color: "#ef4444", bg: "#fef2f2", border: "#fecaca", text: actions.u },
                { label: "Oportunidad", color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", text: actions.o },
                { label: "Sostener",    color: "#2563eb", bg: "#eff6ff", border: "#bfdbfe", text: actions.s },
              ].map((a, i) => (
                <div key={i} style={{ background: a.bg, border: `1px solid ${a.border}`, borderRadius: 10, padding: "0.9rem" }}>
                  <div style={{ fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: a.color, marginBottom: "0.4rem" }}>{a.label}</div>
                  <div style={{ fontSize: "0.78rem", lineHeight: 1.6, color: "#444" }}>{a.text}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Data sections */}
        {data.sections?.map((section: any, i: number) => (
          <div key={i} style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: 16, padding: "1.8rem 2rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.4rem" }}>
              <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1.2rem", color: "#1a1a1a", fontWeight: 400 }}>{section.title}</div>
              <div style={{ fontSize: "0.62rem", fontWeight: 600, textTransform: "uppercase", letterSpacing: "1.5px", color: "#aaa", background: "#fafaf8", border: "1px solid #ede8e0", padding: "3px 10px", borderRadius: 20 }}>{section.source}</div>
            </div>

            {section.error && (
              <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "0.8rem 1rem", fontSize: "0.8rem", color: "#991b1b" }}>
                ⚠ {section.error}
              </div>
            )}

            {section.kpis && (
              <div style={{ display: "grid", gridTemplateColumns: `repeat(${Math.min(section.kpis.length, 4)}, 1fr)`, gap: "0.6rem", marginBottom: section.table ? "1.2rem" : 0 }}>
                {section.kpis.map((kpi: any, j: number) => (
                  <div key={j} style={{ background: "#fafaf8", border: "1px solid #ede8e0", borderRadius: 10, padding: "1rem", borderLeft: `3px solid ${kpi.color || "#e8522a"}` }}>
                    <div style={{ fontSize: "0.62rem", fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "1px", marginBottom: "0.4rem" }}>{kpi.label}</div>
                    <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1.8rem", color: "#1a1a1a", lineHeight: 1 }}>{kpi.value}</div>
                    {kpi.delta !== undefined && (
                      <div style={{ fontSize: "0.7rem", fontWeight: 700, color: kpi.delta >= 0 ? "#16a34a" : "#ef4444", marginTop: 4 }}>
                        {kpi.delta >= 0 ? "▲" : "▼"} {Math.abs(kpi.delta)}{kpi.unit || "%"} vs. mes ant.
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {section.table && (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>{section.table.headers.map((h: string, j: number) => (
                      <th key={j} style={{ fontSize: "0.62rem", fontWeight: 700, color: "#aaa", textTransform: "uppercase", letterSpacing: "1px", textAlign: "left", padding: "0.5rem 0.8rem", borderBottom: "1px solid #ede8e0" }}>{h}</th>
                    ))}</tr>
                  </thead>
                  <tbody>
                    {section.table.rows.map((row: any[], j: number) => (
                      <tr key={j} style={{ background: j % 2 === 0 ? "#fff" : "#fafaf8" }}>
                        {row.map((cell, k) => (
                          <td key={k} style={{ fontSize: "0.8rem", padding: "0.55rem 0.8rem", borderBottom: "1px solid #f0ece6", color: "#333" }}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ))}

        <div style={{ textAlign: "center", padding: "2rem 0 3rem", borderTop: "1px solid #ede8e0", fontSize: "0.65rem", color: "#ccc", letterSpacing: "1px", lineHeight: 2 }}>
          MBR MARKETING REPORT · {new Date().toLocaleDateString("es-AR").toUpperCase()}<br />
          DATOS REALES VÍA OAUTH SSO · ANÁLISIS EJECUTIVO
        </div>
      </div>
    </div>
  )
}
