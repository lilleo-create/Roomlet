import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { localDemoEnabled } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";
const files = new Set(["atelier.webp", "reading.webp", "ceramics.webp", "greenhouse.webp"]);

export async function GET(_: Request, {params}: {params: Promise<{file: string}>}) {
  const { file } = await params;
  if (!localDemoEnabled() || !files.has(file)) return new Response(null, {status: 404});
  const bytes = await readFile(join(process.cwd(), "assets", "demo", "objects", file));
  return new Response(new Uint8Array(bytes), {headers: {
    "Content-Type": "image/webp", "Cache-Control": "private, no-store",
  }});
}
