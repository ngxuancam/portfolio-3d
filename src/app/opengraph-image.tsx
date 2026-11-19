import { ImageResponse } from "next/og";
import { resume } from "@/content/resume";

export const alt = `${resume.basics.name} — ${resume.basics.label}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Lab palette, duplicated as literals: the OG renderer (Satori) cannot read CSS variables. */
const VOID = "#050607";
const INK = "#e9e7e1";
const INK_2 = "#a5a7aa";
const INK_3 = "#6d7074";
const RULE = "rgba(233, 231, 225, 0.12)";
const SIGNAL = "#b46bff";
const SIGNAL_2 = "#d7b4ff";

const INSET = 48;
const MARK = 14;

/** One square registration mark per corner of the frame, as on the site's chapters. */
function Corner({ x, y }: { x: "left" | "right"; y: "top" | "bottom" }) {
  return (
    <div
      style={{
        position: "absolute",
        [x]: INSET - 1,
        [y]: INSET - 1,
        width: MARK,
        height: MARK,
        display: "flex",
        [`border${y === "top" ? "Top" : "Bottom"}`]: `2px solid ${INK_3}`,
        [`border${x === "left" ? "Left" : "Right"}`]: `2px solid ${INK_3}`,
      }}
    />
  );
}

/**
 * Share card in the dark "Lab" look: void ground, hairline frame with corner marks, a mono-style
 * HUD strip, the name set large and light. Only the bundled default font is available here,
 * so lightness comes from size, tracking and colour rather than an ultralight weight.
 */
export default function OpengraphImage() {
  const { basics, updatedAt } = resume;
  const host = new URL(basics.siteUrl).host;
  const label = (text: string) => text.toUpperCase();

  return new ImageResponse(
    (
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          display: "flex",
          background: VOID,
          color: INK,
          fontFamily: "sans-serif",
        }}
      >
        {/* faint 12-column hairline grid behind everything */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            backgroundImage: `linear-gradient(to right, ${RULE} 1px, transparent 1px)`,
            backgroundSize: "100px 100%",
            opacity: 0.5,
          }}
        />

        <div
          style={{
            position: "absolute",
            top: INSET,
            left: INSET,
            right: INSET,
            bottom: INSET,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "40px 48px",
            border: `1px solid ${RULE}`,
          }}
        >
          {/* HUD strip: index · rule · readout */}
          <div style={{ display: "flex", alignItems: "center", gap: 20, fontSize: 18, letterSpacing: 4 }}>
            <div style={{ display: "flex", color: INK }}>
              <span style={{ color: SIGNAL_2 }}>00</span>
              <span style={{ marginLeft: 12 }}>{label("/ Log start")}</span>
            </div>
            <div style={{ display: "flex", flex: 1, height: 1, background: RULE }} />
            <div style={{ display: "flex", color: INK_2 }}>{label(`Rev ${updatedAt}`)}</div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <div style={{ display: "flex", fontSize: 20, letterSpacing: 4, color: INK_2 }}>
              {label(`${basics.label}  /  ${basics.location.city}, ${basics.location.countryCode}`)}
            </div>
            <div style={{ display: "flex", fontSize: 108, lineHeight: 1.02, letterSpacing: -4, color: INK }}>
              {basics.name}
            </div>
            <div style={{ display: "flex", maxWidth: 820, fontSize: 32, lineHeight: 1.3, color: INK_2 }}>
              {basics.headline}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 18, letterSpacing: 4 }}>
            <div style={{ display: "flex", width: 10, height: 10, background: SIGNAL }} />
            <div style={{ display: "flex", color: INK }}>{label(basics.availability)}</div>
            <div style={{ display: "flex", flex: 1 }} />
            <div style={{ display: "flex", color: INK_2 }}>{label(host)}</div>
          </div>
        </div>

        <Corner x="left" y="top" />
        <Corner x="right" y="top" />
        <Corner x="left" y="bottom" />
        <Corner x="right" y="bottom" />
      </div>
    ),
    size,
  );
}
