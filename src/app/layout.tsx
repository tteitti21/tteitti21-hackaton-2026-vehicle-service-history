import type { Metadata } from "next";
import Link from "next/link";

import { AnalysisSessionProvider } from "@/components/session/analysis-session-provider";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "AutoHuolto AI",
    template: "%s | AutoHuolto AI",
  },
  description:
    "A privacy-first, stateless vehicle service-history analysis service.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <AnalysisSessionProvider>
          <a className="skipLink" href="#sisalto">
            Skip to content
          </a>
          <header className="siteHeader">
            <div className="headerInner">
              <Link
                className="brand"
                href="/"
                aria-label="AutoHuolto AI – home"
              >
                <span className="brandMark" aria-hidden="true">
                  A
                </span>
                <span>AutoHuolto AI</span>
              </Link>
              <nav aria-label="Main navigation">
                <Link href="/#demo">Demo</Link>
                <Link href="/tietosuoja">Privacy</Link>
              </nav>
            </div>
          </header>
          {children}
          <footer className="siteFooter">
            <div>
              <strong>AutoHuolto AI</strong>
              <p>The session is not stored in the application database.</p>
            </div>
            <Link href="/tietosuoja">Read the privacy principles</Link>
          </footer>
        </AnalysisSessionProvider>
      </body>
    </html>
  );
}
