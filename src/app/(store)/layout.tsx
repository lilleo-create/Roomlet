import { wantsShowcase } from "@/features/studio/session";
import { isDemoCatalog } from "@/features/store/catalog-data";

import type { ReactNode } from "react";
import { StoreProvider } from "@/features/store/StoreProvider";
import { LaunchProvider } from "@/features/launch/LaunchProvider";
import { TelegramSession } from "@/features/profile/TelegramSession";
import { AppHeader, BottomNav, StoreFooter } from "@/features/store/Navigation";
import "@/styles/store.css";
import {createRoomletClient} from '@/lib/supabase/server';

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: ReactNode }) {
  const {data:{user},error}=await (await createRoomletClient()).auth.getUser();
  return <LaunchProvider><TelegramSession><StoreProvider accountId={!error?user?.id??null:null} demo={(await isDemoCatalog())}><div className="roomlet-store">
    <AppHeader showcase={await wantsShowcase()} /><main id="store-content" className="store-main">{children}</main><StoreFooter /><BottomNav />
  </div></StoreProvider></TelegramSession></LaunchProvider>;
}
