import Link from "next/link";
import { ArrowUpRight, Bell, CalendarDays, ChevronRight, Heart, LayoutGrid, LogOut, Mail, Package, Settings, UserRound, UsersRound, type LucideIcon } from "lucide-react";
import { PageHeading } from "@/components/ui";
import { readAccount, roleLabels } from "@/features/profile/session";
import { leaveProfile } from "./actions";

type MenuItem = { label: string; icon: LucideIcon; href?: string };

function ProfileMenuRow({ label, icon: Icon, href }: MenuItem) {
  const contents = <>
    <Icon size={19} strokeWidth={1.65} aria-hidden />
    <span className="profile-menu-label">{label}</span>
    {href ? <ChevronRight className="profile-chevron" size={18} aria-hidden />
      : <span className="profile-unavailable">Недоступно</span>}
  </>;
  return <li>{href
    ? <Link className="profile-menu-row" href={href}>{contents}</Link>
    : <span className="profile-menu-row" aria-disabled="true">{contents}</span>}
  </li>;
}

export default async function ProfilePage() {
  const account = await readAccount();
  const staff = account?.role === "owner" || account?.role === "maker";
  const menu: MenuItem[] = [
    { label: "Мои заказы", icon: Package, href: "/profile/orders" },
    { label: "Избранное", icon: Heart, href: "/favorites" },
    { label: "Уведомления", icon: Bell, href: account ? "/profile/notifications" : undefined },
    ...(account?.role === "owner" ? [{ label: "Управление командой", icon: UsersRound, href: "/studio/team" }] : []),
    { label: "Мои бронирования", icon: CalendarDays },
    { label: "Связаться с мастерской", icon: Mail },
    ...(account ? [{ label: "Настройки", icon: Settings, href: "/profile/settings" }] : []),
  ];
  return <section className="profile-page">
    <PageHeading title="Мой профиль" action={account &&
      <Link className="profile-settings-shortcut" href="/profile/settings" aria-label="Настройки профиля"><Settings size={19} strokeWidth={1.65} aria-hidden /></Link>} />
    <div className="profile-identity">
      <span className="profile-avatar" aria-hidden="true"><UserRound size={23} strokeWidth={1.65} /></span>
      <div className="profile-identity-copy">
        <p className="profile-name">{account ? account.name || account.email || "Пользователь Roomlet" : "Гость"}</p>
        <p className="profile-role">{account ? `Личный кабинет · ${roleLabels[account.role]}` : "Личный кабинет"}</p>
      </div>
    </div>
    {!account && <div className="profile-guest-actions"><Link className="store-primary-link" href="/profile/login">Войти <ArrowUpRight size={16} aria-hidden /></Link><Link className="profile-signin" href="/profile/register">Создать аккаунт</Link></div>}
    {staff && <Link href="/studio" className="profile-studio">
      <span className="profile-studio-icons"><LayoutGrid size={22} strokeWidth={1.7} aria-hidden /><ArrowUpRight size={18} aria-hidden /></span>
      <span className="profile-studio-title">Roomlet Studio</span>
      <span className="profile-studio-subtitle">Управление мастерской</span>
      <span className="profile-studio-sections">Изделия · Заказы · Календарь</span>
    </Link>}
    <nav aria-label="Разделы профиля" className="profile-menu">
      <ul>{menu.map(item => <ProfileMenuRow key={item.label} {...item} />)}</ul>
    </nav>
    {account && <form action={leaveProfile} className="profile-signout-form">
      <button className="profile-signout" type="submit"><LogOut size={18} aria-hidden /> Выйти из аккаунта</button>
    </form>}
  </section>;
}
