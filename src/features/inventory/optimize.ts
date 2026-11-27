import { optimizedByteLimit } from "./model";

// Phone images are prepared one at a time. A 12-photo request stays under 4 MB.
export async function preparePhoto(file: File): Promise<Blob> {
  if (file.size > 24 * 1024 * 1024) throw new Error("Одна фотография должна занимать не больше 24 МБ.");
  const url = URL.createObjectURL(file);
  try {
    const source = new Image();
    source.src = url;
    try { await source.decode(); }
    catch { throw new Error("Не удалось прочитать фотографию. Выберите JPEG, PNG или WebP."); }
    let scale = Math.min(1, 1600 / Math.max(source.naturalWidth, source.naturalHeight));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Браузер не поддерживает подготовку фотографий.");
    for (let pass = 0; pass < 7; pass++) {
      canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, "image/webp", 0.84));
      if (!blob || blob.type !== "image/webp") throw new Error("Обновите браузер для загрузки фотографий в формате WebP.");
      if (blob.size <= optimizedByteLimit) return blob;
      scale *= 0.8;
    }
    throw new Error("Фотография слишком велика после сжатия.");
  } finally { URL.revokeObjectURL(url); }
}
