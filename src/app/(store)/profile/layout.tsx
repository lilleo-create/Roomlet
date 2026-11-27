import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@/features/profile/profile.css";
import { ProfileBack } from "@/features/profile/ProfileBack";

export const metadata: Metadata = { robots: { index: false, follow: false } };

export default function ProfileLayout({ children }: { children: ReactNode }) {
  return <><ProfileBack />{children}</>;
}
