import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { encodePhoto } from "../src/features/inventory/encode-photo.ts";

test("сервер выдаёт статический WebP до 1600 px без EXIF",async()=>{
  const large = await sharp({create:{width:3200,height:1000,channels:3,background:"#315cff"}})
    .withMetadata({orientation:1}).webp().toBuffer();
  assert.ok((await sharp(large).metadata()).exif);
  const result=await sharp(await encodePhoto(large)).metadata();
  assert.equal(result.format,"webp");
  assert.deepEqual([result.width,result.height],[1600,500]);
  assert.equal(result.exif,undefined);
});
test("сервер проверяет содержимое загруженной фотографии",async()=>{
  const png=await sharp({create:{width:10,height:10,channels:3,background:"white"}}).png().toBuffer();
  await assert.rejects(encodePhoto(png));
  await assert.rejects(encodePhoto(Buffer.from("not an image")));
});
