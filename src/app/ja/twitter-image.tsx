import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function TwitterImageJa() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: 72,
          background:
            "radial-gradient(80% 80% at 20% 20%, #1f2a44 0%, rgba(31,42,68,0) 60%), linear-gradient(135deg, #0b1220 0%, #1c2437 100%)",
          color: "#e5e7eb",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, 'Helvetica Neue', Arial, 'Noto Sans JP', 'Apple Color Emoji', 'Segoe UI Emoji'",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 12,
              background: "#22d3ee",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#0b1220",
              fontSize: 40,
              fontWeight: 800,
            }}
          >
            Z
          </div>
          <div style={{ fontSize: 48, fontWeight: 800, color: "#f8fafc" }}>ZASSHA</div>
        </div>
        <div style={{ height: 28 }} />
        <div style={{ fontSize: 36, lineHeight: 1.25, color: "#e2e8f0" }}>
          画面録画から再現可能な業務手順を自動作成
        </div>
        <div style={{ height: 12 }} />
        <div style={{ fontSize: 24, color: "#a5b4fc" }}>
          構造化ワークフロー・スクリーンショット・Word/Excel エクスポート
        </div>
      </div>
    ),
    { ...size }
  );
}
