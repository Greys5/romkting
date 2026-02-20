# MBR Marketing App v3

Reporte mensual de marketing con OAuth SSO, API Key de Semrush, e interpretación ejecutiva generada por Claude.

## Stack
- **Next.js 14** (App Router)
- **Claude API** (Anthropic) — Executive Summary streaming
- **OAuth SSO** — Google, LinkedIn, Meta, HubSpot
- **API Key** — Semrush (flujo de 3 pasos con tutorial integrado)

## Fuentes de datos
| Fuente | Método | Registrás app? |
|--------|--------|---------------|
| Google (GSC + GA4 + Ads) | OAuth | ✅ Sí (1 vez) |
| LinkedIn | OAuth | ✅ Sí (1 vez) |
| Meta Ads | OAuth | ✅ Sí (1 vez) |
| HubSpot | OAuth | ✅ Sí (1 vez) |
| **Semrush** | **API Key personal** | ❌ No |

## Setup rápido

### 1. Clonar y configurar
```bash
cd mbr-v3
cp .env.example .env.local
# Completar las variables en .env.local
npm install
npm run dev
```

### 2. Variables requeridas mínimas
- `ANTHROPIC_API_KEY` — para el Executive Summary con IA
- `GOOGLE_CLIENT_ID` + `GOOGLE_CLIENT_SECRET` — para GSC, GA4, Google Ads
- Las demás según qué fuentes quieras conectar

### 3. Deploy en Vercel
```bash
npx vercel
# Luego en Vercel Dashboard → Settings → Environment Variables
# Agregar todas las variables del .env.example
```

### 4. Redirect URIs — actualizar en cada plataforma
Una vez que tenés la URL de Vercel (ej: `https://mbr-app.vercel.app`), actualizá:
- **Google**: console.cloud.google.com → OAuth → Redirect URIs
- **LinkedIn**: linkedin.com/developers → Redirect URLs
- **Meta**: developers.facebook.com → Valid OAuth redirect URIs
- **HubSpot**: developers.hubspot.com → Redirect URL

### Semrush — no requiere setup
Cada usuario ingresa su propia API Key directamente en la app.
La key se guarda en cookie httpOnly de su browser, nunca en tu servidor.

## Estructura
```
app/
├── page.tsx                    # Steps 1 (connect) y 2 (configure)
├── components/
│   └── ReportView.tsx          # Step 3: reporte + Executive Summary
├── api/
│   ├── auth/
│   │   ├── google/route.ts     # OAuth Google (GSC + GA4 + Ads)
│   │   ├── linkedin/route.ts   # OAuth LinkedIn
│   │   ├── meta/route.ts       # OAuth Meta
│   │   ├── hubspot/route.ts    # OAuth HubSpot
│   │   ├── semrush/route.ts    # API Key Semrush (POST=validar, DELETE=desconectar)
│   │   ├── status/route.ts     # Estado de conexiones
│   │   └── disconnect/route.ts # Desconectar fuente
│   ├── report/route.ts         # Llama APIs y devuelve datos
│   └── exec-summary/route.ts   # Proxy streaming Claude
lib/
├── sources.ts                  # Definición de fuentes y módulos
├── session.ts                  # Helpers de cookies
└── oauth-state.ts              # CSRF state para OAuth
```
