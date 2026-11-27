"use client";

import Image from "next/image";
import { useRef, useState } from "react";
import { Scan } from "lucide-react";
import { Dialog } from "@/components/ui";
import { track } from "@/lib/analytics";
import { type Product } from "./products";

export function ImageZoom({ product, open, onClose }: { product: Product; open: boolean; onClose: () => void }) {
  return <Dialog title={product.title} open={open} onClose={onClose}>
    <div className="store-zoom" tabIndex={0} aria-label="Увеличенная фотография, доступна прокрутка">
      <Image src={product.image} alt={product.alt} width={1600} height={1100} sizes="1200px" />
    </div>
    <p className="store-small">Прокручивайте фотографию, чтобы рассмотреть детали.</p>
  </Dialog>;
}
export function ImageGallery({ product }: { product: Product }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const start = useRef<number | null>(null);
  const change = (value: number) => {
    if (value === index) return;
    setIndex(value);
    track("gallery_swipe", { product: product.slug, index: value });
  };
  return <div className="store-gallery">
    <button type="button" className={`store-gallery-main${index ? " detail" : ""}`} aria-label="Увеличить фотографию"
      onTouchStart={e => { start.current = e.changedTouches[0].clientX; }}
      onTouchEnd={e => {
        if (start.current !== null && Math.abs(e.changedTouches[0].clientX - start.current) > 40) { e.preventDefault(); change(1 - index); }
        start.current = null;
      }}
      onClick={() => { setZoom(true); track("image_zoom", { product: product.slug }); }}>
      <Image src={product.image} alt={product.alt} fill sizes="(max-width: 760px) 100vw, 55vw" priority />
      <span><Scan size={18} /></span>
    </button>
    <div className="store-gallery-thumbs" aria-label="Виды объекта">
      {["Общий вид", "Фрагмент"].map((label, n) => <button type="button" aria-pressed={index === n} key={label} onClick={() => change(n)}>{label}</button>)}
    </div>
    <ImageZoom product={product} open={zoom} onClose={() => setZoom(false)} />
  </div>;
}
