"use client";

import { useEffect, useState, type CSSProperties } from "react";
import "./splash.css";

export type SplashVariant = "calm" | "expressive";

/** Assemble once; a brief sheen every five seconds only while waiting. */
export function SplashScreen({ ready, variant = "calm", onComplete, reducedMotion = false }: {
  ready: boolean; variant?: SplashVariant; onComplete: () => void; reducedMotion?: boolean;
}) {
  const [leaving, setLeaving] = useState(false);
  const [slow, setSlow] = useState(false);
  const [reduce, setReduce] = useState(reducedMotion);

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduce(reducedMotion || preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => preference.removeEventListener("change", update);
  }, [reducedMotion]);

  useEffect(() => {
    const timeout = window.setTimeout(() => setSlow(true), 6000);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!ready) return;
    // Use a frame rather than setting state synchronously in the effect.
    const frame = requestAnimationFrame(() => setLeaving(true));
    return () => cancelAnimationFrame(frame);
  }, [ready]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(onComplete, reduce ? 80 : 220);
    return () => window.clearTimeout(timer);
  }, [leaving, onComplete, reduce]);

  return <div className="roomlet-splash" data-variant={variant} data-leaving={leaving} data-reduced={reduce}>
    <div className="roomlet-splash-center" role="status" aria-label="Открываем Roomlet">
      <div className="roomlet-splash-word" aria-hidden="true">
        {Array.from("roomlet.").map((letter, index) => <span key={index}
          className={letter === "." ? "roomlet-splash-letter roomlet-splash-dot" : "roomlet-splash-letter"}
          style={{ "--part": index, "--direction": index % 2 === 0 ? 1 : -1 } as CSSProperties}>{letter}</span>)}
        <span className="roomlet-splash-sheen">roomlet.</span>
      </div>
    </div>
    {slow && !leaving && <div className="roomlet-splash-slow">
      <p>Загрузка занимает чуть больше времени</p>
      <button type="button" onClick={onComplete}>Продолжить без заставки</button>
    </div>}
  </div>;
}
