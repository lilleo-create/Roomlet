"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { authDestination, authHref } from "./auth-paths";

export function ProfileBack() {
  const pathname = usePathname();
  const router = useRouter();
  const search = useSearchParams();
  useEffect(() => {
    if (pathname === "/profile") return;
    const next = authDestination(search.get("next"));
    const back = pathname === "/profile/recover" ? authHref("forgot", next)
      : ["/profile/register", "/profile/forgot", "/profile/confirm"].includes(pathname) ? authHref("login", next) : "/profile";
    function onKey(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || event.isComposing || event.repeat ||
        event.ctrlKey || event.altKey || event.metaKey || event.shiftKey || !window.matchMedia("(min-width: 761px)").matches) return;
      if (document.querySelector("dialog[open], [aria-modal='true']") ||
        event.target instanceof Element && event.target.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) return;
      event.preventDefault();
      router.push(back);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [pathname, router, search]);
  return null;
}
