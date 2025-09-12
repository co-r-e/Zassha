import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OGImageJa() {
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
            "linear-gradient(135deg, #0b1220 0%, #121a2b 50%, #1c2437 100%)",
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
              background: "#3b82f6",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "white",
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
        <div style={{ fontSize: 24, color: "#93c5fd" }}>
          操作ごとのスクリーンショット・Word/Excel エクスポート・Gemini 解析
        </div>
        <div style={{ position: "absolute", bottom: 40, right: 72, fontSize: 20, color: "#9ca3af" }}>
          © {new Date().getFullYear()} CORe Inc.
        </div>
      </div>
    ),
    { ...size }
  );
}
