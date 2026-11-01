import { ImageResponse } from "next/og";
import { resume } from "@/content/resume";

export const alt = `${resume.basics.name} — ${resume.basics.label}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const { basics } = resume;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "#fdfbf7",
          color: "#1b2430", borderTop: "1px solid #c2a679", borderBottom: "1px solid #c2a679",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: "#4a0e17", letterSpacing: 6 }}>
          {basics.label.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1 }}>{basics.name}</div>
          <div style={{ fontSize: 36, color: "#545c68" }}>{basics.headline}</div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: "#9c8256" }}>
          {`${basics.location.city}, ${basics.location.countryCode} · ${new URL(basics.siteUrl).host}`}
        </div>
      </div>
    ),
    size,
  );
}
