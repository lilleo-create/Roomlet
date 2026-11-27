import { requireStaff } from "@/features/studio/session";
import { isCatalogPhotoPath } from "@/features/store/catalog-record";
import { localDemoEnabled } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

// Supabase Lite's signed-URL response differs from hosted Storage. Preview the private
// object through the same verified maker session and Storage policies as the editor.
export async function GET(_: Request, { params }: { params: Promise<{ productId: string; file: string }> }) {
  if (!localDemoEnabled()) return new Response(null, { status: 404 });
  const { productId, file } = await params;
  const path = productId + "/" + file;
  if (!isCatalogPhotoPath(path)) return new Response(null, { status: 404 });
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.storage.from("product-media").download(path);
  if (error || !data) return new Response(null, { status: 404 });
  return new Response(data, { headers: { "Content-Type": "image/webp", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
