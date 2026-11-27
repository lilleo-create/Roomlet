"use client";

import Image from "next/image";
import { ImageOff } from "lucide-react";
import { useState } from "react";

export function Photo({ photo, sizes, priority = false, zoom = false, onUnavailable }: {
  photo?: {src: string; alt: string}; sizes: string; priority?: boolean; zoom?: boolean; onUnavailable?: () => void;
}) {
  const [failed, setFailed] = useState<string>();
  if (!photo || failed === photo.src) return <span className="ui-photo-placeholder"><ImageOff size={24} strokeWidth={1.5} aria-hidden />Фото недоступно</span>;
  const dimensions = zoom ? {width: 1600, height: 1100} : {fill: true as const};
  return <Image {...dimensions} src={photo.src} alt={photo.alt} sizes={sizes} priority={priority}
    unoptimized onError={() => { setFailed(photo.src); onUnavailable?.(); }} />;
}
