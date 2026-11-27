"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Grid2X2, Heart, House, ShoppingBag, UserRound } from "lucide-react";
import { useStore } from "./StoreProvider";

const sections = [
  { href: "/", title: "Главная", icon: House },
  { href: "/catalog", title: "Каталог", icon: Grid2X2 },
  { href: "/favorites", title: "Избранное", icon: Heart },
  { href: "/profile", title: "Профиль", icon: UserRound },
];
function currentPage(path: string, href: string) {
  if (path === href) return "page";
  if (path.startsWith(href + "/") && href !== "/") return "location";
}
export function AppHeader({showcase=false}:{showcase?:boolean} = {}) {
  const path = usePathname();
  const { cart, demo } = useStore();
  return <header className="store-header">
    <div className="store-header-in">
      <Link href="/" className="store-logo" aria-label="Roomlet — главная">roomlet<span aria-hidden="true">.</span></Link>
      <nav className="store-desktop-nav" aria-label="Навигация магазина">
        {sections.map(item => <Link key={item.href} href={item.href} aria-current={currentPage(path, item.href)}>{item.title}</Link>)}
      </nav>
      {demo && <div className="store-header-tools">{showcase ? <Link href="/studio" className="store-demo-label" aria-label="Демонстрационная мастерская">Демо</Link> : <span className="store-demo-label">Демо</span>}
        <Link href="/cart" className="store-bag" aria-label={`Корзина, позиций: ${cart.length}`} aria-current={path === "/cart" ? "page" : undefined}>
          <ShoppingBag size={21} />{cart.length > 0 && <span>{cart.length}</span>}
        </Link>
      </div>}
    </div>
  </header>;
}
export function BottomNav({ inline = false }: { inline?: boolean }) {
  const path = usePathname();
  return <nav className={`store-bottom-nav${inline ? " is-inline" : ""}`} aria-label="Разделы магазина">
    {sections.map(({ href, title, icon: Icon }) => <Link key={href} href={href} aria-current={currentPage(path, href)}>
      <Icon size={20} strokeWidth={1.7} /><span>{title}</span></Link>)}
  </nav>;
}
export function StoreFooter() {
  const {demo} = useStore();
  return <footer className="store-footer"><div>
    <Link className="store-logo" href="/">roomlet<span>.</span></Link>
    <span>{demo ? "Демонстрационная коллекция" : "Коллекционные миниатюры"}</span>
  </div></footer>;
}
