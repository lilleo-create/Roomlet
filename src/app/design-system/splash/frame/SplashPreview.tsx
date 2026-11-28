"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { SplashScreen, type SplashVariant } from "@/features/launch/SplashScreen";

export function SplashPreview({ children, variant, delay, reducedMotion, still }: {
  children: ReactNode; variant: SplashVariant; delay: number; reducedMotion: boolean; still?: number;
}) {
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(true);
  const content = useRef<HTMLDivElement>(null);
  const complete = useCallback(() => setActive(false), []);
  useEffect(() => {
    if (still !== undefined) return;
    const timer = window.setTimeout(() => setReady(true), delay);
    return () => window.clearTimeout(timer);
  }, [delay, still]);
  useEffect(() => {
    if (!content.current) return;
    content.current.inert = active;
    document.body.style.overflow = active ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [active]);
  return <div className="splash-frame" data-still={still !== undefined} style={{"--preview-time": `${still ?? 0}ms`} as CSSProperties}>
    <div ref={content}>{children}</div>
    {active && <SplashScreen ready={ready} variant={variant} reducedMotion={reducedMotion} onComplete={complete} />}
  </div>;
}
