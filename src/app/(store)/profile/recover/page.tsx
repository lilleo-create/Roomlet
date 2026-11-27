import type { Metadata } from "next";
import { EmailScreen } from "@/features/profile/EmailScreen";
import type { AuthQuery } from "@/features/profile/auth-paths";

export const metadata: Metadata = { title: "Новый пароль", referrer: "strict-origin" };

export default async function Page({ searchParams }: { searchParams: Promise<AuthQuery> }) {
  return <EmailScreen mode="recover" query={await searchParams} />;
}
