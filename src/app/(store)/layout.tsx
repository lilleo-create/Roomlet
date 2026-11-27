import { isDemoCatalog } from "@/features/store/catalog-data";

import type { ReactNode } from "react";
import { StoreProvider } from "@/features/store/StoreProvider";
import { AppHeader, BottomNav, StoreFooter } from "@/features/store/Navigation";
import "@/styles/store.css";

export const dynamic = "force-dynamic";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreProvider demo={isDemoCatalog()}><div className="roomlet-store">
    <AppHeader /><main id="store-content" className="store-main">{children}</main><StoreFooter /><BottomNav />
  </div></StoreProvider>;
}
