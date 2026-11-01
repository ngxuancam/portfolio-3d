import { Cormorant_Garamond, Inter, Pinyon_Script } from "next/font/google";
import { createSiteMetadata, siteViewport } from "@/lib/seo/siteMetadata";
import { SmoothScroll } from "@/components/motion/SmoothScroll";
import { GlassLensManager } from "@/components/ui/GlassLensManager";
import { PaperGrain } from "@/components/ui/PaperGrain";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { PointerExtras } from "@/components/motion/PointerExtras";
import { LOUPE_HEAD_SCRIPT } from "@/lib/animation/loupePreference";
import { ScrollToTop } from "@/components/motion/ScrollToTop";
import "./globals.css";

/** Body: clean, legible sans at light/regular weights (the serif carries the personality). */
const inter = Inter({
  variable: "--font-inter",
  // the content is ASCII; one latin file keeps the critical font payload small
  subsets: ["latin"],
  display: "swap",
});
/** Editorial flourish — tiny metadata, dates and taglines only. */
const pinyon = Pinyon_Script({
  variable: "--font-pinyon",
  weight: "400",
  subsets: ["latin"],
  display: "swap",
  // decorative tiny metadata only — never worth delaying first render for
  preload: false,
});
const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  // one weight, roman + italic: three preloaded font files in total across the page
  weight: "500",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

export const metadata = createSiteMetadata();
export const viewport = siteViewport;

/**
 * Runs before first paint:
 *  - disables scroll restoration, so a refresh always opens on the hero (the 3D bust)
 *    instead of mid-page with the flower already burst;
 *  - flags Chromium (the only engine that renders SVG filters inside backdrop-filter,
 *    used for the liquid-glass refraction);
 *  - flags motion-capable browsers so above-the-fold
 * elements can be hidden until GSAP animates them in (no flash of final state).
 * Browsers without JS or with reduced motion never get the flag, so they see
 * the content immediately.
 */
const MOTION_FLAG_SCRIPT = `history.scrollRestoration='manual';var b=navigator.userAgentData&&navigator.userAgentData.brands;if(b&&b.some(function(x){return /Chromium/.test(x.brand)}))document.documentElement.classList.add('is-chromium');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('has-motion')`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cormorant.variable} ${pinyon.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION_FLAG_SCRIPT }} />
        {/* loupe on/off preference, applied before first paint */}
        <script dangerouslySetInnerHTML={{ __html: LOUPE_HEAD_SCRIPT }} />
      </head>
      <body>
        <SmoothScroll />
        {children}
        <ScrollToTop />
        <PointerExtras />
        <GlassLensManager />
        <PaperGrain />
        {/* real-visitor Core Web Vitals, reported to the Vercel dashboard */}
        <SpeedInsights />
      </body>
    </html>
  );
}
