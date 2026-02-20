"use client"

import { useEffect, useState, useCallback } from "react"
import { SOURCES, Source } from "@/lib/sources"
import ReportView from "@/app/components/ReportView"

type Step = "connect" | "configure" | "report"
interface NorthStar { label: string; goal: string; real: string }
interface UserConfig {
  reportName: string; company: string; industry: string; domain: string
  gscSiteUrl: string; ga4PropertyId: string; linkedinOrgId: string
  competitorOrgIds: string; metaAdAccountId: string; northStars: NorthStar[]
}
type SrStep = 1 | 2 | 3
interface SrPlanInfo { plan: string; hasAiOverview: boolean }

const DEFAULT_NORTH_STARS: NorthStar[] = [
  { label: "", goal: "", real: "" }, { label: "", goal: "", real: "" },
  { label: "", goal: "", real: "" }, { label: "", goal: "", real: "" },
]

export default function App() {
  const [step, setStep] = useState<Step>(() => {
    if (typeof window !== "undefined") {
      const s = sessionStorage.getItem("mbr_step") as Step
      return (s === "connect" || s === "configure") ? s : "connect"
    }
    return "connect"
  })
  const [connected, setConnected]         = useState<Record<string, boolean>>({})
  const [loading, setLoading]             = useState(true)
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [config, setConfig]               = useState<UserConfig>({
    reportName: "", company: "", industry: "", domain: "",
    gscSiteUrl: "", ga4PropertyId: "", linkedinOrgId: "",
    competitorOrgIds: "", metaAdAccountId: "", northStars: DEFAULT_NORTH_STARS,
  })
  const [reportData, setReportData]       = useState<any>(null)
  const [generating, setGenerating]       = useState(false)
  const [srOpen, setSrOpen]               = useState(false)
  const [srStep, setSrStep]               = useState<SrStep>(1)
  const [srKey, setSrKey]                 = useState("")
  const [srKeyVisible, setSrKeyVisible]   = useState(false)
  const [srValidating, setSrValidating]   = useState(false)
  const [srError, setSrError]             = useState("")
  const [srPlanInfo, setSrPlanInfo]       = useState<SrPlanInfo | null>(null)

  useEffect(() => { sessionStorage.setItem("mbr_step", step) }, [step])

  const fetchStatus = useCallback(async (autoAdvance = false) => {
    const res = await fetch("/api/auth/status")
    const d   = await res.json()
    const nc  = d.connected ?? {}
    setConnected(nc)
    setLoading(false)
    if (autoAdvance && Object.values(nc).some(Boolean)) setStep("configure")
  }, [])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const err = params.get("error")
    if (err) { window.history.replaceState({}, "", window.location.pathname); fetchStatus() }
    else { fetchStatus(sessionStorage.getItem("mbr_step") === "connect") }
  }, [fetchStatus])

  useEffect(() => {
    const iv = setInterval(fetchStatus, 3000)
    return () => clearInterval(iv)
  }, [fetchStatus])

  const connectedSources = SOURCES.filter(s => connected[s.id])

  function handleConnect(source: Source) {
    if (source.authMethod === "apikey") { setSrOpen(true); setSrStep(1); setSrError(""); setSrKey(""); setSrPlanInfo(null); return }
    window.location.href = source.authPath!
  }

  async function handleDisconnect(sourceId: string) {
    if (sourceId === "semrush") await fetch("/api/auth/semrush", { method: "DELETE" })
    else await fetch("/api/auth/disconnect", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId }) })
    await fetchStatus()
    const removable = SOURCES.find(s => s.id === sourceId)?.modules.map(m => m.id) ?? []
    setSelectedModules(prev => prev.filter(id => !removable.includes(id)))
  }

  async function validateSemrushKey() {
    if (!srKey.trim()) { setSrError("Ingresá tu API key."); return }
    setSrValidating(true); setSrError("")
    try {
      const res  = await fetch("/api/auth/semrush", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ apiKey: srKey.trim() }) })
      const data = await res.json()
      if (!res.ok) { setSrError(data.error || "Error al validar la key."); setSrValidating(false); return }
      setSrPlanInfo(data.planInfo); setSrStep(3)
      const mods = SOURCES.find(s => s.id === "semrush")?.modules ?? []
      const available = mods.filter(m => m.id !== "semrush_ai_overview" || data.planInfo.hasAiOverview)
      setSelectedModules(prev => [...new Set([...prev, ...available.map(m => m.id)])])
    } catch { setSrError("No se pudo conectar. Intentá de nuevo.") }
    setSrValidating(false)
  }

  function toggleModule(id: string) { setSelectedModules(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]) }
  function toggleAllFromSource(source: Source) {
    const ids = source.modules.map(m => m.id)
    const allOn = ids.every(id => selectedModules.includes(id))
    setSelectedModules(prev => allOn ? prev.filter(id => !ids.includes(id)) : [...new Set([...prev, ...ids])])
  }

  async function generateReport() {
    setGenerating(true)
    try {
      const res = await fetch("/api/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ modules: selectedModules, config }) })
      setReportData(await res.json()); setStep("report")
    } finally { setGenerating(false) }
  }

  function updateNorthStar(i: number, field: "label" | "goal" | "real", value: string) {
    setConfig(prev => ({ ...prev, northStars: prev.northStars.map((ns, idx) => idx === i ? { ...ns, [field]: value } : ns) }))
  }

  if (loading) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#fafaf8" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid #e8e3dc", borderTopColor: "#e8522a", borderRadius: "50%", animation: "spin .7s linear infinite", margin: "0 auto" }} />
        <p style={{ color: "#999", marginTop: "1rem", fontSize: "0.82rem" }}>Cargando…</p>
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )

  if (step === "report" && reportData) return <ReportView data={reportData} config={config} onBack={() => setStep("configure")} />

  // ── TOPBAR ──
  const Topbar = ({ active }: { active: 1 | 2 }) => (
    <div style={{ display: "flex", alignItems: "center", padding: "0 2.5rem", height: 60, background: "#fff", borderBottom: "1px solid #ede8e0", position: "sticky", top: 0, zIndex: 100 }}>
      <div style={{ fontFamily: "'Instrument Serif', serif", fontSize: "1.4rem", color: "#1a1a1a", letterSpacing: "-0.5px" }}>
        MBR<span style={{ color: "#e8522a" }}>.</span>
      </div>
      <div style={{ marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: active >= 1 ? "#e8522a" : "#ede8e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: active >= 1 ? "#fff" : "#999" }}>1</div>
          <span style={{ fontSize: "0.75rem", fontWeight: 500, color: active === 1 ? "#1a1a1a" : "#999" }}>Conectar</span>
        </div>
        <div style={{ width: 24, height: 1, background: "#ede8e0" }} />
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: active === 2 ? "#e8522a" : active > 2 ? "#22c55e" : "#ede8e0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.65rem", fontWeight: 700, color: active >= 2 ? "#fff" : "#999" }}>2</div>
          <span style={{ fontSize: "0.75rem", fontWeight: 500, color: active === 2 ? "#1a1a1a" : "#999" }}>Configurar</span>
        </div>
      </div>
    </div>
  )

  // ════════════════════════════════════════════════
  // STEP 1 — CONNECT
  // ════════════════════════════════════════════════
  if (step === "connect") return (
    <div style={{ minHeight: "100vh", background: "#fafaf8" }}>
      <Topbar active={1} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: 680, margin: "0 auto", padding: "3rem 2rem" }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e8522a", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "0.6rem" }}>Paso 1 de 2</p>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "2.4rem", color: "#1a1a1a", fontWeight: 400, lineHeight: 1.2, marginBottom: "0.6rem", letterSpacing: "-0.5px" }}>
          Conectá tus fuentes
        </h1>
        <p style={{ fontSize: "0.9rem", color: "#888", lineHeight: 1.7, marginBottom: "2.5rem", maxWidth: 460 }}>
          Conectá solo lo que usás. Tus credenciales se guardan en tu browser, nunca en nuestros servidores.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {SOURCES.map(source => {
            const isConn = connected[source.id]
            const isSr   = source.id === "semrush"
            return (
              <div key={source.id} style={{
                display: "flex", alignItems: "center", gap: "1rem",
                padding: "1rem 1.25rem", background: "#fff",
                border: `1.5px solid ${isConn ? "#22c55e" : "#ede8e0"}`,
                borderRadius: 12, transition: "border-color .2s",
              }}>
                <div style={{ width: 42, height: 42, borderRadius: 10, background: source.color + "15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", flexShrink: 0 }}>
                  {source.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: "0.88rem", color: "#1a1a1a", marginBottom: 2 }}>{source.label}</div>
                  <div style={{ fontSize: "0.75rem", color: "#aaa" }}>{source.description}</div>
                  {isSr && !isConn && <div style={{ fontSize: "0.68rem", color: "#e8522a", marginTop: 3 }}>API Key personal · sin registro</div>}
                </div>
                {isConn
                  ? <button onClick={() => handleDisconnect(source.id)} style={{ padding: "6px 14px", borderRadius: 8, border: "1.5px solid #bbf7d0", background: "#f0fdf4", color: "#16a34a", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                      ✓ Conectado
                    </button>
                  : <button onClick={() => handleConnect(source)} style={{ padding: "6px 16px", borderRadius: 8, border: "1.5px solid #ede8e0", background: isSr ? "#fff7ed" : "#fff", color: isSr ? "#e8522a" : "#1a1a1a", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
                      {isSr ? "Ingresar key" : "Conectar →"}
                    </button>
                }
              </div>
            )
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "2rem", paddingTop: "1.5rem", borderTop: "1px solid #ede8e0" }}>
          <span style={{ fontSize: "0.82rem", color: "#aaa" }}>
            <strong style={{ color: "#1a1a1a" }}>{connectedSources.length}</strong> de {SOURCES.length} fuentes conectadas
          </span>
          <button
            onClick={() => setStep("configure")}
            disabled={connectedSources.length === 0}
            style={{ padding: "10px 24px", background: connectedSources.length > 0 ? "#e8522a" : "#e8e3dc", border: "none", borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: "0.88rem", cursor: connectedSources.length > 0 ? "pointer" : "not-allowed", transition: "background .2s" }}>
            Configurar reporte →
          </button>
        </div>
      </div>

      {/* ══ SEMRUSH POPUP ══ */}
      {srOpen && (
        <div onClick={e => { if (e.target === e.currentTarget) setSrOpen(false) }}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(4px)" }}>
          <div style={{ background: "#fff", borderRadius: 16, width: 500, maxWidth: "94vw", display: "flex", flexDirection: "column", maxHeight: "90vh", overflow: "hidden", boxShadow: "0 20px 60px rgba(0,0,0,.15)" }}>
            <div style={{ padding: "1.4rem 1.8rem 1rem", borderBottom: "1px solid #f0ece6" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "0.9rem" }}>
                <span style={{ fontSize: "1.3rem" }}>🤖</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.95rem", color: "#1a1a1a" }}>Conectar Semrush</div>
                  <div style={{ fontSize: "0.72rem", color: "#aaa", marginTop: 1 }}>Con tu API Key personal · Sin registro</div>
                </div>
                <button onClick={() => setSrOpen(false)} style={{ marginLeft: "auto", background: "none", border: "none", fontSize: "1.2rem", color: "#aaa", cursor: "pointer" }}>×</button>
              </div>
              <div style={{ display: "flex", gap: 5 }}>
                {[1,2,3].map(n => (
                  <div key={n} style={{ height: 3, flex: 1, borderRadius: 2, background: srStep >= n ? "#e8522a" : "#ede8e0", transition: "background .3s" }} />
                ))}
              </div>
            </div>

            <div style={{ padding: "1.4rem 1.8rem", overflowY: "auto", flex: 1 }}>
              {srStep === 1 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1a1a1a", marginBottom: "1rem" }}>¿Dónde encontrás tu API Key?</div>
                  {[
                    { n: 1, title: "Ingresá a Semrush", desc: "Cualquier plan tiene API Key.", link: "https://www.semrush.com/login/", linkLabel: "Abrir Semrush →" },
                    { n: 2, title: "Perfil → Subscription & Usage → API", desc: "Click en tu avatar arriba a la derecha.", link: "https://www.semrush.com/accounts/profile/subscription/", linkLabel: "Ir directo →" },
                    { n: 3, title: "Copiá tu API Key", desc: "Cadena de ~32 caracteres, es tuya y personal.", link: null, linkLabel: "" },
                  ].map(s => (
                    <div key={s.n} style={{ display: "flex", gap: 12, marginBottom: "1rem" }}>
                      <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e8522a", color: "#fff", fontSize: "0.72rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{s.n}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.83rem", color: "#1a1a1a", marginBottom: 2 }}>{s.title}</div>
                        <div style={{ fontSize: "0.76rem", color: "#888", lineHeight: 1.5 }}>{s.desc}</div>
                        {s.link && <a href={s.link} target="_blank" rel="noopener" style={{ display: "inline-block", marginTop: 5, fontSize: "0.73rem", color: "#e8522a", fontWeight: 600, textDecoration: "none" }}>{s.linkLabel}</a>}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {srStep === 2 && (
                <div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1a1a1a", marginBottom: "0.5rem" }}>Pegá tu API Key</div>
                  <div style={{ fontSize: "0.76rem", color: "#888", marginBottom: "1.2rem", lineHeight: 1.6 }}>Se guarda en una cookie segura. Nunca la almacenamos en servidores.</div>
                  <div style={{ border: `1.5px solid ${srError ? "#f87171" : "#ede8e0"}`, borderRadius: 10, padding: "1rem", marginBottom: "1rem", background: "#fafaf8" }}>
                    <label style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#aaa", display: "block", marginBottom: "0.5rem" }}>API Key de Semrush</label>
                    <div style={{ display: "flex", gap: 8 }}>
                      <input type={srKeyVisible ? "text" : "password"} value={srKey} onChange={e => { setSrKey(e.target.value); setSrError("") }}
                        placeholder="a1b2c3d4..." autoFocus
                        style={{ flex: 1, border: "none", background: "transparent", outline: "none", fontFamily: "'DM Mono', monospace", fontSize: "0.85rem", color: "#1a1a1a" }} />
                      <button onClick={() => setSrKeyVisible(v => !v)} style={{ background: "none", border: "1px solid #ede8e0", borderRadius: 6, padding: "3px 8px", cursor: "pointer", fontSize: "0.8rem" }}>{srKeyVisible ? "🙈" : "👁"}</button>
                    </div>
                    {srError && <div style={{ color: "#ef4444", fontSize: "0.74rem", marginTop: "0.4rem" }}>{srError}</div>}
                  </div>
                </div>
              )}

              {srStep === 3 && srPlanInfo && (
                <div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: "1rem" }}>
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "4px 12px", fontSize: "0.72rem", fontWeight: 700, color: "#16a34a" }}>✓ API Key verificada</div>
                    <div style={{ fontFamily: "'DM Mono', monospace", fontSize: "0.72rem", color: "#aaa" }}>{srKey.slice(0,4)}••••{srKey.slice(-4)}</div>
                  </div>
                  <div style={{ fontWeight: 700, fontSize: "0.88rem", color: "#1a1a1a", marginBottom: "0.8rem" }}>Plan {srPlanInfo.plan} · Accesos disponibles</div>
                  {[
                    { icon: "📊", label: "Keywords & Posicionamiento orgánico", ok: true },
                    { icon: "🔍", label: "Visibilidad en respuestas de búsqueda", ok: srPlanInfo.hasAiOverview },
                    { icon: "⚔️", label: "Análisis de competidores SEO", ok: true },
                  ].map((f, i) => (
                    <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0ece6" }}>
                      <span>{f.icon}</span>
                      <span style={{ flex: 1, fontSize: "0.8rem", color: "#1a1a1a" }}>{f.label}</span>
                      <span style={{ fontSize: "0.75rem", fontWeight: 700, color: f.ok ? "#16a34a" : "#ccc" }}>{f.ok ? "✓" : "—"}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "1rem 1.8rem", borderTop: "1px solid #f0ece6", display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setSrOpen(false)} style={{ background: "none", border: "1px solid #ede8e0", borderRadius: 8, padding: "8px 16px", fontSize: "0.8rem", color: "#888", cursor: "pointer" }}>Cancelar</button>
              <div style={{ display: "flex", gap: 8 }}>
                {srStep === 1 && <button onClick={() => setSrStep(2)} style={{ background: "#e8522a", border: "none", borderRadius: 8, padding: "8px 20px", color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>Tengo mi API Key →</button>}
                {srStep === 2 && <>
                  <button onClick={() => setSrStep(1)} style={{ background: "none", border: "1px solid #ede8e0", borderRadius: 8, padding: "8px 14px", fontSize: "0.8rem", color: "#888", cursor: "pointer" }}>← Volver</button>
                  <button onClick={validateSemrushKey} disabled={srValidating} style={{ background: "#e8522a", border: "none", borderRadius: 8, padding: "8px 20px", color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer", opacity: srValidating ? 0.6 : 1 }}>
                    {srValidating ? "Verificando…" : "Verificar →"}
                  </button>
                </>}
                {srStep === 3 && <>
                  <button onClick={() => setSrStep(2)} style={{ background: "none", border: "1px solid #ede8e0", borderRadius: 8, padding: "8px 14px", fontSize: "0.8rem", color: "#888", cursor: "pointer" }}>← Cambiar key</button>
                  <button onClick={() => { setSrOpen(false); fetchStatus() }} style={{ background: "#e8522a", border: "none", borderRadius: 8, padding: "8px 20px", color: "#fff", fontWeight: 700, fontSize: "0.8rem", cursor: "pointer" }}>Conectar ✓</button>
                </>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  // ════════════════════════════════════════════════
  // STEP 2 — CONFIGURE
  // ════════════════════════════════════════════════
  return (
    <div style={{ minHeight: "100vh", background: "#fafaf8" }}>
      <Topbar active={2} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      <div style={{ maxWidth: 1020, margin: "0 auto", padding: "2.5rem 2rem" }}>
        <p style={{ fontSize: "0.75rem", fontWeight: 600, color: "#e8522a", textTransform: "uppercase", letterSpacing: "1.5px", marginBottom: "0.4rem" }}>Paso 2 de 2</p>
        <h1 style={{ fontFamily: "'Instrument Serif', serif", fontSize: "2rem", color: "#1a1a1a", fontWeight: 400, letterSpacing: "-0.5px", marginBottom: "0.4rem" }}>Armá tu reporte</h1>
        <p style={{ fontSize: "0.85rem", color: "#aaa", marginBottom: "2rem" }}>Seleccioná los módulos que necesitás y completá la configuración.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: "2rem" }}>

          {/* ── Module picker ── */}
          <div>
            {connectedSources.map(source => (
              <div key={source.id} style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: "0.6rem", paddingBottom: "0.5rem", borderBottom: "1px solid #ede8e0" }}>
                  <div style={{ width: 22, height: 22, borderRadius: 6, background: source.color + "18", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem" }}>{source.icon}</div>
                  <span style={{ fontWeight: 700, fontSize: "0.8rem", color: "#1a1a1a" }}>{source.label}</span>
                  <span onClick={() => toggleAllFromSource(source)} style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#aaa", cursor: "pointer", fontWeight: 500 }}>sel. todos</span>
                </div>
                {source.modules.map(mod => {
                  const on = selectedModules.includes(mod.id)
                  return (
                    <div key={mod.id} onClick={() => toggleModule(mod.id)}
                      style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 12px", border: `1.5px solid ${on ? source.color + "60" : "#ede8e0"}`, borderRadius: 10, cursor: "pointer", marginBottom: "0.4rem", background: on ? source.color + "08" : "#fff", transition: "all .15s" }}>
                      <div style={{ width: 18, height: 18, borderRadius: 5, border: `2px solid ${on ? source.color : "#d0c8be"}`, background: on ? source.color : "transparent", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.6rem", color: "#fff", flexShrink: 0, marginTop: 1 }}>{on ? "✓" : ""}</div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.82rem", color: "#1a1a1a", marginBottom: 2 }}>{mod.label}</div>
                        <div style={{ fontSize: "0.72rem", color: "#aaa" }}>{mod.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* ── Sidebar ── */}
          <div style={{ position: "sticky", top: 72, alignSelf: "start", display: "flex", flexDirection: "column", gap: "0.8rem" }}>

            <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: 14, padding: "1.2rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#aaa", marginBottom: "1rem" }}>Info del reporte</div>
              {[
                { label: "Nombre del reporte", key: "reportName", placeholder: "MBR Febrero 2026" },
                { label: "Empresa",            key: "company",    placeholder: "Tu empresa" },
                { label: "Industria",          key: "industry",   placeholder: "SaaS, E-commerce…" },
                { label: "Dominio",            key: "domain",     placeholder: "tuempresa.com" },
                ...(connected.google_search_console ? [{ label: "URL en Search Console", key: "gscSiteUrl", placeholder: "https://tuempresa.com/" }] : []),
                ...(connected.google_analytics    ? [{ label: "GA4 Property ID",        key: "ga4PropertyId",   placeholder: "123456789" }] : []),
                ...(connected.linkedin            ? [{ label: "LinkedIn Org ID",         key: "linkedinOrgId",   placeholder: "123456" }] : []),
                ...(connected.meta_ads            ? [{ label: "Meta Ad Account ID",      key: "metaAdAccountId", placeholder: "act_123456" }] : []),
              ].map(f => (
                <div key={f.key} style={{ marginBottom: "0.7rem" }}>
                  <label style={{ fontSize: "0.65rem", fontWeight: 600, color: "#aaa", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: 4 }}>{f.label}</label>
                  <input style={{ width: "100%", padding: "7px 10px", background: "#fafaf8", border: "1px solid #ede8e0", borderRadius: 7, color: "#1a1a1a", fontFamily: "'DM Mono', monospace", fontSize: "0.73rem", outline: "none", boxSizing: "border-box" }}
                    placeholder={f.placeholder} value={(config as any)[f.key]}
                    onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>

            <div style={{ background: "#fff", border: "1px solid #ede8e0", borderRadius: 14, padding: "1.2rem" }}>
              <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#aaa", marginBottom: "0.4rem" }}>North Stars</div>
              <div style={{ fontSize: "0.74rem", color: "#bbb", marginBottom: "1rem", lineHeight: 1.5 }}>Tus metas vs. lo que pasó.</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
                <div style={{ fontSize: "0.6rem", color: "#ccc", textAlign: "center" }}>Meta</div>
                <div style={{ fontSize: "0.6rem", color: "#ccc", textAlign: "center" }}>Real</div>
              </div>
              {config.northStars.map((ns, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 4, marginBottom: 4, alignItems: "center" }}>
                  <input style={{ gridColumn: "1/-1", padding: "5px 8px", background: "#fafaf8", border: "1px solid #ede8e0", borderRadius: 6, fontSize: "0.68rem", color: "#1a1a1a", outline: "none", fontFamily: "Inter, sans-serif" }}
                    placeholder={`Métrica ${i + 1}`} value={ns.label} onChange={e => updateNorthStar(i, "label", e.target.value)} />
                  <input style={{ padding: "5px 8px", background: "#fafaf8", border: "1px solid #ede8e0", borderRadius: 6, fontSize: "0.7rem", textAlign: "center", color: "#1a1a1a", outline: "none", fontFamily: "'DM Mono', monospace" }}
                    placeholder="Meta" value={ns.goal} onChange={e => updateNorthStar(i, "goal", e.target.value)} />
                  <input style={{ padding: "5px 8px", background: "#fafaf8", border: "1px solid #ede8e0", borderRadius: 6, fontSize: "0.7rem", textAlign: "center", color: "#1a1a1a", outline: "none", fontFamily: "'DM Mono', monospace" }}
                    placeholder="Real" value={ns.real} onChange={e => updateNorthStar(i, "real", e.target.value)} />
                </div>
              ))}
            </div>

            <button onClick={generateReport} disabled={selectedModules.length === 0 || generating}
              style={{ padding: "13px", background: selectedModules.length > 0 && !generating ? "#e8522a" : "#e8e3dc", border: "none", borderRadius: 12, color: "#fff", fontWeight: 700, fontSize: "0.92rem", cursor: selectedModules.length > 0 ? "pointer" : "not-allowed", transition: "background .2s" }}>
              {generating ? "Generando…" : "Generar reporte →"}
            </button>
            <div style={{ fontSize: "0.72rem", color: "#bbb", textAlign: "center" }}>
              {selectedModules.length === 0 ? "Seleccioná al menos 1 módulo" : `${selectedModules.length} módulos seleccionados`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
