"use client";

import Image from "next/image";
import { useState } from "react";
import type { Product } from "./products";

export function Photo({ photo, sizes, priority = false, zoom = false }: {
  photo?: Product["media"][number]; sizes: string; priority?: boolean; zoom?: boolean;
}) {
  const [failed, setFailed] = useState<string>();
  if (!photo || failed === photo.src) return <span className="store-no-photo">Фото недоступно</span>;
  const dimensions = zoom ? {width: 1600, height: 1100} : {fill: true as const};
  return <Image {...dimensions} src={photo.src} alt={photo.alt} sizes={sizes} priority={priority}
    unoptimized onError={() => setFailed(photo.src)} />;
}
