import type { Metadata, Viewport } from "next";
import { GAME_CONFIG } from "./game-config";
import "./globals.css";

export const metadata: Metadata = {
  title: GAME_CONFIG.localized.en.title,
  description: GAME_CONFIG.localized.en.summary,
  openGraph: {
    title: GAME_CONFIG.localized.en.title,
    description: GAME_CONFIG.localized.en.summary,
    images: [{
      url: GAME_CONFIG.heroImageUrl,
      width: 1672,
      height: 941,
      alt: GAME_CONFIG.localized.en.heroAlt,
    }],
  },
};

export const viewport: Viewport = {
  themeColor: "#081226",
  colorScheme: "dark",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang={GAME_CONFIG.defaultLocale}>
      <body>{children}</body>
    </html>
  );
}
