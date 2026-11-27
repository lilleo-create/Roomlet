"use server";
import { requireStaff } from "@/features/studio/session";
import type { Category } from "@/features/inventory/model";

export async function createCategory(name: string): Promise<{ item?: Category; error?: string }> {
  const { supabase } = await requireStaff();
  const title = typeof name === "string" ? name.trim() : "";
  if (!title || title.length > 100) return { error: "Введите название категории до 100 символов." };
  const { data, error } = await supabase.from("categories").insert({ name: title, slug: "category-" + crypto.randomUUID() })
    .select("id,name").single();
  if (!error && data) return { item: data };
  if (error?.code === "23505") {
    const existing = await supabase.from("categories").select("id,name").eq("name", title).maybeSingle();
    if (existing.data) return { item: existing.data };
    return { error: "Категория с похожим названием уже существует." };
  }
  return { error: "Не удалось сохранить категорию. Повторите попытку." };
}
