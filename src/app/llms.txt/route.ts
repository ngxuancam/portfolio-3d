import { resume } from "@/content/resume";
import { toLlmsTxt } from "@/lib/seo/resumeSerializers";

/** Rendered once at build time: the site ships as static files. */
export const dynamic = "force-static";

/** https://llmstxt.org — a markdown digest agents can read without parsing HTML. */
export function GET() {
  return new Response(toLlmsTxt(resume), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
