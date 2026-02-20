// app/layout.tsx
import type { Metadata } from "next"
export const metadata: Metadata = { title: "MBR Marketing" }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=Lora:ital,wght@0,400;0,600;1,400&display=swap" rel="stylesheet" />
      </head>
      <body style={{ margin: 0, background: "#0c0c10", fontFamily: "'Syne', sans-serif" }}>
        {children}
      </body>
    </html>
  )
}
