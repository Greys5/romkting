"use client"
// app/page.tsx — MBR Marketing App
// Step 1: Connect sources (OAuth SSO o API Key para Semrush)
// Step 2: Configurar módulos + North Stars
// Step 3: Reporte con Executive Summary generado por Claude

import { useEffect, useState, useRef, useCallback } from "react"
import { SOURCES, Source, SourceId } from "@/lib/sources"
import ReportView from "@/app/components/ReportView"

type Step = "connect" | "configure" | "report"

interface NorthStar { label: string; goal: string; real: string }

interface UserConfig {
  reportName: string
  company: string
  industry: string
  domain: string
  gscSiteUrl: string
  ga4PropertyId: string
  linkedinOrgId: string
  competitorOrgIds: string
  metaAdAccountId: string
  northStars: NorthStar[]
}

// ─── Semrush popup state ───
type SrStep = 1 | 2 | 3
interface SrPlanInfo { plan: string; hasAiOverview: boolean }

const DEFAULT_NORTH_STARS: NorthStar[] = [
  { label: "", goal: "", real: "" },
  { label: "", goal: "", real: "" },
  { label: "", goal: "", real: "" },
  { label: "", goal: "", real: "" },
]

export default function App() {
  const [step, setStep]           = useState<Step>(() => {
    if (typeof window !== "undefined") {
      const s = sessionStorage.getItem("mbr_step") as Step
      return (s === "connect" || s === "configure") ? s : "connect"
    }
    return "connect"
  })
  const [connected, setConnected] = useState<Record<string, boolean>>({})
  const [loading, setLoading]     = useState(true)
  const [selectedModules, setSelectedModules] = useState<string[]>([])
  const [config, setConfig]       = useState<UserConfig>({
    reportName: "", company: "", industry: "", domain: "",
    gscSiteUrl: "", ga4PropertyId: "", linkedinOrgId: "",
    competitorOrgIds: "", metaAdAccountId: "",
    northStars: DEFAULT_NORTH_STARS,
  })
  const [reportData, setReportData] = useState<any>(null)
  const [generating, setGenerating] = useState(false)

  // Semrush popup
  const [srOpen, setSrOpen]       = useState(false)
  const [srStep, setSrStep]       = useState<SrStep>(1)
  const [srKey, setSrKey]         = useState("")
  const [srKeyVisible, setSrKeyVisible] = useState(false)
  const [srValidating, setSrValidating] = useState(false)
  const [srError, setSrError]     = useState("")
  const [srPlanInfo, setSrPlanInfo] = useState<SrPlanInfo | null>(null)

  useEffect(() => { sessionStorage.setItem("mbr_step", step) }, [step])

  const fetchStatus = useCallback(async (autoAdvance = false) => {
    const res = await fetch("/api/auth/status")
    const d   = await res.json()
    const newConnected = d.connected ?? {}
    setConnected(newConnected)
    setLoading(false)
    // If coming back from OAuth (autoAdvance=true) and something is connected, go to configure
    if (autoAdvance && Object.values(newConnected).some(Boolean)) {
      setStep("configure")
    }
  }, [])

  // On first load: detect if we're returning from an OAuth flow
  // If the sessionStorage says we were on "connect", auto-advance to "configure" once connected
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const oauthError = params.get("error")
    if (oauthError) {
      window.history.replaceState({}, "", window.location.pathname)
      fetchStatus()
    } else {
      const savedStep = sessionStorage.getItem("mbr_step") as Step
      const autoAdvance = savedStep === "connect"
      fetchStatus(autoAdvance)
    }
  }, [fetchStatus])
  useEffect(() => {
    const iv = setInterval(fetchStatus, 3000)
    return () => clearInterval(iv)
  }, [fetchStatus])

  const connectedSources = SOURCES.filter((s) => connected[s.id])

  // ─── Connect handlers ───
  function handleConnect(source: Source) {
    if (source.authMethod === "apikey") { setSrOpen(true); setSrStep(1); setSrError(""); setSrKey(""); setSrPlanInfo(null); return }
    window.location.href = source.authPath!
  }

  async function handleDisconnect(sourceId: string) {
    if (sourceId === "semrush") {
      await fetch("/api/auth/semrush", { method: "DELETE" })
    } else {
      await fetch("/api/auth/disconnect", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId }),
      })
    }
    await fetchStatus()
    const removable = SOURCES.find((s) => s.id === sourceId)?.modules.map((m) => m.id) ?? []
    setSelectedModules((prev) => prev.filter((id) => !removable.includes(id)))
  }

  // ─── Semrush API Key flow ───
  async function validateSemrushKey() {
    if (!srKey.trim()) { setSrError("Ingresá tu API key."); return }
    setSrValidating(true); setSrError("")
    try {
      const res = await fetch("/api/auth/semrush", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey: srKey.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setSrError(data.error || "Error al validar la key."); setSrValidating(false); return }
      setSrPlanInfo(data.planInfo)
      setSrStep(3)
      // Auto-select modules based on plan
      const mods = SOURCES.find(s => s.id === "semrush")?.modules ?? []
      const available = mods.filter(m => m.id !== "semrush_ai_overview" || data.planInfo.hasAiOverview)
      setSelectedModules(prev => [...new Set([...prev, ...available.map(m => m.id)])])
    } catch {
      setSrError("No se pudo conectar con Semrush. Intentá de nuevo.")
    }
    setSrValidating(false)
  }

  function confirmSemrushKey() {
    setSrOpen(false)
    fetchStatus()
  }

  // ─── Module selection ───
  function toggleModule(moduleId: string) {
    setSelectedModules(prev => prev.includes(moduleId)
      ? prev.filter(id => id !== moduleId)
      : [...prev, moduleId])
  }

  function toggleAllFromSource(source: Source) {
    const ids = source.modules.map(m => m.id)
    const allOn = ids.every(id => selectedModules.includes(id))
    setSelectedModules(prev => allOn
      ? prev.filter(id => !ids.includes(id))
      : [...new Set([...prev, ...ids])])
  }

  // ─── Generate report ───
  async function generateReport() {
    setGenerating(true)
    try {
      const res = await fetch("/api/report", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modules: selectedModules, config }),
      })
      setReportData(await res.json())
      setStep("report")
    } finally { setGenerating(false) }
  }

  // ─── North Stars helpers ───
  function updateNorthStar(i: number, field: "label" | "goal" | "real", value: string) {
    setConfig(prev => ({
      ...prev,
      northStars: prev.northStars.map((ns, idx) => idx === i ? { ...ns, [field]: value } : ns)
    }))
  }

  if (loading) return (
    <div style={S.loadingScreen}>
      <div style={S.spinner} />
      <p style={{ color: "#666", marginTop: "1rem", fontFamily: "monospace", fontSize: "0.8rem" }}>Cargando sesión…</p>
    </div>
  )

  if (step === "report" && reportData) return (
    <ReportView data={reportData} config={config} onBack={() => setStep("configure")} />
  )

  // ════════════════════════════════════════════════
  // STEP 1 — CONNECT
  // ════════════════════════════════════════════════
  if (step === "connect") return (
    <div style={S.page}>
      {/* Topbar */}
      <div style={S.topbar}>
        <span style={S.logo}>MBR<span style={{ color: "#f04b20" }}>.</span></span>
        <div style={S.stepDots}>
          <div style={{ ...S.dot, ...S.dotActive }} />
          <div style={S.dot} />
        </div>
      </div>

      <div style={S.content}>
        <div style={S.eyebrow}>Paso 1 de 2</div>
        <h1 style={S.h1}>Conectá tus<br /><em style={{ fontStyle: "italic", fontWeight: 300 }}>fuentes de marketing</em></h1>
        <p style={S.desc}>Solo necesitas conectar lo que usas. Cada conexión es segura — tus tokens se guardan localmente, no en nuestros servidores.</p>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", margin: "2rem 0" }}>
          {SOURCES.map(source => {
            const isConn = connected[source.id]
            const isSr   = source.id === "semrush"
            return (
              <div key={source.id} style={{ ...S.sourceRow, ...(isConn ? S.sourceRowConn : {}) }}>
                <div style={{ ...S.srcIcon, background: source.color + "22" }}>{source.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={S.srcName}>{source.label}</div>
                  <div style={S.srcDesc}>{source.description}</div>
                  {isSr && !isConn && <div style={S.srcApiTag}>🔑 API Key personal · No requiere registro de app</div>}
                </div>
                {isConn
                  ? <button style={S.btnDisconn} onClick={() => handleDisconnect(source.id)}>✓ Conectado · Desconectar</button>
                  : <button style={{ ...S.btnConn, ...(isSr ? { background: "#fff5f2", color: "#ff642d", border: "1px solid #ffd5c8" } : {}) }}
                      onClick={() => handleConnect(source)}>
                      {isSr ? "🔑 Ingresar API Key" : "Conectar →"}
                    </button>
                }
              </div>
            )
          })}
        </div>

        <div style={S.continueBar}>
          <span style={{ fontSize: "0.82rem", color: "#888" }}>
            <strong style={{ color: "#eee" }}>{connectedSources.length}</strong> de {SOURCES.length} fuentes conectadas
          </span>
          <button
            style={{ ...S.btnPrimary, opacity: connectedSources.length > 0 ? 1 : 0.35, cursor: connectedSources.length > 0 ? "pointer" : "not-allowed" }}
            disabled={connectedSources.length === 0}
            onClick={() => setStep("configure")}>
            Configurar reporte →
          </button>
        </div>
      </div>

      {/* ══ SEMRUSH POPUP ══ */}
      {srOpen && (
        <div style={S.overlay} onClick={(e) => { if (e.target === e.currentTarget) setSrOpen(false) }}>
          <div style={S.srCard}>

            {/* Header */}
            <div style={S.srHead}>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "1rem" }}>
                <div style={S.srLogoPill}>🤖 Semrush</div>
                <div>
                  <div style={S.srHeadTitle}>Conectar Semrush</div>
                  <div style={S.srHeadSub}>Con tu API Key personal · Sin registro · Sin costo</div>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {[1,2,3].map(n => (
                  <div key={n} style={{
                    width: srStep === n ? 22 : 8, height: 8, borderRadius: 4,
                    background: srStep > n ? "#18c16a" : srStep === n ? "#ff642d" : "#e8e8e8",
                    transition: "all .3s"
                  }} />
                ))}
                <span style={{ fontSize: "0.7rem", color: "#aaa", fontFamily: "monospace", marginLeft: 6 }}>Paso {srStep} de 3</span>
              </div>
            </div>

            {/* Body */}
            <div style={S.srBody}>

              {/* ── Panel 1: Tutorial ── */}
              {srStep === 1 && (
                <div>
                  <div style={S.srPanelTitle}>¿Dónde está tu API Key?</div>
                  {[
                    { n: 1, title: "Entrá a Semrush con tu cuenta", desc: "Cualquier plan (Free, Pro, Guru) tiene API Key.", link: "https://www.semrush.com/login/", linkLabel: "🔗 Abrir Semrush" },
                    { n: 2, title: "Ir a tu perfil → Subscription & Usage", desc: "Click en tu avatar (arriba derecha) → Profile → Subscription & Usage → pestaña API.", link: "https://www.semrush.com/accounts/profile/subscription/", linkLabel: "🔗 Ir directo" },
                    { n: 3, title: "Copiá tu API Key", desc: "Es una cadena de ~32 caracteres. Es solo tuya, cada usuario usa la suya.", link: null, linkLabel: "" },
                  ].map(step => (
                    <div key={step.n} style={S.srTutStep}>
                      <div style={S.srTutNum}>{step.n}</div>
                      <div>
                        <div style={S.srTutTitle}>{step.title}</div>
                        <div style={S.srTutDesc}>{step.desc}</div>
                        {step.link && (
                          <a href={step.link} target="_blank" rel="noopener" style={S.srTutLink}>{step.linkLabel}</a>
                        )}
                      </div>
                    </div>
                  ))}
                  <div style={S.srNote}>
                    <span>⚠️</span>
                    <span>En el plan Free la sección API puede estar limitada. Pro y Guru siempre la tienen disponible.</span>
                  </div>
                </div>
              )}

              {/* ── Panel 2: Ingresar key ── */}
              {srStep === 2 && (
                <div>
                  <div style={S.srPanelTitle}>Pegá tu API Key</div>
                  <div style={{ fontSize: "0.78rem", color: "#888", fontFamily: "sans-serif", marginBottom: "1.2rem", lineHeight: 1.6 }}>
                    Se guarda en una cookie segura de tu browser. Nunca la almacenamos en ningún servidor ni base de datos.
                  </div>
                  <div style={{ ...S.srKeyBox, borderColor: srError ? "#e53" : "#e8e8e8" }}>
                    <label style={S.srKeyLabel}>API Key de Semrush</label>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input
                        type={srKeyVisible ? "text" : "password"}
                        value={srKey}
                        onChange={e => { setSrKey(e.target.value); setSrError("") }}
                        placeholder="a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6"
                        style={S.srKeyInput}
                        autoFocus
                      />
                      <button style={S.srToggleBtn} onClick={() => setSrKeyVisible(v => !v)}>
                        {srKeyVisible ? "🙈" : "👁"}
                      </button>
                    </div>
                    {srError && <div style={{ color: "#e53", fontSize: "0.75rem", fontFamily: "sans-serif", marginTop: "0.4rem" }}>{srError}</div>}
                  </div>
                  <div style={S.srSecNote}>
                    <span>🔒</span>
                    <span>Tu API key va directo desde tu browser a la API de Semrush. Esta app la usa solo para hacer las llamadas durante tu sesión.</span>
                  </div>
                </div>
              )}

              {/* ── Panel 3: Confirmar acceso ── */}
              {srStep === 3 && srPlanInfo && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: "1rem" }}>
                    <div style={S.srVerifiedPill}>✓ API Key verificada</div>
                    <div style={S.srKeyMasked}>{srKey.slice(0,4)}••••••••{srKey.slice(-4)}</div>
                  </div>
                  <div style={S.srPanelTitle}>Accesos disponibles — Plan {srPlanInfo.plan}</div>
                  {[
                    { icon: "📊", label: "Keywords & Posicionamiento orgánico", ok: true },
                    { icon: "🤖", label: "AI Overview & Featured Snippets",      ok: srPlanInfo.hasAiOverview },
                    { icon: "⚔️", label: "Análisis de competidores SEO",         ok: true },
                  ].map((f, i) => (
                    <div key={i} style={S.srAccessRow}>
                      <span style={{ fontSize: "1.1rem" }}>{f.icon}</span>
                      <span style={{ flex: 1, fontFamily: "sans-serif", fontSize: "0.82rem" }}>{f.label}</span>
                      <span style={{ fontWeight: 700, fontSize: "0.78rem", color: f.ok ? "#1a7a4a" : "#bbb" }}>
                        {f.ok ? "✓ Disponible" : "— No incluido en tu plan"}
                      </span>
                    </div>
                  ))}
                  {!srPlanInfo.hasAiOverview && (
                    <div style={{ ...S.srNote, marginTop: "0.8rem" }}>
                      <span>💡</span>
                      <span>AI Overview requiere plan Guru o superior. Podés seguir usando los otros módulos de Semrush.</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={S.srFoot}>
              <button style={S.srBtnSec} onClick={() => setSrOpen(false)}>Cancelar</button>
              <div style={{ display: "flex", gap: 8 }}>
                {srStep === 1 && (
                  <button style={S.srBtnPri} onClick={() => setSrStep(2)}>Ya tengo mi API Key →</button>
                )}
                {srStep === 2 && (
                  <>
                    <button style={S.srBtnSec} onClick={() => setSrStep(1)}>← Volver</button>
                    <button style={{ ...S.srBtnPri, opacity: srValidating ? 0.6 : 1 }} onClick={validateSemrushKey} disabled={srValidating}>
                      {srValidating ? "⟳ Verificando…" : "Verificar API Key →"}
                    </button>
                  </>
                )}
                {srStep === 3 && (
                  <>
                    <button style={S.srBtnSec} onClick={() => setSrStep(2)}>← Cambiar key</button>
                    <button style={S.srBtnPri} onClick={confirmSemrushKey}>Conectar Semrush ✓</button>
                  </>
                )}
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
    <div style={S.page}>
      <div style={S.topbar}>
        <span style={S.logo}>MBR<span style={{ color: "#f04b20" }}>.</span></span>
        <div style={S.stepDots}>
          <div style={{ ...S.dot, background: "#18c16a" }} />
          <div style={{ ...S.dot, ...S.dotActive }} />
        </div>
      </div>

      <div style={S.content}>
        <div style={S.eyebrow}>Paso 2 de 2</div>
        <h1 style={{ ...S.h1, fontSize: "2rem", marginBottom: "0.4rem" }}>Define tus objetivos y módulos</h1>
        <p style={S.desc}>Ingresá tus North Stars (metas vs. realidad), seleccioná los módulos relevantes, y Claude generará un análisis interpretado.</p>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: "2.5rem", marginTop: "2rem" }}>

          {/* ── Module picker ── */}
          <div>
            {connectedSources.map(source => (
              <div key={source.id} style={{ marginBottom: "1.5rem" }}>
                <div style={S.modGroupHd}>
                  <span style={{ ...S.srcIcon, width: 22, height: 22, fontSize: "0.8rem", background: source.color + "22" }}>{source.icon}</span>
                  <span style={{ flex: 1, fontWeight: 700, fontSize: "0.78rem" }}>{source.label}</span>
                  <span style={S.selAll} onClick={() => toggleAllFromSource(source)}>sel. todos</span>
                </div>
                {source.modules.map(mod => {
                  const on = selectedModules.includes(mod.id)
                  return (
                    <div key={mod.id} style={{ ...S.modItem, ...(on ? S.modItemOn : {}) }} onClick={() => toggleModule(mod.id)}>
                      <div style={{ ...S.modCheck, ...(on ? { background: source.color, borderColor: source.color } : {}) }}>
                        {on ? "✓" : ""}
                      </div>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: "0.8rem", marginBottom: 1 }}>{mod.label}</div>
                        <div style={{ fontSize: "0.7rem", color: "#777" }}>{mod.description}</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ))}
          </div>

          {/* ── Sidebar ── */}
          <div style={{ position: "sticky", top: 72, alignSelf: "start", display: "flex", flexDirection: "column", gap: "0.7rem" }}>

            {/* Info */}
            <div style={S.cfgCard}>
              <div style={S.cfgTitle}>Info del reporte</div>
              {[
                { label: "Nombre del reporte",   key: "reportName",  placeholder: "MBR Enero 2026" },
                { label: "Empresa",              key: "company",     placeholder: "Tu empresa" },
                { label: "Industria/contexto",   key: "industry",    placeholder: "ej: SaaS EdTech B2B" },
                { label: "Dominio",              key: "domain",      placeholder: "tuempresa.com" },
                ...(connected.google_search_console ? [{ label: "URL en Search Console", key: "gscSiteUrl", placeholder: "https://tuempresa.com/ o sc-domain:tuempresa.com" }] : []),
                ...(connected.google_analytics    ? [{ label: "GA4 Property ID",         key: "ga4PropertyId", placeholder: "123456789" }] : []),
                ...(connected.linkedin            ? [{ label: "LinkedIn Org ID",          key: "linkedinOrgId", placeholder: "123456" }] : []),
                ...(connected.meta_ads            ? [{ label: "Meta Ad Account ID",       key: "metaAdAccountId", placeholder: "act_123456789" }] : []),
              ].map(f => (
                <div key={f.key} style={{ marginBottom: "0.7rem" }}>
                  <label style={S.cfgLabel}>{f.label}</label>
                  <input style={S.cfgInput} placeholder={f.placeholder}
                    value={(config as any)[f.key]}
                    onChange={e => setConfig(prev => ({ ...prev, [f.key]: e.target.value }))} />
                </div>
              ))}
            </div>

            {/* North Stars */}
            <div style={S.cfgCard}>
              <div style={S.cfgTitle}>⭐ North Stars — Meta vs. Real</div>
              <div style={{ fontSize: "0.7rem", color: "#777", marginBottom: "0.9rem", lineHeight: 1.6 }}>
                Claude compara real vs. meta y genera la interpretación ejecutiva.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, marginBottom: 4 }}>
                <div style={{ fontSize: "0.6rem", color: "#aaa", fontFamily: "monospace", textAlign: "center" }}>Meta</div>
                <div style={{ fontSize: "0.6rem", color: "#aaa", fontFamily: "monospace", textAlign: "center" }}>Real</div>
              </div>
              {config.northStars.map((ns, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "auto 1fr 1fr", gap: 5, marginBottom: 5, alignItems: "center" }}>
                  <input style={{ ...S.cfgInput, fontSize: "0.65rem", padding: "5px 7px", gridColumn: "1/-1" }}
                    placeholder={`North Star ${i+1}`} value={ns.label}
                    onChange={e => updateNorthStar(i, "label", e.target.value)} />
                  <input style={{ ...S.cfgInput, fontSize: "0.68rem", padding: "5px 8px", textAlign: "center" }}
                    placeholder="Meta" value={ns.goal}
                    onChange={e => updateNorthStar(i, "goal", e.target.value)} />
                  <input style={{ ...S.cfgInput, fontSize: "0.68rem", padding: "5px 8px", textAlign: "center" }}
                    placeholder="Real" value={ns.real}
                    onChange={e => updateNorthStar(i, "real", e.target.value)} />
                </div>
              ))}
            </div>

            <button
              style={{ ...S.btnPrimary, opacity: selectedModules.length === 0 || generating ? 0.4 : 1, cursor: selectedModules.length === 0 ? "not-allowed" : "pointer" }}
              disabled={selectedModules.length === 0 || generating}
              onClick={generateReport}>
              {generating ? "⟳ Generando reporte…" : "Generar reporte con IA →"}
            </button>
            <div style={{ fontFamily: "monospace", fontSize: "0.68rem", color: "#666", textAlign: "center" }}>
              {selectedModules.length === 0 ? "Seleccioná al menos 1 módulo" : `${selectedModules.length} módulos seleccionados`}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════
const S: Record<string, React.CSSProperties> = {
  page:        { minHeight: "100vh", background: "#0b0b0f", color: "#eceae4", fontFamily: "'Syne', sans-serif" },
  loadingScreen: { minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#0b0b0f" },
  spinner:     { width: 32, height: 32, border: "3px solid rgba(240,75,32,.2)", borderTopColor: "#f04b20", borderRadius: "50%", animation: "spin 0.7s linear infinite" },
  topbar:      { display: "flex", alignItems: "center", padding: "1rem 2.5rem", background: "rgba(11,11,15,.95)", backdropFilter: "blur(16px)", borderBottom: "1px solid rgba(255,255,255,.07)", position: "sticky", top: 0, zIndex: 100, gap: 14 },
  logo:        { fontWeight: 800, fontSize: "1.15rem", letterSpacing: "-0.5px", fontFamily: "'Syne', sans-serif" },
  stepDots:    { marginLeft: "auto", display: "flex", gap: 6, alignItems: "center" },
  dot:         { width: 8, height: 8, borderRadius: "50%", background: "rgba(255,255,255,.1)", border: "1px solid rgba(255,255,255,.1)", transition: "all .3s" },
  dotActive:   { background: "#f04b20", borderColor: "#f04b20", width: 22, borderRadius: 4 },
  content:     { maxWidth: 1060, margin: "0 auto", padding: "3rem 2.5rem" },
  eyebrow:     { fontFamily: "monospace", fontSize: "0.6rem", color: "#f04b20", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "0.6rem" },
  h1:          { fontFamily: "'Fraunces', serif", fontSize: "2.8rem", fontWeight: 300, letterSpacing: "-1px", lineHeight: 1.15, marginBottom: "0.8rem" },
  desc:        { fontSize: "0.88rem", color: "#777", maxWidth: 480, lineHeight: 1.8, marginBottom: "0.5rem" },
  sourceRow:   { display: "flex", alignItems: "center", gap: "1rem", padding: "1rem 1.4rem", background: "#131318", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, transition: "border-color .2s" },
  sourceRowConn: { borderColor: "rgba(24,193,106,.25)", background: "rgba(24,193,106,.03)" },
  srcIcon:     { width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.15rem", flexShrink: 0 },
  srcName:     { fontWeight: 700, fontSize: "0.85rem", marginBottom: 1 },
  srcDesc:     { fontSize: "0.7rem", color: "#666" },
  srcApiTag:   { fontSize: "0.62rem", color: "#ff642d", fontFamily: "monospace", marginTop: 3 },
  btnConn:     { padding: "7px 18px", borderRadius: 8, border: "none", background: "rgba(255,255,255,.08)", color: "#eceae4", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.78rem", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" },
  btnDisconn:  { padding: "7px 14px", borderRadius: 8, border: "1px solid rgba(24,193,106,.3)", background: "rgba(24,193,106,.08)", color: "#18c16a", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.72rem", cursor: "pointer", flexShrink: 0, whiteSpace: "nowrap" },
  continueBar: { display: "flex", alignItems: "center", justifyContent: "space-between", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,.07)" },
  btnPrimary:  { padding: "12px 28px", background: "#f04b20", border: "none", borderRadius: 10, color: "white", fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", transition: "all .2s", width: "100%" },
  modGroupHd:  { display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.76rem", marginBottom: "0.6rem", paddingBottom: "0.5rem", borderBottom: "1px solid rgba(255,255,255,.07)" },
  selAll:      { marginLeft: "auto", fontSize: "0.62rem", color: "#666", fontWeight: 400, cursor: "pointer", fontFamily: "monospace" },
  modItem:     { display: "flex", alignItems: "flex-start", gap: 9, padding: "9px 11px", border: "1px solid rgba(255,255,255,.07)", borderRadius: 10, cursor: "pointer", marginBottom: "0.35rem", transition: "all .15s" },
  modItemOn:   { background: "rgba(255,255,255,.04)" },
  modCheck:    { width: 17, height: 17, borderRadius: 5, border: "1px solid rgba(255,255,255,.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.58rem", fontWeight: 700, color: "white", flexShrink: 0, marginTop: 1, transition: "all .15s" },
  cfgCard:     { background: "#131318", border: "1px solid rgba(255,255,255,.07)", borderRadius: 14, padding: "1.2rem" },
  cfgTitle:    { fontFamily: "monospace", fontSize: "0.58rem", color: "#666", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "0.9rem" },
  cfgLabel:    { fontSize: "0.62rem", fontWeight: 700, color: "#666", textTransform: "uppercase", letterSpacing: "1px", display: "block", marginBottom: 4 },
  cfgInput:    { width: "100%", padding: "8px 11px", background: "rgba(255,255,255,.04)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 7, color: "#eceae4", fontFamily: "monospace", fontSize: "0.73rem", outline: "none", boxSizing: "border-box" },

  // Semrush popup
  overlay:     { position: "fixed", inset: 0, background: "rgba(0,0,0,.78)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 999, backdropFilter: "blur(10px)" },
  srCard:      { background: "#fff", borderRadius: 20, width: 520, maxWidth: "94vw", display: "flex", flexDirection: "column", maxHeight: "90vh", color: "#111", overflow: "hidden" },
  srHead:      { padding: "1.6rem 2rem 1.2rem", borderBottom: "1px solid #f0f0f0", flexShrink: 0 },
  srLogoPill:  { background: "#fff8f5", border: "1px solid #ffe0d5", borderRadius: 10, padding: "6px 12px", fontFamily: "sans-serif", fontSize: "0.85rem", fontWeight: 700, color: "#ff642d", display: "flex", alignItems: "center", gap: 7 },
  srHeadTitle: { fontFamily: "sans-serif", fontWeight: 700, fontSize: "1rem", color: "#111" },
  srHeadSub:   { fontFamily: "sans-serif", fontSize: "0.72rem", color: "#aaa", marginTop: 2 },
  srBody:      { padding: "1.6rem 2rem", overflowY: "auto", flex: 1 },
  srPanelTitle:{ fontFamily: "sans-serif", fontWeight: 700, fontSize: "0.9rem", marginBottom: "1.2rem" },
  srTutStep:   { display: "flex", gap: 14, marginBottom: "1.2rem", alignItems: "flex-start" },
  srTutNum:    { width: 28, height: 28, borderRadius: "50%", background: "#ff642d", color: "white", fontSize: "0.78rem", fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "sans-serif" },
  srTutTitle:  { fontFamily: "sans-serif", fontWeight: 700, fontSize: "0.85rem", marginBottom: 3 },
  srTutDesc:   { fontFamily: "sans-serif", fontSize: "0.78rem", color: "#666", lineHeight: 1.6 },
  srTutLink:   { display: "inline-flex", alignItems: "center", gap: 5, marginTop: 6, background: "#fff5f2", border: "1px solid #ffd5c8", color: "#ff642d", fontFamily: "sans-serif", fontSize: "0.75rem", fontWeight: 700, padding: "5px 12px", borderRadius: 7, textDecoration: "none", cursor: "pointer" },
  srNote:      { background: "#fffbf0", border: "1px solid #f5d87a", borderRadius: 10, padding: "0.8rem 1rem", fontFamily: "sans-serif", fontSize: "0.75rem", color: "#7a5c00", lineHeight: 1.6, display: "flex", gap: 8, alignItems: "flex-start" },
  srKeyBox:    { background: "#f8f8f8", border: "2px solid #e8e8e8", borderRadius: 12, padding: "1.1rem", marginBottom: "1rem", transition: "border-color .2s" },
  srKeyLabel:  { fontFamily: "sans-serif", fontSize: "0.62rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1.5px", color: "#aaa", display: "block", marginBottom: "0.5rem" },
  srKeyInput:  { flex: 1, background: "transparent", border: "none", outline: "none", fontFamily: "monospace", fontSize: "0.88rem", color: "#111", minWidth: 0, width: "100%" },
  srToggleBtn: { background: "none", border: "1px solid #ddd", borderRadius: 6, padding: "4px 10px", fontSize: "0.9rem", cursor: "pointer", flexShrink: 0 },
  srSecNote:   { background: "#f0faf5", border: "1px solid #b8eacf", borderRadius: 9, padding: "0.8rem", fontFamily: "sans-serif", fontSize: "0.72rem", color: "#2d6a4a", lineHeight: 1.5, display: "flex", gap: 8, alignItems: "flex-start" },
  srVerifiedPill: { background: "#f0fdf5", border: "1px solid #b8eacf", borderRadius: 20, padding: "5px 14px", fontFamily: "sans-serif", fontSize: "0.72rem", fontWeight: 700, color: "#1a7a4a", display: "flex", alignItems: "center", gap: 5 },
  srKeyMasked: { fontFamily: "monospace", fontSize: "0.75rem", color: "#888", background: "#f5f5f5", padding: "3px 10px", borderRadius: 6 },
  srAccessRow: { display: "flex", alignItems: "center", gap: 10, padding: "10px 0", borderBottom: "1px solid #f0f0f0" },
  srFoot:      { padding: "1rem 2rem 1.4rem", borderTop: "1px solid #f0f0f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 },
  srBtnSec:    { background: "#f0f0f0", border: "none", color: "#666", fontFamily: "sans-serif", fontSize: "0.82rem", padding: "9px 20px", borderRadius: 8, cursor: "pointer" },
  srBtnPri:    { background: "#ff642d", border: "none", color: "white", fontFamily: "sans-serif", fontWeight: 700, fontSize: "0.82rem", padding: "9px 22px", borderRadius: 8, cursor: "pointer" },
}
