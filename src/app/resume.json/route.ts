import { resume } from "@/content/resume";
import { toJsonResume } from "@/lib/seo/resumeSerializers";

export function GET() {
  return Response.json(toJsonResume(resume));
}
