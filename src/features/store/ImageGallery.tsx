"use client";
import { useRef, useState } from "react";
import { Scan } from "lucide-react";
import { Dialog } from "@/components/ui";
import { track } from "@/lib/analytics";
import { Photo } from "./Photo";
import { type Product } from "./products";
import { useStore } from "./StoreProvider";

export function ImageZoom({ title, photo, open, onClose }: { title: string; photo: Product["media"][number]; open: boolean; onClose: () => void }) {
  return <Dialog title={title} open={open} onClose={onClose}>
    <div className="store-zoom" tabIndex={0} aria-label="Увеличенная фотография, доступна прокрутка"><Photo photo={photo} zoom sizes="1200px" /></div>
    <p className="store-small">Прокручивайте фотографию, чтобы рассмотреть детали.</p>
  </Dialog>;
}
export function ImageGallery({ product }: { product: Product }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const {demo} = useStore();
  const start = useRef<number | null>(null);
  const sampleDetail = demo && product.media.length === 1;
  const count = sampleDetail ? 2 : product.media.length;
  const photo = product.media[sampleDetail ? 0 : index];
  function change(value: number) {
    if (value !== index) {
      setIndex(value); track("gallery_swipe", { product: product.slug, index: value });
    }
  }
  if (!photo) return <div className="store-gallery-main"><p>Фотографий пока нет</p></div>;
  return <div className="store-gallery">
    <button type="button" className={`store-gallery-main${sampleDetail && index ? " detail" : ""}`} aria-label="Увеличить фотографию"
      onTouchStart={e => { start.current = e.changedTouches[0].clientX; }}
      onTouchEnd={e => {
        const delta = start.current === null ? 0 : e.changedTouches[0].clientX - start.current;
        if (count > 1 && Math.abs(delta) > 40) { e.preventDefault(); change((index + (delta < 0 ? 1 : count - 1)) % count); }
        start.current = null;
      }}
      onClick={() => { setZoom(true); track("image_zoom", {product: product.slug}); }}>
      <Photo photo={photo} sizes="(max-width: 760px) 100vw, 55vw" priority/><span><Scan size={18}/></span>
    </button>
    {count > 1 && <div className="store-gallery-thumbs" aria-label="Виды объекта">
      {Array.from({length: count}, (_, i) => <button type="button" key={i} aria-pressed={index === i} onClick={() => change(i)}>
        {sampleDetail ? ["Общий вид", "Фрагмент"][i] : `Фото ${i + 1}`}</button>)}
    </div>}
    <ImageZoom title={product.title} photo={photo} open={zoom} onClose={() => setZoom(false)}/>
  </div>;
}
