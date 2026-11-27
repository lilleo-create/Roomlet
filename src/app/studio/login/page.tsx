import Link from "next/link";
import { ArrowRight, ArrowUpRight, Layers3 } from "lucide-react";
import { enterStudio } from "../actions";
export default async function Login({searchParams}: {searchParams: Promise<{error?: string}>}) {
  const {error} = await searchParams;
  const message = error === "access" ? "Этому аккаунту нужен доступ мастера или владельца." :
    error === "connection" ? "Не удалось связаться с Supabase. Попробуйте ещё раз." :
    error === "credentials" ? "Проверьте адрес почты и пароль." : "";
  return <main className="rs-login"><header className="rs-login-header"><Link href="/" className="rs-logotype">roomlet<span>.</span></Link><Link href="/">В магазин <ArrowUpRight size={16}/></Link></header>
    <div className="rs-login-body"><div className="rs-login-poster" aria-hidden="true"><Layers3 strokeWidth={0.85}/><span>Studio</span></div>
      <section><p className="rs-cap">Roomlet Studio</p><h1>Мастерская</h1>
        <form action={enterStudio} className="rs-settings-form"><label>Электронная почта<input required type="email" name="email" autoComplete="username" /></label>
        <label>Пароль<input required type="password" name="password" autoComplete="current-password" /></label>
        {message && <p role="alert">{message}</p>}<button className="rs-primary">Войти <ArrowRight size={20}/></button></form></section></div></main>;
}
