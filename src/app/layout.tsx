import type { Metadata } from "next";
import Link from "next/link";

import "./globals.css";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: {
    default: "AutoHuolto AI",
    template: "%s | AutoHuolto AI",
  },
  description:
    "Yksityisyyttä painottava ja tilaton ajoneuvon huoltohistorian analysointipalvelu.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fi" data-scroll-behavior="smooth">
      <body>
        <a className="skipLink" href="#sisalto">
          Siirry sisältöön
        </a>
        <header className="siteHeader">
          <div className="headerInner">
            <Link className="brand" href="/" aria-label="AutoHuolto AI – etusivu">
              <span className="brandMark" aria-hidden="true">
                A
              </span>
              <span>AutoHuolto AI</span>
            </Link>
            <nav aria-label="Päänavigaatio">
              <Link href="/tietosuoja">Tietosuoja</Link>
            </nav>
          </div>
        </header>
        {children}
        <footer className="siteFooter">
          <div>
            <strong>AutoHuolto AI</strong>
            <p>Istuntoa ei tallenneta sovelluksen tietokantaan.</p>
          </div>
          <Link href="/tietosuoja">Lue tietosuojaperiaatteet</Link>
        </footer>
      </body>
    </html>
  );
}
