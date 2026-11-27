import type { ReactNode } from "react";
import { StoreProvider } from "@/features/store/StoreProvider";
import { AppHeader, BottomNav, StoreFooter } from "@/features/store/Navigation";
import "@/styles/store.css";

export default function StoreLayout({ children }: { children: ReactNode }) {
  return <StoreProvider><div className="roomlet-store">
    <AppHeader /><main id="store-content" className="store-main">{children}</main><StoreFooter /><BottomNav />
  </div></StoreProvider>;
}
