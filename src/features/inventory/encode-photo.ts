import sharp from "sharp";
import { optimizedByteLimit } from "./model.ts";

export async function encodePhoto(input: Uint8Array) {
  if (!input.byteLength || input.byteLength > optimizedByteLimit) throw new Error("Некорректный размер фотографии.");
  const pipeline = sharp(input, { limitInputPixels: 4_000_000, failOn: "warning" });
  const metadata = await pipeline.metadata();
  if (metadata.format !== "webp" || (metadata.pages ?? 1) !== 1) throw new Error("Ожидается одна фотография WebP.");
  return pipeline.rotate().resize({width:1600,height:1600,fit:"inside",withoutEnlargement:true})
    .webp({quality:85}).toBuffer();
}
