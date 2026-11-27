import { StoreHome } from "@/features/store/StoreHome";
import { ViewEvent } from "@/features/store/ViewEvent";

export default function HomePage() {
  return <><ViewEvent name="home_view" /><StoreHome /></>;
}
