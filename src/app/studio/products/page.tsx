import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { EmptyState, ErrorState, PageHeading, RetryPageButton, StatusTag } from "@/components/ui";
import { requireStaff } from "@/features/studio/session";
import { StudioShell } from "@/features/studio/Shell";
import { statusLabels, type ProductStatus } from "@/features/inventory/model";

const pageSize = 30;
export default async function StudioProductsPage({searchParams}: {searchParams:Promise<{p?:string;notice?:string}>}) {
  const {supabase} = await requireStaff();
  const {p,notice} = await searchParams;
  const page = p && /^\d{1,6}$/.test(p) ? Math.max(1,Number(p)) : 1;
  const offset = (page-1)*pageSize;
  const {data,error} = await supabase.from("products").select("id,title,status")
    .order("updated_at",{ascending:false}).order("id").range(offset,offset+pageSize);
  const rows=data?.slice(0,pageSize) || [];
  return <StudioShell active="products"><div className="inventory">
    <PageHeading title="Изделия" action={<Link className="rs-primary" href="/studio/products/new">Создать изделие</Link>} />
    {notice==="deleted" && <p className="inventory-note" role="status">Изделие удалено.</p>}
    {notice==="cleanup" && <p className="inventory-note" role="status">Изделие удалено. Часть снятых фотографий требует очистки хранилища.</p>}
    {error ? <ErrorState title="Не удалось загрузить изделия" description="Проверьте соединение и права доступа." action={<RetryPageButton />}/> :
      rows.length ? <div className="inventory-list">{rows.map(row=><Link key={row.id} href={"/studio/products/"+row.id}>
        <strong>{row.title}</strong><StatusTag tone={row.status==="published"?"success":"neutral"}>{statusLabels[row.status as ProductStatus]}</StatusTag><ArrowRight size={18}/>
      </Link>)}</div> : <EmptyState title={page===1?"Изделий пока нет":"На этой странице изделий нет"} description={page===1?"Создайте карточку и сохраните её как черновик.":undefined}/>}
    <nav className="inventory-pages" aria-label="Страницы изделий">
      {page>1 && <Link href={"/studio/products?p="+(page-1)}>← Предыдущая</Link>}
      {data && data.length>pageSize && <Link href={"/studio/products?p="+(page+1)}>Следующая →</Link>}
    </nav>
  </div></StudioShell>;
}
