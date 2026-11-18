import { Suspense } from "react";
import { resume } from "@/content/resume";
import { JsonLdBuilder } from "@/lib/seo/JsonLdBuilder";
import { SignalsDriver } from "@/components/core/SignalsDriver";
import { Loader } from "@/components/loader/Loader";
import { StageHost } from "@/components/stage/StageHost";
import { Header } from "@/components/chrome/Header";
import { Footer } from "@/components/chrome/Footer";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Skills } from "@/components/sections/Skills";
import { Experience } from "@/components/sections/Experience";
import { Projects } from "@/components/sections/Projects";
import { Contact } from "@/components/sections/Contact";

/**
 * Static, server-rendered page: all résumé text is in the initial HTML; the loader, the 3D
 * stage and the HUD are client islands layered on top. Chapters below the fold are separate
 * Suspense boundaries so hydration yields between them.
 */
export default function HomePage() {
  const jsonLd = new JsonLdBuilder(resume).withWebSite().withProfilePage().withPerson().withProjects();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd.toScriptString() }} />
      <Loader />
      <StageHost />
      <SignalsDriver />
      <Header />
      <main id="main">
        <Hero />
        <Suspense>
          <About />
        </Suspense>
        <Suspense>
          <Skills />
        </Suspense>
        <Suspense>
          <Experience />
        </Suspense>
        <Suspense>
          <Projects />
        </Suspense>
        <Suspense>
          <Contact />
        </Suspense>
      </main>
      <Footer />
    </>
  );
}
