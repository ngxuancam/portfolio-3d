import type { MetadataRoute } from "next";
import { resume } from "@/content/resume";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${resume.basics.name} — ${resume.basics.label}`,
    short_name: resume.basics.givenName,
    description: resume.basics.headline,
    start_url: "/",
    display: "standalone",
    background_color: "#fdfbf7",
    theme_color: "#1b2430",
    icons: [{ src: "/favicon.ico", sizes: "any", type: "image/x-icon" }],
  };
}
