import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { SiteHeader } from '@/components/site-header';
import { GameSessionProvider } from '@/components/game/hooks/use-game-session';

const plexSans = IBM_Plex_Sans({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-sans",
});

const plexMono = IBM_Plex_Mono({
  weight: ["400", "500"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-plex-mono",
});

export const metadata: Metadata = {
  title: "GNUverse — Tecnologia para mais gente",
  description: "Software livre como forma de democratizar o acesso à tecnologia.",
  icons: {
    icon: [{ url: "/gnuverse-logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/gnuverse-logo.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" className={`${plexSans.variable} ${plexMono.variable}`}>
      <body>
        <GameSessionProvider>
          <SiteHeader />
          {children}
        </GameSessionProvider>
      </body>
    </html>
  );
}
