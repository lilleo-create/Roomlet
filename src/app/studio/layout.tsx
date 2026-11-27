import type { Metadata } from "next";
import "@/styles/studio.css";

export const metadata: Metadata = {title: "Мастерская · Roomlet Studio", robots: {index:false, follow:false}};
export default function StudioLayout({children}: {children: React.ReactNode}) {
  return <div className="rs-studio">{children}</div>;
}
import "@/styles/workshop.css";
