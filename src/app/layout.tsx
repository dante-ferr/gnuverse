import type { Metadata } from "next";
import "./globals.css";
import { SiteHeader } from '@/components/site-header';
import { GameSessionProvider } from '@/components/game/hooks/use-game-session';

export const metadata: Metadata = {
  title: "GNUverse — Tecnologia para mais gente",
  description: "Software livre como forma de democratizar o acesso à tecnologia.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>
        <GameSessionProvider>
          <SiteHeader />
          {children}
        </GameSessionProvider>
      </body>
    </html>
  );
}
