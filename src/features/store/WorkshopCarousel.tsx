"use client";

import Link from "next/link";
import { useLayoutEffect, useRef } from "react";
import KeenSlider from "keen-slider";
import type { KeenSliderInstance } from "keen-slider";
import "keen-slider/keen-slider.min.css";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ProductCard } from "./ProductCard";
import type { Product } from "./products";

const positionKey = "roomlet.workshop.position";
const identity = (product: Product) => product.id ?? product.slug;

export function WorkshopCarousel({products}: {products: readonly Product[]}) {
  const viewport = useRef<HTMLDivElement>(null);
  const instance = useRef<KeenSliderInstance | null>(null);
  useLayoutEffect(() => {
    if (!viewport.current || products.length < 2) return;
    let remembered: string | null = null;
    try { remembered = sessionStorage.getItem(positionKey); } catch { /* Optional browser storage. */ }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    const initial = Math.max(0, products.findIndex(p => identity(p) === remembered));
    const spacing = 14;
    function save(slider: KeenSliderInstance) {
      const p = products[slider.track.details.rel];
      if (p) try { sessionStorage.setItem(positionKey, identity(p)); } catch { /* Private browsing. */ }
    }
    const slider = new KeenSlider(viewport.current, {
      initial, loop:true, mode:"snap", rubberband:false,
      slides:{perView:1.28,spacing},
      breakpoints: {
        "(min-width: 761px)": {slides:{perView:Math.min(products.length - 0.72, 2.55),spacing:20}},
        "(min-width: 1100px)": {slides:{perView:Math.min(products.length - 0.72, 3.15),spacing:24}},
      },
      defaultAnimation:{duration:360},
      slideChanged:save,
      detailsChanged(s) {
        s.track.details?.slides.forEach((slide,i) => { s.slides[i].inert = slide.portion < 0.06; });
      },
      animationStarted(s) {
        if (reduced.matches && s.animator.targetIdx !== null) {
          const target = s.animator.targetIdx;
          s.animator.stop();
          s.track.add(s.track.idxToDist(target, true));
        }
      },
    });
    instance.current = slider;
    return () => { slider.destroy(); instance.current = null; };
  }, [products]);
  return <section className="home-workshop" aria-labelledby="workshop-title" aria-roledescription={products.length > 1 ? "карусель" : undefined}>
    <div className="home-workshop-head"><h2 id="workshop-title">Из мастерской</h2>
      <Link className="home-all-works" href="/catalog">Все работы</Link>
      {products.length > 1 && <div className="home-workshop-controls">
        <button aria-label="Предыдущая работа" onClick={() => instance.current?.prev()}><ChevronLeft /></button>
        <button aria-label="Следующая работа" onClick={() => instance.current?.next()}><ChevronRight /></button>
      </div>}
    </div>
    {products.length > 0 && <div className="keen-slider workshop-track" ref={viewport} tabIndex={products.length > 1 ? 0 : undefined}
      aria-label="Работы мастерской" role="group"
      onKeyDown={event => {
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        viewport.current?.focus({preventScroll:true});
        if (event.key === "ArrowLeft") instance.current?.prev(); else instance.current?.next();
      }}>
      {products.map((p, index) => <div key={identity(p)} className="keen-slider__slide" data-work={identity(p)}
        onClickCapture={event => {
          if ((event.target as Element).closest("a")) try { sessionStorage.setItem(positionKey,identity(p)); } catch { /* Optional storage. */ }
        }}><ProductCard product={p} photo={index === 0 ? p.media[1] : undefined} /></div>)}
    </div>}
  </section>;
}
