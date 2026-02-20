// lib/sources.ts
// Google / LinkedIn / Meta / HubSpot → OAuth SSO
// Semrush → API Key personal del usuario (no requiere registro de app)

export type SourceId =
  | "google_search_console"
  | "google_analytics"
  | "google_ads"
  | "semrush"
  | "linkedin"
  | "meta_ads"
  | "hubspot"

export type AuthMethod = "oauth" | "apikey"

export interface Source {
  id: SourceId
  label: string
  description: string
  color: string
  icon: string
  authMethod: AuthMethod
  authPath?: string
  tokenCookie: string
  modules: Module[]
}

export interface Module {
  id: string
  label: string
  description: string
  sourceId: SourceId
}

export const SOURCES: Source[] = [
  {
    id: "google_search_console",
    label: "Search Console",
    description: "Cómo rinde tu SEO — clicks, posiciones, tráfico orgánico",
    color: "#4285f4", icon: "🔍", authMethod: "oauth",
    authPath: "/api/auth/google?scope=gsc",
    tokenCookie: "mbr_google_token",
    modules: [
      { id: "gsc_summary", label: "Rendimiento SEO",     description: "Clicks, impresiones, CTR y posición promedio", sourceId: "google_search_console" },
      { id: "gsc_queries", label: "Keywords que generan tráfico",      description: "Top 20 keywords con más clicks del mes",        sourceId: "google_search_console" },
      { id: "gsc_trend",   label: "Tendencia (últimos 30 días)", description: "Evolución de clicks e impresiones",     sourceId: "google_search_console" },
    ],
  },
  {
    id: "google_analytics",
    label: "Google Analytics 4",
    description: "Dónde viene tu audiencia y cuál convierte",
    color: "#e37400", icon: "📊", authMethod: "oauth",
    authPath: "/api/auth/google?scope=ga4",
    tokenCookie: "mbr_google_token",
    modules: [
      { id: "ga4_traffic",     label: "Dónde viene tu audiencia", description: "Tráfico por canal: orgánico, pagado, directo, social",        sourceId: "google_analytics" },
      { id: "ga4_conversions", label: "Cuál canal convierte más",       description: "Conversiones y CR por cada canal de adquisición", sourceId: "google_analytics" },
      { id: "ga4_pages",       label: "Páginas con más engagement",        description: "Top 10 páginas con más sesiones",          sourceId: "google_analytics" },
    ],
  },
  {
    id: "semrush",
    label: "Semrush",
    description: "Tu posicionamiento vs competencia — SEO intelligence",
    color: "#ff642d", icon: "🤖",
    authMethod: "apikey",
    tokenCookie: "mbr_semrush_apikey",
    modules: [
      { id: "semrush_ai_overview", label: "Visibilidad en Google AI",          description: "Keywords que aparecen en respuestas de IA",        sourceId: "semrush" },
      { id: "semrush_rankings",    label: "Tu ranking SEO",       description: "Top keywords donde posicionas y su evolución",       sourceId: "semrush" },
      { id: "semrush_competitors", label: "Cómo competís en SEO", description: "Share of voice vs competidores",    sourceId: "semrush" },
    ],
  },
  {
    id: "linkedin",
    label: "LinkedIn Analytics",
    description: "Tu presencia en LinkedIn vs competencia",
    color: "#0077b5", icon: "💼", authMethod: "oauth",
    authPath: "/api/auth/linkedin",
    tokenCookie: "mbr_linkedin_token",
    modules: [
      { id: "linkedin_page",      label: "Métricas de tu página",   description: "Seguidores, alcance, engagement, clicks",      sourceId: "linkedin" },
      { id: "linkedin_benchmark", label: "Cómo creces vs competencia", description: "Benchmark de seguidores y engagement", sourceId: "linkedin" },
    ],
  },
  {
    id: "meta_ads",
    label: "Meta Ads",
    description: "Eficiencia de tu inversión en Facebook e Instagram",
    color: "#1877f2", icon: "📱", authMethod: "oauth",
    authPath: "/api/auth/meta",
    tokenCookie: "mbr_meta_token",
    modules: [
      { id: "meta_summary",   label: "Resumen de inversión pagada", description: "ROAS, alcance, CPM, conversiones totales",   sourceId: "meta_ads" },
      { id: "meta_campaigns", label: "Campañas: best vs worst",         description: "Top y bottom performers", sourceId: "meta_ads" },
    ],
  },
  {
    id: "google_ads",
    label: "Google Ads",
    description: "Performance de tu SEM y ROI por keyword",
    color: "#34a853", icon: "🎯", authMethod: "oauth",
    authPath: "/api/auth/google?scope=ads",
    tokenCookie: "mbr_google_token",
    modules: [
      { id: "gads_summary",  label: "Resumen SEM",  description: "Inversión, CPC, conversiones, ROAS",            sourceId: "google_ads" },
      { id: "gads_keywords", label: "Keywords: mejor ROI", description: "Top keywords por conversión y gasto",    sourceId: "google_ads" },
    ],
  },
  {
    id: "hubspot",
    label: "HubSpot",
    description: "Pipeline de sales y efectividad del email marketing",
    color: "#ff7a59", icon: "🧲", authMethod: "oauth",
    authPath: "/api/auth/hubspot",
    tokenCookie: "mbr_hubspot_token",
    modules: [
      { id: "hubspot_leads", label: "Leads y pipeline de sales", description: "Nuevos leads, MQLs, SQLs, deals abiertos",  sourceId: "hubspot" },
      { id: "hubspot_email", label: "Performance del email marketing",   description: "Open rate, CTR, unsubscribes",  sourceId: "hubspot" },
    ],
  },
]

export const ALL_MODULES: Module[] = SOURCES.flatMap((s) => s.modules)
export function getSource(id: SourceId): Source { return SOURCES.find((s) => s.id === id)! }
