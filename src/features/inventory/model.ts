export type ProductStatus = "draft" | "published" | "archived";
export type Category = { id: string; name: string };
export type MediaItem = { storage_path: string; alt_text: string; url: string };
export type InventoryItem = {
  id: string; slug: string; title: string; description: string; category_id: string | null;
  dimensions: string; materials: string; status: ProductStatus; updated_at: string | null;
  currency: string; price_minor: number; cost_minor: number; planned_minutes: number;
  ready_quantity: number; made_to_order: boolean; requires_sketch: boolean; media: MediaItem[];
};
export const statusLabels: Record<ProductStatus, string> = {
  draft: "Черновик", published: "Опубликовано", archived: "В архиве",
};
export const imageBucket = "product-media";
export const imageLimit = 12;
export const optimizedByteLimit = 300 * 1024;
export const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const currencyCodes = new Set(Intl.supportedValuesOf("currency"));

export function currencyDigits(code: string): number {
  if (!currencyCodes.has(code)) throw new Error("Укажите действующий трёхбуквенный код валюты.");
  return new Intl.NumberFormat("ru", { style: "currency", currency: code }).resolvedOptions().maximumFractionDigits ?? 2;
}

export function minorUnits(input: string, currency: string) {
  const digits = currencyDigits(currency);
  const [whole, fraction = ""] = input.trim().replace(",", ".").split(".");
  if (!/^\d+(?:[.,]\d+)?$/.test(input.trim()) || fraction.length > digits || whole.length > 14) {
    throw new Error("Проверьте сумму и количество десятичных знаков для выбранной валюты.");
  }
  const amount = BigInt(whole + fraction.padEnd(digits, "0"));
  if (amount > 9_000_000_000_000n) throw new Error("Сумма слишком велика.");
  return Number(amount);
}

export function formatMinor(amount: number, code: string) {
  // Imported rows can contain a legacy three-letter code. Keep the input editable so a maker can correct it.
  const digits = currencyCodes.has(code) ? currencyDigits(code) : 2;
  const number = String(amount).padStart(digits + 1, "0");
  return digits ? number.slice(0, -digits) + "." + number.slice(-digits) : number;
}

function field(form: FormData, key: string, max: number, required = false) {
  const raw = form.get(key);
  const value = typeof raw === "string" ? raw.trim() : "";
  if (value.length > max || (required && !value)) throw new Error("Проверьте обязательные поля и длину текста.");
  return value;
}

function integer(form: FormData, key: string, maximum: number) {
  const raw = field(form, key, 9, true);
  const number = Number(raw);
  if (!/^\d+$/.test(raw) || number > maximum) throw new Error("Проверьте количество экземпляров и трудозатраты.");
  return number;
}

export function productFields(form: FormData) {
  const currency = field(form, "currency", 3, true).toUpperCase();
  const category = field(form, "category_id", 36);
  if (category && !uuidPattern.test(category)) throw new Error("Выберите категорию из списка.");
  const status = field(form, "status", 10, true) as ProductStatus;
  if (!Object.hasOwn(statusLabels, status)) throw new Error("Выберите статус изделия.");
  const expected = field(form, "expected_updated_at", 50);
  if (expected && !Number.isFinite(Date.parse(expected))) throw new Error("Обновите карточку и повторите сохранение.");
  return {
    title: field(form, "title", 200, true), description: field(form, "description", 10000),
    materials: field(form, "materials", 1000), dimensions: field(form, "dimensions", 1000),
    category_id: category || null, status, currency, expected_updated_at: expected || null,
    price_minor: minorUnits(field(form, "price", 32, true), currency),
    cost_minor: minorUnits(field(form, "cost", 32, true), currency),
    planned_minutes: integer(form, "planned_minutes", 525600), ready_quantity: integer(form, "ready_quantity", 1000),
    made_to_order: form.get("made_to_order") === "on", requires_sketch: form.get("requires_sketch") === "on",
  };
}

export function publicationError(product: ReturnType<typeof productFields>, photoCount: number) {
  if (product.status !== "published") return null;
  if (!product.category_id || product.price_minor === 0 || photoCount < 1) return "Для публикации нужны категория, фотография и цена больше нуля.";
  if (!product.ready_quantity && !product.made_to_order) return "Добавьте готовый экземпляр или разрешите изготовление под заказ.";
  return null;
}

export function isOwnMediaPath(id: string, path: string) {
  const parts = path.split("/");
  return parts.length === 2 && parts[0] === id && parts[1].endsWith(".webp")
    && uuidPattern.test(parts[1].slice(0, -5));
}
