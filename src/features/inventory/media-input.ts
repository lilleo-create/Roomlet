import { imageLimit, isOwnMediaPath, optimizedByteLimit } from "./model.ts";

export type IncomingMedia = { existing: string; alt: string } | { file: File; alt: string };

export function mediaInput(form: FormData, productId: string, existing: string[]): IncomingMedia[] {
  const encoded = form.get("media");
  if (typeof encoded !== "string" || encoded.length > 14000) throw new Error("Некорректный список фотографий.");
  let rows: unknown;
  try { rows = JSON.parse(encoded); } catch { throw new Error("Не удалось прочитать список фотографий."); }
  if (!Array.isArray(rows) || rows.length > imageLimit) throw new Error("Можно добавить до 12 фотографий.");
  const seen = new Set<string>();
  return rows.map(row => {
    if (!row || typeof row !== "object" || typeof row.key !== "string" || seen.has(row.key) ||
      typeof row.alt !== "string" || row.alt.length > 300) throw new Error("Проверьте фотографии и подписи.");
    seen.add(row.key);
    if (row.kind === "stored" && isOwnMediaPath(productId, row.key) && existing.includes(row.key)) {
      return { existing: row.key, alt: row.alt.trim() };
    }
    const file = form.get("upload-" + row.key);
    if (row.kind !== "upload" || !(file instanceof File) || file.type !== "image/webp" || file.size > optimizedByteLimit || file.size === 0) {
      throw new Error("Проверьте формат и размер фотографии.");
    }
    return { file, alt: row.alt.trim() };
  });
}

export async function limitedForm(request: Request): Promise<FormData> {
  const max = 4_000_000;
  if (!request.body || Number(request.headers.get("content-length")) > max) throw new Error("Слишком большой запрос.");
  const reader = request.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) { await reader.cancel(); throw new Error("Слишком большой запрос."); }
      parts.push(new Uint8Array(value));
    }
  } finally { reader.releaseLock(); }
  try { return await new Response(new Blob(parts), { headers: { "content-type": request.headers.get("content-type") || "" } }).formData(); }
  catch { throw new Error("Не удалось прочитать форму."); }
}
