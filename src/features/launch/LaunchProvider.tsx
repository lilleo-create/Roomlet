"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { SplashScreen } from "./SplashScreen";

const LaunchContext = createContext<(() => void) | null>(null);

/** Survives the Mini App → Store transition. Ordinary web visits never get a splash. */
export function LaunchProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(pathname === "/mini");
  const [ready, setReady] = useState(false);
  const content = useRef<HTMLDivElement>(null);
  const complete = useCallback(() => setActive(false), []);
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!active || !content.current) return;
    const element = content.current;
    const previousOverflow = document.body.style.overflow;
    element.inert = true;
    element.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "hidden";
    return () => {
      element.inert = false;
      element.removeAttribute("aria-hidden");
      document.body.style.overflow = previousOverflow;
    };
  }, [active]);

  return <LaunchContext.Provider value={active ? markReady : null}>
    <div ref={content}>{children}</div>
    {active && <SplashScreen ready={ready || (pathname !== "/mini" && pathname !== "/")} onComplete={complete} />}
    <noscript><style>{".roomlet-splash{display:none!important}"}</style></noscript>
  </LaunchContext.Provider>;
}

export function useLaunchReady() { return useContext(LaunchContext); }

/** Mounted only after the server has resolved the route's data (or its error UI). */
export function LaunchReady({ waitForHero = false }: { waitForHero?: boolean }) {
  const markReady = useLaunchReady();
  useEffect(() => {
    if (!markReady) return;
    let cancelled = false;
    const image = waitForHero ? document.querySelector<HTMLImageElement>(".store-hero-photo img") : null;
    const finish = () => { if (!cancelled) markReady(); };
    const afterImage = () => { void document.fonts.ready.then(finish, finish); };
    if (!image || image.complete) afterImage();
    else { image.addEventListener("load", afterImage, {once:true}); image.addEventListener("error", afterImage, {once:true}); }
    // A failed CDN or font must not trap the user behind the wordmark.
    const timeout = window.setTimeout(finish, 4000);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      image?.removeEventListener("load", afterImage);
      image?.removeEventListener("error", afterImage);
    };
  }, [markReady, waitForHero]);
  return null;
}
