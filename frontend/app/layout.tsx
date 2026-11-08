import type { Metadata } from "next";
import { Instrument_Sans, Instrument_Serif } from "next/font/google";
import "./globals.css";

import { AppShell } from "./components/app-shell";
import { EnvBanner } from "./components/env-banner";
import { envLabel } from "./lib/env";

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
});

const instrumentSerif = Instrument_Serif({
  variable: "--font-instrument-serif",
  weight: "400",
  subsets: ["latin"],
});

// Read at request time so the same image serves dev (labelled) and prod (FR-020).
export function generateMetadata(): Metadata {
  const label = envLabel();
  return {
    title: label.visible ? `MisiOps · ${label.name}` : "MisiOps",
    description: "Registra tus ingresos y gastos, y mira a dónde se va tu plata.",
  };
}

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="es"
      className={`${instrumentSans.variable} ${instrumentSerif.variable} h-full antialiased`}
    >
      <body className="min-h-full">
        <EnvBanner />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
