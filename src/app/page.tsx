import { Suspense } from "react";
import { resume } from "@/content/resume";
import { JsonLdBuilder } from "@/lib/seo/JsonLdBuilder";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { SceneBackdropLoader } from "@/components/three/SceneBackdropLoader";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { Hero } from "@/components/sections/Hero";
import { About } from "@/components/sections/About";
import { Skills } from "@/components/sections/Skills";
import { Experience } from "@/components/sections/Experience";
import { Projects } from "@/components/sections/Projects";
import { Contact } from "@/components/sections/Contact";

/**
 * Fully static, server-rendered page. All résumé text is in the initial HTML;
 * client islands (motion, WebGL) only enhance it after hydration.
 */
export default function HomePage() {
  const jsonLd = new JsonLdBuilder(resume).withWebSite().withProfilePage().withPerson().withProjects();

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd.toScriptString() }} />
      <SceneBackdropLoader />
      <SiteHeader />
      <main id="main">
        <Hero />
        {/*
          Each below-the-fold section is its own Suspense boundary. Nothing here suspends
          (it is all static), but React hydrates boundaries as separate units and can yield
          between them — one long hydration task becomes several short ones.
        */}
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
      <SiteFooter />
    </>
  );
}
