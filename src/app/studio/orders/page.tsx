import {StudioShell} from "@/features/studio/Shell";
import {requireStaff} from "@/features/studio/session";
export default async function OrdersPage() {
  await requireStaff();
  return <StudioShell active="orders"><div className="rs-page-title"><h1>Заказы</h1></div><p>Приём заказов появится на следующем этапе.</p></StudioShell>;
}
