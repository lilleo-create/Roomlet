import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { encodePhoto } from "@/features/inventory/encode-photo";
import { requireStaff } from "@/features/studio/session";
import { imageBucket, productFields, publicationError, uuidPattern } from "@/features/inventory/model";
import { limitedForm, mediaInput } from "@/features/inventory/media-input";

type Context = { params: Promise<{id:string}> };
type StaffDb = Awaited<ReturnType<typeof requireStaff>>["supabase"];
const fail = (message: string, status: number) => NextResponse.json({error:message}, {status});
function sameOrigin(request: Request) {
  const origin = request.headers.get("origin");
  if (!origin || request.headers.get("sec-fetch-site") === "cross-site") return false;
  try {
    const browser = new URL(origin);
    return browser.origin === new URL(request.url).origin ||
      (["https:", "http:"].includes(browser.protocol) && browser.host === request.headers.get("host"));
  } catch { return false; }
}
async function cleanup(db: StaffDb, paths: string[]) {
  if (!paths.length) return true;
  try { return !(await db.storage.from(imageBucket).remove(paths)).error; }
  catch { return false; }
}
function refresh(id: string, slug: string) {
  for (const path of ["/", "/catalog", "/product/" + slug, "/studio", "/studio/products", "/studio/products/" + id]) revalidatePath(path);
}

export async function POST(request: Request, context: Context) {
  const {supabase,showcase} = await requireStaff();
  if ((request.headers.get("x-roomlet-environment") ?? "live") !== (showcase ? "demo" : "live")) return fail("Режим мастерской изменился. Откройте карточку заново.",409);
  if (!sameOrigin(request)) return fail("Запрос должен быть отправлен со страницы мастерской.", 403);
  const {id} = await context.params;
  if (!uuidPattern.test(id)) return fail("Некорректный идентификатор.", 400);
  const [product, media] = await Promise.all([
    supabase.from("products").select("slug,updated_at").eq("id", id).maybeSingle(),
    supabase.from("product_media").select("storage_path").eq("product_id",id),
  ]);
  if (product.error || media.error) return fail("Не удалось получить данные изделия.", 503);
  const existing = (media.data ?? []).map(row => row.storage_path as string);
  let fields, incoming;
  try {
    const form = await limitedForm(request);
    fields = productFields(form);
    incoming = mediaInput(form, id, existing);
    const invalid = publicationError(fields, incoming.length);
    if (invalid) return fail(invalid, 422);
  } catch (error) { return fail(error instanceof Error ? error.message : "Проверьте поля формы.", 422); }
  if ((product.data?.updated_at ?? null) !== fields.expected_updated_at) return fail("Карточка изменилась. Откройте её заново перед сохранением.", 409);

  const uploaded: string[] = [];
  const photos: {storage_path: string; sort_order: number; alt_text: string}[] = [];
  // Decode, strip metadata and re-encode every file, even if a client skipped its optimizer.
  for (const row of incoming) {
    let path: string;
    if ("existing" in row) path = row.existing;
    else {
      path = id + "/" + crypto.randomUUID() + ".webp";
      let bytes;
      try {
        bytes = await encodePhoto(new Uint8Array(await row.file.arrayBuffer()));
      } catch { await cleanup(supabase, uploaded); return fail("Файл не удалось обработать. Выберите другую фотографию.", 422); }
      const { error } = await supabase.storage.from(imageBucket).upload(path, bytes, {contentType:"image/webp", upsert:false, cacheControl:"60"});
      if (error) { await cleanup(supabase, uploaded); return fail("Загрузка прервалась. Повторите сохранение.", 503); }
      uploaded.push(path);
    }
    photos.push({storage_path:path, sort_order:photos.length, alt_text:row.alt});
  }
  const slug = product.data?.slug ?? "object-" + id;
  const {error} = await supabase.rpc("save_product", {p_id:id,p_data:{...fields, slug, media:photos}});
  if (error) {
    // A transport failure may have occurred after COMMIT. Remove staged objects only on a definite database rejection.
    if (/^[0-9A-Z]{5}$/.test(error.code)) await cleanup(supabase, uploaded);
    if (error.code === "40001") return fail("Карточка изменилась. Обновите данные.", 409);
    if (error.code === "42501") return fail("У аккаунта больше нет прав на изменение изделий.", 403);
    if (error.code === "23503") return fail("Связанная запись изменилась. Проверьте категорию и остатки перед сохранением.", 409);
    if (error.code === "23514" || error.code === "22023") return fail("Проверьте свойства изделия и прикреплённые фотографии.", 422);
    return fail("Не удалось подтвердить сохранение. Проверьте карточку перед повторной попыткой.", 503);
  }
  const kept = new Set(photos.map(row => row.storage_path));
  const cleaned = await cleanup(supabase, existing.filter(path => !kept.has(path)));
  refresh(id, slug);
  return NextResponse.json({id,warning: cleaned ? undefined : "Изделие сохранено. Некоторые снятые фотографии требуют очистки хранилища."});
}

export async function DELETE(request: Request, context: Context) {
  const {supabase,showcase} = await requireStaff();
  if ((request.headers.get("x-roomlet-environment") ?? "live") !== (showcase ? "demo" : "live")) return fail("Режим мастерской изменился. Откройте карточку заново.",409);
  if (!sameOrigin(request)) return fail("Недоступный источник запроса.", 403);
  const {id} = await context.params;
  const expected = request.headers.get("x-product-version");
  if (!uuidPattern.test(id) || !expected || !Number.isFinite(Date.parse(expected))) return fail("Обновите карточку изделия.", 400);
  const [product,media] = await Promise.all([
    supabase.from("products").select("slug").eq("id",id).maybeSingle(),
    supabase.from("product_media").select("storage_path").eq("product_id",id),
  ]);
  if (product.error || media.error) return fail("Не удалось проверить изделие.", 503);
  if (!product.data) return fail("Изделие уже удалено.", 404);
  const {error} = await supabase.rpc("delete_product", {p_id:id,p_expected_updated_at:expected});
  if (error) {
    if (error.code === "40001") return fail("Карточка изменилась или уже удалена. Откройте список изделий заново.", 409);
    if (error.code === "42501") return fail("У аккаунта больше нет прав на удаление изделий.", 403);
    if (error.code === "23503") return fail("Изделие используется в заказе, производстве или черновике публикации. Перенесите его в архив.", 409);
    return fail("Не удалось подтвердить удаление. Проверьте список изделий перед повторной попыткой.", 503);
  }
  const cleaned = await cleanup(supabase,(media.data || []).map(row=>row.storage_path));
  refresh(id, product.data.slug);
  return NextResponse.json({id,warning:cleaned ? undefined : "Изделие удалено. Часть файлов требует очистки хранилища."});
}
