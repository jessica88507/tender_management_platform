import type { Metadata } from "next";
import Script from "next/script";
import { Noto_Serif_TC, Noto_Sans_TC, IBM_Plex_Mono } from "next/font/google";
import { AuthSessionProvider } from "@/components/AuthSessionProvider";
import "./globals.css";

const notoSerifTC = Noto_Serif_TC({
  variable: "--font-serif",
  weight: ["600", "700", "900"],
  subsets: ["latin"],
});

const notoSansTC = Noto_Sans_TC({
  variable: "--font-sans",
  weight: ["400", "500", "700"],
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-mono",
  weight: ["500", "600"],
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "備標控台 — 備標時程規劃工具",
  description: "自動依公司備標作業流程產生投標待辦清單與時程表",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="zh-Hant"
      className={`${notoSerifTC.variable} ${notoSansTC.variable} ${ibmPlexMono.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full bg-background font-sans text-ink antialiased">
        {/* Runs before hydration/paint so the correct theme is already applied — avoids a
            flash of the wrong theme on load. Reads the manual preference if one was saved,
            otherwise falls back to the OS preference. `beforeInteractive` is Next.js's own
            mechanism for this. The script sets data-theme on <html> before React hydrates,
            which the server obviously couldn't have rendered — suppressHydrationWarning above
            is the standard, deliberate opt-out for exactly this one attribute (not a blanket
            suppression of real mismatches, since it only affects the <html> element itself). */}
        <Script id="theme-init" strategy="beforeInteractive">
          {"(function(){try{var s=localStorage.getItem('bid-scheduler-theme');var t=s||(window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',t);}catch(e){}})();"}
        </Script>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
