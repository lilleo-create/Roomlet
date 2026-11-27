import type { Metadata } from "next";
import { requireAccountStaff } from "@/features/studio/session";
import { enterShowcase } from "./actions";
import "@/styles/studio.css";

export const metadata: Metadata = {title:"Демонстрационная коллекция", robots:{index:false,follow:false}};
export default async function DemoEntry({searchParams}: {searchParams:Promise<{error?:string}>}) {
  await requireAccountStaff("demo-login");
  const {error} = await searchParams;
  return <main className="rs-studio rs-login"><div className="rs-login-body">
    <section><p className="rs-cap">Roomlet Studio</p><h1>Демонстрационная коллекция</h1>
      <p>Четыре миниатюры для знакомства с магазином и мастерской. Изменения сохраняются в демоверсии до перезапуска приложения.</p>
      {error === "unavailable" && <p role="alert">Не удалось открыть демомагазин. Попробуйте ещё раз чуть позже.</p>}
      <form action={enterShowcase}><button className="rs-primary">Открыть демомагазин</button></form>
    </section></div></main>;
}
