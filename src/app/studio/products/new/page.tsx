import { requireStaff } from "@/features/studio/session";
import { StudioShell } from "@/features/studio/Shell";
import { formContext, newInventoryItem } from "@/features/inventory/repository";
import { ProductEditor } from "@/features/inventory/ProductEditor";

export default async function NewProductPage() {
  const {supabase} = await requireStaff();
  const context = await formContext(supabase);
  return <StudioShell active="products"><ProductEditor item={newInventoryItem(context.currency)} categories={context.categories}/></StudioShell>;
}
