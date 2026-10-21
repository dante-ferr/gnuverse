import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from '@/components/site-header';

export const metadata: Metadata = {
  title: "GNUverse — Tecnologia para mais gente",
  description: "Software livre como forma de democratizar o acesso à tecnologia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
