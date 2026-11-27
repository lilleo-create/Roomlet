import { notFound } from "next/navigation";
import { requireStaff } from "@/features/studio/session";
import { StudioShell } from "@/features/studio/Shell";
import { uuidPattern } from "@/features/inventory/model";
import { formContext, loadInventoryItem } from "@/features/inventory/repository";
import { ProductEditor } from "@/features/inventory/ProductEditor";

export default async function EditProductPage({params,searchParams}: {params:Promise<{id:string}>;searchParams:Promise<{notice?:string}>}) {
  const {supabase} = await requireStaff();
  const {id} = await params;
  if (!uuidPattern.test(id)) notFound();
  const [item,context,{notice}] = await Promise.all([loadInventoryItem(supabase,id),formContext(supabase),searchParams]);
  if (!item) notFound();
  const message = notice === "saved" ? "Изменения сохранены." : notice === "cleanup" ? "Изменения сохранены. Снятые фотографии требуют очистки хранилища." : undefined;
  return <StudioShell active="products"><ProductEditor key={item.updated_at} item={item} categories={context.categories} notice={message}/></StudioShell>;
}
