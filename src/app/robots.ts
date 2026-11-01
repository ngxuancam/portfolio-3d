import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo/siteMetadata";

/** AI/answer-engine crawlers are welcomed explicitly — a portfolio wants to be cited. */
const AI_AGENTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "PerplexityBot",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/" },
      { userAgent: AI_AGENTS, allow: ["/", "/llms.txt", "/resume.json"] },
    ],
    sitemap: new URL("/sitemap.xml", siteUrl).href,
    host: siteUrl.origin,
  };
}
