import type { Metadata, Viewport } from "next";
import { resume } from "@/content/resume";

const { basics, skillGroups } = resume;

export const siteUrl = new URL(basics.siteUrl);
export const siteTitle = `${basics.name} — ${basics.label}`;

/** Factory: one place that turns résumé data into Next.js `Metadata`. */
export function createSiteMetadata(): Metadata {
  const keywords = skillGroups.flatMap((g) => g.skills.map((s) => s.name));

  return {
    metadataBase: siteUrl,
    title: { default: siteTitle, template: `%s · ${basics.name}` },
    description: basics.summary,
    applicationName: basics.name,
    authors: [{ name: basics.name, url: siteUrl.href }],
    creator: basics.name,
    keywords: [basics.label, basics.location.city, ...keywords],
    alternates: {
      canonical: "/",
      types: { "text/plain": "/llms.txt", "application/json": "/resume.json" },
    },
    openGraph: {
      type: "profile",
      url: "/",
      siteName: basics.name,
      title: siteTitle,
      description: basics.headline,
      firstName: basics.givenName,
      lastName: basics.familyName,
      locale: "en_US",
    },
    twitter: { card: "summary_large_image", title: siteTitle, description: basics.headline },
    robots: {
      index: true,
      follow: true,
      googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    },
    category: "technology",
  };
}

export const siteViewport: Viewport = {
  themeColor: "#fdfbf7",
  colorScheme: "light",
  width: "device-width",
  initialScale: 1,
};
