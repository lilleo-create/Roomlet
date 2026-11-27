import { createCatalogClient } from "@/lib/supabase/public";
import { isCatalogPhotoPath } from "@/features/store/catalog-record";

export const dynamic = "force-dynamic";

export async function GET(_: Request, { params }: { params: Promise<{ productId: string; file: string }> }) {
  const { productId, file } = await params;
  const path = productId + "/" + file;
  if (!isCatalogPhotoPath(path)) return new Response(null, { status: 404 });
  const supabase = await createCatalogClient();
  // Always read with the anonymous key. Storage checks publication on each request.
  const { data, error } = await supabase.storage.from("product-media").download(path);
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
  if (error || !data) return new Response(null, { status: 404, headers });
  return new Response(data, { headers: { ...headers, "Content-Type": "image/webp" } });
}
