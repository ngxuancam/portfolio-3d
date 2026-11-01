import type { MetadataRoute } from "next";
import { resume } from "@/content/resume";
import { siteUrl } from "@/lib/seo/siteMetadata";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = resume.updatedAt;
  return [
    { url: siteUrl.href, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: new URL("/resume.json", siteUrl).href, lastModified, changeFrequency: "monthly", priority: 0.6 },
    { url: new URL("/llms.txt", siteUrl).href, lastModified, changeFrequency: "monthly", priority: 0.6 },
  ];
}
