import Link from "next/link";
import { ArrowRight, ArrowUpRight, Layers3 } from "lucide-react";
import { enterStudio } from "../actions";

export default async function Login({searchParams}: {searchParams: Promise<{next?: string}>}) {
  const {next} = await searchParams;
  return <main className="rs-login">
    <header className="rs-login-header"><Link href="/" className="rs-logotype">roomlet<span>.</span></Link><Link href="/">В магазин <ArrowUpRight size={16}/></Link></header>
    <div className="rs-login-body">
      <div className="rs-login-poster" aria-hidden="true"><Layers3 strokeWidth={0.85}/><span>Studio</span></div>
      <section><p className="rs-cap">Roomlet Studio</p><h1>Мастерская</h1><p>Рабочий календарь, изделия и заказы в одном месте. Демо открывает мастерскую с учебным расписанием.</p>
        <form action={enterStudio}><input type="hidden" name="next" value={next ?? "today"}/><button className="rs-primary">Открыть демо <ArrowRight size={20}/></button></form>
      </section>
    </div>
  </main>;
}
