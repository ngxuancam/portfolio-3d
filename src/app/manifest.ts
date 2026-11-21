import type { MetadataRoute } from "next";
import { resume } from "@/content/resume";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${resume.basics.name} — ${resume.basics.label}`,
    short_name: resume.basics.givenName,
    description: resume.basics.headline,
    start_url: "/",
    display: "standalone",
    background_color: "#050607",
    theme_color: "#050607",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
