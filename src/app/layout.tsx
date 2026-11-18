import { Inter, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { createSiteMetadata, siteViewport } from "@/lib/seo/siteMetadata";
import "./globals.css";

/** Display (ultralight) and body: one variable file covers 200–500. */
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});
/** HUD labels, readouts and the loader counter. */
const mono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  display: "swap",
});

export const metadata = createSiteMetadata();
export const viewport = siteViewport;

/**
 * Before first paint: a refresh always opens at the top (the build starts from zero), and
 * motion-capable browsers are flagged so entrance states can be hidden until animated.
 * No-JS and reduced-motion visitors never get the flag and see everything at once.
 */
const HEAD_SCRIPT = `history.scrollRestoration='manual';if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('has-motion')`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: HEAD_SCRIPT }} />
      </head>
      <body>
        {children}
        {/* real-visitor Core Web Vitals, reported to the Vercel dashboard */}
        <SpeedInsights />
      </body>
    </html>
  );
}
