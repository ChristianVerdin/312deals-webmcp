import { ImageResponse } from "next/og"
import { NextRequest, NextResponse } from "next/server"

export const runtime = "edge"

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl
    const title = searchParams.get("title") || "Chicago Food & Drink Deals"
    const subtitle = searchParams.get("subtitle") || ""
    const detail = searchParams.get("detail") || "" // deal specifics: days · times · price
    const type = searchParams.get("type") || "" // deal type label
    const neighborhood = searchParams.get("neighborhood") || ""
    const emoji = searchParams.get("emoji") || "" // decorative glyph, e.g. ⚽ 🍺 🌮
    const accent = searchParams.get("accent") || "#D4940A"
    // Comma-separated stat chips, e.g. "520+ bars,99 neighborhoods,Jun 11–Jul 19"
    const badges = (searchParams.get("badges") || "")
      .split(",")
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 3)

    return new ImageResponse(
      (
        <div
          style={{
            width: 1200,
            height: 630,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: 64,
            background: "linear-gradient(135deg, #1A1A2E 0%, #16213E 45%, #0F3460 100%)",
            fontFamily: "system-ui, sans-serif",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Top accent bar */}
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              height: 8,
              background: `linear-gradient(90deg, ${accent} 0%, #E8AB1E 50%, ${accent} 100%)`,
              display: "flex",
            }}
          />

          {/* Layered glows for depth */}
          <div
            style={{
              position: "absolute",
              top: -140,
              right: -120,
              width: 480,
              height: 480,
              borderRadius: 480,
              background: "rgba(212, 148, 10, 0.16)",
              display: "flex",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: -180,
              left: -120,
              width: 460,
              height: 460,
              borderRadius: 460,
              background: "rgba(16, 185, 129, 0.10)",
              display: "flex",
            }}
          />

          {/* Oversized emoji watermark */}
          {emoji ? (
            <div
              style={{
                position: "absolute",
                bottom: -40,
                right: 36,
                fontSize: 360,
                opacity: 0.16,
                display: "flex",
              }}
            >
              {emoji}
            </div>
          ) : null}

          {/* Top row: emoji + badges */}
          <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
            {emoji ? (
              <div
                style={{
                  width: 92,
                  height: 92,
                  borderRadius: 24,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 56,
                }}
              >
                {emoji}
              </div>
            ) : null}
            {type ? (
              <div
                style={{
                  background: accent,
                  color: "white",
                  padding: "10px 22px",
                  borderRadius: 9999,
                  fontSize: 26,
                  fontWeight: 700,
                  display: "flex",
                }}
              >
                {type}
              </div>
            ) : null}
            {neighborhood ? (
              <div
                style={{
                  background: "rgba(212, 148, 10, 0.15)",
                  color: "#E8AB1E",
                  padding: "10px 22px",
                  borderRadius: 9999,
                  fontSize: 26,
                  fontWeight: 600,
                  border: "1px solid rgba(212, 148, 10, 0.3)",
                  display: "flex",
                }}
              >
                {neighborhood}
              </div>
            ) : null}
            {badges.map((b) => (
              <div
                key={b}
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#FAF7F2",
                  padding: "10px 20px",
                  borderRadius: 9999,
                  fontSize: 24,
                  fontWeight: 600,
                  border: "1px solid rgba(255,255,255,0.14)",
                  display: "flex",
                }}
              >
                {b}
              </div>
            ))}
          </div>

          {/* Center: title + subtitle */}
          <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 940 }}>
            <div
              style={{
                fontSize: title.length > 50 ? 60 : 74,
                fontWeight: 800,
                color: "white",
                lineHeight: 1.05,
                letterSpacing: "-0.02em",
                display: "flex",
              }}
            >
              {title}
            </div>
            {subtitle ? (
              <div
                style={{
                  fontSize: 34,
                  color: accent,
                  lineHeight: 1.25,
                  fontWeight: 600,
                  display: "flex",
                }}
              >
                {subtitle}
              </div>
            ) : null}
            {detail ? (
              <div
                style={{
                  fontSize: 30,
                  color: "#CBD5E1",
                  lineHeight: 1.3,
                  fontWeight: 500,
                  display: "flex",
                }}
              >
                {detail.length > 120 ? detail.slice(0, 119) + "…" : detail}
              </div>
            ) : null}
          </div>

          {/* Bottom: branding */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 16,
                  background: "linear-gradient(135deg, #D4940A 0%, #B87A08 100%)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 24,
                  fontWeight: 800,
                  color: "white",
                }}
              >
                312
              </div>
              <div style={{ fontSize: 36, fontWeight: 700, display: "flex" }}>
                <div style={{ color: "#D4940A", display: "flex" }}>312</div>
                <div style={{ color: "white", display: "flex" }}>Deals</div>
              </div>
            </div>
            <div
              style={{
                fontSize: 23,
                color: "rgba(255, 255, 255, 0.45)",
                fontWeight: 500,
                display: "flex",
              }}
            >
              Free deals across all of Chicagoland
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        emoji: "twemoji",
      }
    )
  } catch (e) {
    console.error("OG image generation failed:", e)
    return new NextResponse("OG image generation failed", { status: 500 })
  }
}
