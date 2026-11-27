import type { Metadata } from "next";
import { DesignSystem } from "./DesignSystem";
import "./samples.css";

export const metadata: Metadata = { title: "Дизайн-система" };
export default function DesignSystemPage() {
  return <DesignSystem />;
}
