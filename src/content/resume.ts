import type { Resume } from "@/types/resume";

/**
 * ✏️  EDIT ME — this is the only file you need to change.
 * Everything below is placeholder content written to show the layout off.
 * Replace names, dates, companies, links and numbers with your real history.
 */
export const resume: Resume = {
  basics: {
    name: "Nguyen Xuan Cam",
    givenName: "Cam",
    familyName: "Nguyen",
    label: "Senior Frontend Engineer",
    headline: "I build fast, accessible interfaces that feel alive.",
    summary:
      "Frontend engineer focused on performance-critical React and Next.js products, real-time 3D on the web with Three.js, and motion systems built on GSAP. I care about Core Web Vitals, clean architecture and interfaces people enjoy using.",
    email: "nguyenxuancamit@gmail.com",
    location: { city: "Da Nang", region: "Da Nang", countryCode: "VN" },
    siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com",
    availability: "Open to senior frontend & creative-dev roles",
    profiles: [
      { network: "GitHub", username: "ngxuancam", url: "https://github.com/ngxuancam" },
      { network: "LinkedIn", username: "socdev", url: "https://www.linkedin.com/in/socdev/" },
      { network: "Email", username: "nguyenxuancamit@gmail.com", url: "mailto:nguyenxuancamit@gmail.com" },
    ],
  },
  metrics: [
    { value: 6, suffix: "+", label: "Years shipping production UI" },
    { value: 40, suffix: "+", label: "Releases to millions of users" },
    { value: 98, suffix: "", label: "Lighthouse performance, median" },
    { value: 60, suffix: "fps", label: "Target for every interaction" },
  ],
  skillGroups: [
    {
      id: "frontend",
      title: "Frontend Architecture",
      description: "Server-first React, typed end to end, designed for change.",
      skills: [
        { name: "TypeScript", level: "expert" },
        { name: "React 19", level: "expert" },
        { name: "Next.js App Router", level: "expert" },
        { name: "State machines", level: "advanced" },
        { name: "Design systems", level: "advanced" },
        { name: "Micro-frontends", level: "proficient" },
      ],
    },
    {
      id: "creative",
      title: "Creative Development",
      description: "3D and motion that serve the story, not the frame budget.",
      skills: [
        { name: "Three.js", level: "advanced" },
        { name: "React Three Fiber", level: "advanced" },
        { name: "GLSL shaders", level: "advanced" },
        { name: "GSAP + ScrollTrigger", level: "expert" },
        { name: "WebGL performance", level: "advanced" },
        { name: "SVG animation", level: "proficient" },
      ],
    },
    {
      id: "performance",
      title: "Performance & SEO",
      description: "Measured, budgeted and regression-tested in CI.",
      skills: [
        { name: "Core Web Vitals", level: "expert" },
        { name: "Rendering strategies (SSG/ISR/PPR)", level: "expert" },
        { name: "Structured data / JSON-LD", level: "advanced" },
        { name: "Bundle analysis", level: "advanced" },
        { name: "Accessibility (WCAG 2.2)", level: "advanced" },
        { name: "Edge caching", level: "proficient" },
      ],
    },
    {
      id: "platform",
      title: "Platform & Tooling",
      description: "The boring parts that keep teams fast.",
      skills: [
        { name: "Node.js", level: "advanced" },
        { name: "Testing (Vitest, Playwright)", level: "advanced" },
        { name: "CI/CD", level: "advanced" },
        { name: "Monorepos (Turborepo)", level: "proficient" },
        { name: "Docker", level: "proficient" },
        { name: "Observability", level: "proficient" },
      ],
    },
  ],
  experience: [
    {
      id: "exp-1",
      company: "Company One",
      role: "Senior Frontend Engineer",
      startDate: "2023-03",
      location: "Da Nang · Hybrid",
      summary: "Lead engineer for the customer-facing web platform.",
      highlights: [
        "Migrated a 300-route SPA to the Next.js App Router; LCP dropped from 3.8s to 1.4s.",
        "Designed the component library and token pipeline used by 5 product teams.",
        "Introduced performance budgets in CI that block regressions before merge.",
      ],
      stack: ["Next.js", "TypeScript", "GSAP", "Playwright"],
    },
    {
      id: "exp-2",
      company: "Company Two",
      role: "Frontend Engineer · Creative Dev",
      startDate: "2020-06",
      endDate: "2023-02",
      location: "Remote",
      summary: "Built interactive campaign sites and 3D product configurators.",
      highlights: [
        "Shipped a WebGL product configurator holding 60fps on mid-range phones.",
        "Created a reusable scroll-storytelling toolkit on GSAP ScrollTrigger.",
        "Cut texture memory 70% with KTX2 compression and instanced geometry.",
      ],
      stack: ["React", "Three.js", "R3F", "GLSL"],
    },
    {
      id: "exp-3",
      company: "Company Three",
      role: "Web Developer",
      startDate: "2018-08",
      endDate: "2020-05",
      location: "Da Nang",
      summary: "Agency work across e-commerce and marketing sites.",
      highlights: [
        "Delivered 20+ responsive sites with accessibility audits built into QA.",
        "Automated image pipelines, saving ~1.2 MB on average per page.",
      ],
      stack: ["JavaScript", "SCSS", "Node.js"],
    },
  ],
  projects: [
    {
      id: "orbit",
      name: "Orbit Configurator",
      tagline: "Real-time 3D product builder",
      description:
        "A browser-based configurator with PBR materials, instanced parts and on-demand rendering so idle tabs cost zero GPU.",
      year: 2025,
      stack: ["React Three Fiber", "drei", "KTX2", "Zustand"],
      outcome: "+32% add-to-cart vs. static images",
      accent: "#4a0e17",
    },
    {
      id: "pulse",
      name: "Pulse Dashboard",
      tagline: "Streaming analytics UI",
      description:
        "Server components for the shell, client islands for live charts, and virtualized tables that render 100k rows without jank.",
      year: 2024,
      stack: ["Next.js", "TypeScript", "WebSockets", "Canvas"],
      outcome: "INP held under 120ms at p75",
      accent: "#1b2430",
    },
    {
      id: "tides",
      name: "Tides Story",
      tagline: "Scroll-driven editorial",
      description:
        "A long-form narrative built on ScrollTrigger timelines and a GLSL ocean that reacts to scroll velocity.",
      year: 2023,
      stack: ["GSAP", "ScrollTrigger", "Three.js", "GLSL"],
      outcome: "Awwwards Honorable Mention (placeholder)",
      accent: "#9c8256",
    },
    {
      id: "kit",
      name: "Atlas UI Kit",
      tagline: "Design system & tokens",
      description:
        "Headless, accessible primitives plus a token build that outputs CSS variables, TS types and Figma styles from one source.",
      year: 2022,
      stack: ["TypeScript", "Style Dictionary", "Storybook", "a11y"],
      outcome: "Adopted by 5 teams, 140+ components",
      accent: "#6a1a26",
    },
  ],
  education: [
    {
      institution: "University of Science and Technology – The University of Da Nang",
      area: "Information Technology",
      studyType: "Bachelor",
      startDate: "2014-09",
      endDate: "2018-06",
    },
  ],
  languages: [
    { language: "Vietnamese", fluency: "Native" },
    { language: "English", fluency: "Professional working" },
  ],
  updatedAt: "2026-10-31",
};
