import Link from "next/link";
import { ArrowUpRight, Bell, CalendarDays, ChevronRight, Heart, LayoutGrid, LogOut, Mail, Package, Settings, UsersRound, type LucideIcon } from "lucide-react";
import { ProfileAvatar } from '@/features/profile/ProfileAvatar';
import { PageHeading } from "@/components/ui";
import { readAccount } from "@/features/profile/session";
import { leaveProfile } from "./actions";
import {readSupportUsername} from "@/lib/telegram/support.server";
import {supportLink} from "@/lib/telegram/support";
import {GuestLogin} from '@/features/profile/GuestLogin';
import {readRegistrationDocuments} from '@/features/profile/registration-documents.server';

type MenuItem = { label: string; icon: LucideIcon; href?: string };

function ProfileMenuRow({ label, icon: Icon, href }: MenuItem) {
  const contents = <>
    <Icon size={19} strokeWidth={1.65} aria-hidden />
    <span className="profile-menu-label">{label}</span>
    {href ? <ChevronRight className="profile-chevron" size={18} aria-hidden />
      : <span className="profile-unavailable">Недоступно</span>}
  </>;
  return <li>{href
    ? href.startsWith('https://t.me/') ? <a className="profile-menu-row" href={href} target="_blank" rel="noopener noreferrer">{contents}</a>
      : <Link className="profile-menu-row" href={href}>{contents}</Link>
    : <span className="profile-menu-row" aria-disabled="true">{contents}</span>}
  </li>;
}

export default async function ProfilePage() {
  const account = await readAccount();
  const contact=supportLink(await readSupportUsername());
  const staff = account?.role === "owner" || account?.role === "maker";
  const menu: MenuItem[] = [
    { label: "Мои заказы", icon: Package, href: "/profile/orders" },
    { label: "Избранное", icon: Heart, href: "/favorites" },
    { label: "Уведомления", icon: Bell, href: account ? "/profile/notifications" : undefined },
    ...(account?.role === "owner" ? [{ label: "Управление командой", icon: UsersRound, href: "/studio/team" }] : []),
    { label: "Мои бронирования", icon: CalendarDays },
    { label: "Связаться с мастерской", icon: Mail, href: contact??undefined },
    ...(account ? [{ label: "Настройки", icon: Settings, href: "/profile/settings" }] : []),
  ];
  return <section className="profile-page">
    <PageHeading title="Мой профиль" action={account &&
      <Link className="profile-settings-shortcut" href="/profile/settings" aria-label="Настройки профиля"><Settings size={19} strokeWidth={1.65} aria-hidden /></Link>} />
    <div className="profile-identity">
      <ProfileAvatar src={account?.avatar} />
      <div className="profile-identity-copy">
        <p className="profile-name">{account ? account.name || account.email || "Пользователь Roomlet" : "Гость"}</p>
        <p className="profile-role">Личный кабинет</p>
      </div>
    </div>
    {!account && <GuestLogin privacyUrl={(await readRegistrationDocuments())?.privacy.url} />}
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
