"use client";
import { useRef, useState } from "react";
import { Scan } from "lucide-react";
import { Dialog } from "@/components/ui";
import { track } from "@/lib/analytics";
import { Photo } from "@/components/Photo";
import { type Product } from "./products";

export function ImageZoom({ title, photo, open, onClose }: { title: string; photo: Product["media"][number]; open: boolean; onClose: () => void }) {
  return <Dialog title={title} open={open} onClose={onClose}>
    <div className="store-zoom" tabIndex={0} aria-label="Увеличенная фотография, доступна прокрутка"><Photo photo={photo} zoom sizes="1200px" /></div>
    <p className="store-small">Прокручивайте фотографию, чтобы рассмотреть детали.</p>
  </Dialog>;
}
export function ImageGallery({ product }: { product: Product }) {
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const start = useRef<number | null>(null);
  const count = product.media.length;
  const currentIndex = index < count ? index : 0;
  const photo = product.media[currentIndex];
  function change(value: number) {
    if (value !== currentIndex) {
      setIndex(value); track("gallery_swipe", { product: product.slug, index: value });
    }
  }
  if (!photo) return <div className="store-gallery-main"><Photo sizes="100vw" /></div>;
  return <div className="store-gallery">
    {failed.includes(photo.src) ? <div className="store-gallery-main"><Photo sizes="100vw" /></div> :
    <button type="button" className="store-gallery-main" aria-label="Увеличить фотографию"
      onTouchStart={e => { start.current = e.changedTouches[0].clientX; }}
      onTouchEnd={e => {
        const delta = start.current === null ? 0 : e.changedTouches[0].clientX - start.current;
        if (count > 1 && Math.abs(delta) > 40) { e.preventDefault(); change((currentIndex + (delta < 0 ? 1 : count - 1)) % count); }
        start.current = null;
      }}
      onClick={() => { setZoom(true); track("image_zoom", {product: product.slug}); }}>
      <Photo photo={photo} sizes="(max-width: 760px) 100vw, 55vw" priority onUnavailable={() => setFailed(previous => [...previous, photo.src])}/><span className="store-zoom-icon"><Scan size={18}/></span>
    </button>}
    {count > 1 && <div className="store-gallery-thumbs" aria-label="Виды объекта">
      {product.media.map((item, i) => <button type="button" key={item.src} aria-pressed={currentIndex === i} onClick={() => change(i)}>Фото {i + 1}</button>)}
    </div>}
    <ImageZoom title={product.title} photo={photo} open={zoom} onClose={() => setZoom(false)}/>
  </div>;
}
