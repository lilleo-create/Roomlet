import { PageHeading, EmptyState } from "@/components/ui";
import {StudioShell} from "@/features/studio/Shell";
import {requireStaff} from "@/features/studio/session";
export default async function OrdersPage() {
  await requireStaff();
  return <StudioShell active="orders"><PageHeading title="Заказы" /><EmptyState variant="orders" title="Приём заказов пока закрыт" /></StudioShell>;
}
