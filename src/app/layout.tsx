import type { Metadata, Viewport } from "next";
import "@fontsource-variable/manrope";
import "@fontsource-variable/golos-text";
import "./globals.css";
import "@/styles/tokens.css";
import "@/styles/ui.css";

export const metadata: Metadata = {
  title: { default: "Roomlet — коллекционные миниатюры", template: "%s · Roomlet" },
  description: "Цифровая галерея коллекционных интерьерных миниатюр Roomlet.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#F6F2EA" };

export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
  return <html lang="ru"><body>{children}</body></html>;
}
