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
  title: "業務投標管理平台 Bigmaster",
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
        {/* Runs before hydration/paint so the login screen always starts light — deliberately
            ignores both the OS preference and any previously-saved dark preference at this
            stage, since whether anyone is signed in (and whose preference would even apply)
            isn't known until the session check resolves. ClientApp.tsx re-applies the signed-in
            user's own saved preference in an effect once that session is confirmed; on sign-out
            it flips back to light for whoever's turn is next on this device. `beforeInteractive`
            is Next.js's own mechanism for running this before hydration. The script sets
            data-theme on <html> before React hydrates, which the server obviously couldn't have
            rendered — suppressHydrationWarning above is the standard, deliberate opt-out for
            exactly this one attribute (not a blanket suppression of real mismatches, since it
            only affects the <html> element itself). */}
        <Script id="theme-init" strategy="beforeInteractive">
          {"document.documentElement.setAttribute('data-theme','light');"}
        </Script>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </body>
    </html>
  );
}
