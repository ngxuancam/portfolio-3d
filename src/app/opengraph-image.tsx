import { ImageResponse } from "next/og";
import { defaultTheme } from "@/theme/themes";
import { resume } from "@/content/resume";

export const alt = `${resume.basics.name} — ${resume.basics.label}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  const { basics } = resume;
  const o = defaultTheme.og;
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
          background: o.bg,
          color: o.text, borderTop: `1px solid ${o.rule}`, borderBottom: `1px solid ${o.rule}`,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 26, color: o.label, letterSpacing: 6 }}>
          {basics.label.toUpperCase()}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div style={{ fontSize: 92, fontWeight: 700, lineHeight: 1 }}>{basics.name}</div>
          <div style={{ fontSize: 36, color: o.sub }}>{basics.headline}</div>
        </div>
        <div style={{ display: "flex", fontSize: 24, color: o.footer }}>
          {`${basics.location.city}, ${basics.location.countryCode} · ${new URL(basics.siteUrl).host}`}
        </div>
      </div>
    ),
    size,
  );
}
