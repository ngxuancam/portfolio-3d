import { resume } from "@/content/resume";
import { toJsonResume } from "@/lib/seo/resumeSerializers";

/** Rendered once at build time: the site ships as static files. */
export const dynamic = "force-static";

export function GET() {
  return Response.json(toJsonResume(resume));
}
