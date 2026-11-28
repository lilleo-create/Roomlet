"use client";

import { useState } from "react";
import Link from "next/link";

export function SplashComparison() {
  const [run, setRun] = useState(0);
  const [delay, setDelay] = useState("0");
  const [motion, setMotion] = useState(false);
  const [still, setStill] = useState("");
  return <main className="splash-comparison">
    <header><Link className="splash-preview-brand" href="/">roomlet<span>.</span></Link>
      <h1>Старт приложения</h1><p>Два варианта · визуальный просмотр без авторизации Telegram</p></header>
    <div className="splash-preview-controls">
      <label>Готовность экрана<select value={delay} onChange={e => setDelay(e.target.value)}>
        <option value="0">Сразу</option><option value="3500">Через 3,5 секунды</option><option value="10000">Долгая загрузка · 10 секунд</option>
      </select></label>
      <label>Просмотр<select value={still} onChange={e => setStill(e.target.value)}>
        <option value="">Анимация</option><option value="300">Кадр · сборка, 300 мс</option><option value="880">Кадр · блик, 880 мс</option><option value="1180">Кадр · логотип собран</option>
      </select></label>
      <label className="splash-preview-check"><input type="checkbox" checked={motion} onChange={e => setMotion(e.target.checked)} />Уменьшенное движение</label>
      <button type="button" onClick={() => setRun(value => value + 1)}>Повторить оба</button>
    </div>
    <div className="splash-preview-grid">{(["calm", "expressive"] as const).map((variant, index) => <section key={variant}>
      <div className="splash-preview-heading"><span>0{index + 1}</span><h2>{variant === "calm" ? "Спокойный" : "Выразительный"}</h2>
        <small>{variant === "calm" ? "Утверждён" : "Альтернатива"}</small></div>
      <p>{variant === "calm" ? "Мягкая сборка букв и один лёгкий блик." : "Встречное движение букв и акцент на точке."}</p>
      <iframe key={`${run}-${delay}-${motion}-${still}`} title={`Splash: ${variant}`} width="390" height="760"
        src={`/design-system/splash/frame?variant=${variant}&delay=${delay}&reduced=${motion}&still=${still}`} />
    </section>)}</div>
  </main>;
}
