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
    description: "Clicks, impresiones, CTR, posiciones orgánicas",
    color: "#4285f4", icon: "🔍", authMethod: "oauth",
    authPath: "/api/auth/google?scope=gsc",
    tokenCookie: "mbr_google_token",
    modules: [
      { id: "gsc_summary", label: "Resumen SEO",     description: "Clicks, impresiones, CTR y posición promedio", sourceId: "google_search_console" },
      { id: "gsc_queries", label: "Top Queries",      description: "Las 20 keywords con más clicks del mes",        sourceId: "google_search_console" },
      { id: "gsc_trend",   label: "Tendencia diaria", description: "Evolución de clicks e impresiones 30 días",     sourceId: "google_search_console" },
    ],
  },
  {
    id: "google_analytics",
    label: "Google Analytics 4",
    description: "Sesiones, usuarios, conversiones, canales",
    color: "#e37400", icon: "📊", authMethod: "oauth",
    authPath: "/api/auth/google?scope=ga4",
    tokenCookie: "mbr_google_token",
    modules: [
      { id: "ga4_traffic",     label: "Tráfico por canal", description: "Orgánico, pagado, directo, social",        sourceId: "google_analytics" },
      { id: "ga4_conversions", label: "Conversiones",       description: "Tasa de conversión y objetivos por canal", sourceId: "google_analytics" },
      { id: "ga4_pages",       label: "Páginas top",        description: "Las 10 páginas con más sesiones",          sourceId: "google_analytics" },
    ],
  },
  {
    id: "semrush",
    label: "Semrush",
    description: "AI Overview, keyword rankings, visibilidad SEO",
    color: "#ff642d", icon: "🤖",
    authMethod: "apikey",
    tokenCookie: "mbr_semrush_apikey",
    modules: [
      { id: "semrush_ai_overview", label: "AI Overview",          description: "Keywords en respuestas de Google AI",        sourceId: "semrush" },
      { id: "semrush_rankings",    label: "Posicionamiento",       description: "Top keywords orgánicas y su evolución",       sourceId: "semrush" },
      { id: "semrush_competitors", label: "Visibilidad vs. comp.", description: "Share of voice frente a competidores SEO",    sourceId: "semrush" },
    ],
  },
  {
    id: "linkedin",
    label: "LinkedIn Analytics",
    description: "Seguidores, engagement, benchmark de competencia",
    color: "#0077b5", icon: "💼", authMethod: "oauth",
    authPath: "/api/auth/linkedin",
    tokenCookie: "mbr_linkedin_token",
    modules: [
      { id: "linkedin_page",      label: "Métricas de página",   description: "Seguidores, impresiones, clicks, engagement",      sourceId: "linkedin" },
      { id: "linkedin_benchmark", label: "Benchmark competencia", description: "Comparación de seguidores y engagement vs. rivales", sourceId: "linkedin" },
    ],
  },
  {
    id: "meta_ads",
    label: "Meta Ads",
    description: "Facebook e Instagram — alcance, ROAS, conversiones",
    color: "#1877f2", icon: "📱", authMethod: "oauth",
    authPath: "/api/auth/meta",
    tokenCookie: "mbr_meta_token",
    modules: [
      { id: "meta_summary",   label: "Resumen de campañas", description: "Inversión, alcance, CPM, CPC, ROAS global",   sourceId: "meta_ads" },
      { id: "meta_campaigns", label: "Top campañas",         description: "Las 10 campañas con mejor y peor performance", sourceId: "meta_ads" },
    ],
  },
  {
    id: "google_ads",
    label: "Google Ads",
    description: "Campañas SEM, Quality Score, ROAS, conversiones",
    color: "#34a853", icon: "🎯", authMethod: "oauth",
    authPath: "/api/auth/google?scope=ads",
    tokenCookie: "mbr_google_token",
    modules: [
      { id: "gads_summary",  label: "Resumen SEM",  description: "Inversión, CPC, conversiones, ROAS",            sourceId: "google_ads" },
      { id: "gads_keywords", label: "Keywords SEM", description: "Keywords con mayor gasto y mejor conversión",    sourceId: "google_ads" },
    ],
  },
  {
    id: "hubspot",
    label: "HubSpot",
    description: "Leads, deals, pipeline, email marketing",
    color: "#ff7a59", icon: "🧲", authMethod: "oauth",
    authPath: "/api/auth/hubspot",
    tokenCookie: "mbr_hubspot_token",
    modules: [
      { id: "hubspot_leads", label: "Leads & Pipeline", description: "Nuevos leads, MQLs, SQLs, deals abiertos",  sourceId: "hubspot" },
      { id: "hubspot_email", label: "Email Marketing",   description: "Open rate, CTR, unsubscribes por campaña",  sourceId: "hubspot" },
    ],
  },
]

export const ALL_MODULES: Module[] = SOURCES.flatMap((s) => s.modules)
export function getSource(id: SourceId): Source { return SOURCES.find((s) => s.id === id)! }
