"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, ArrowUpRight, Heart } from "lucide-react";
import {
  BottomSheet, Button, Dialog, EmptyState, ErrorState, IconButton, Input, ObjectNumber,
  Price, SearchInput, Select, Skeleton, StatusTag, Textarea, TextLink, Toast,
} from "@/components/ui";
import { OrderCard, OrderTimeline } from "@/components/patterns";
import type { ReactNode } from "react";
import { BuyerBooking } from "@/features/booking/BuyerBooking";

const colors = [
  ["Canvas", "canvas", "F6F2EA"], ["Surface", "surface", "FCFAF6"],
  ["Ink", "ink", "151515"], ["Primary", "primary", "315CFF"],
  ["Primary Hover", "primary-hover", "2549DB"], ["Primary Pressed", "primary-pressed", "1D37B0"],
  ["Signal", "signal", "FF5A4E"], ["Border", "border", "D8D1C7"],
  ["Muted", "muted", "706C65"], ["Success", "success", "237A4B"],
  ["Warning", "warning", "A15C00"], ["Error", "error", "C52B32"], ["On Primary", "on-primary", "FFFFFF"],
] as const;
const typeStyles = [
  ["Display", "display", "40 / 44 · 800"], ["H1", "h1", "28 / 34 · 700"],
  ["H2", "h2", "24 / 30 · 700"], ["H3", "h3", "20 / 26 · 600"],
  ["Body", "body", "16 / 24 · 400"], ["Small", "small", "14 / 20 · 400"],
  ["Caption", "caption", "12 / 16 · 500"], ["Label", "label", "11 / 16 · 600"],
  ["Button", "button", "16 / 20 · 600"],
] as const;

export function DesignSystem({ storeSamples }: { storeSamples: ReactNode }) {
  const [overlay, setOverlay] = useState<"dialog" | "sheet" | null>(null);
  const [toast, setToast] = useState("");
  const [favorite, setFavorite] = useState(false);
  const [search, setSearch] = useState("");
  const [email, setEmail] = useState("");
  const [retried, setRetried] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const emailError = !!email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  return <div className="ds-page">
    <header className="ds-top">
      <Link href="/" className="ds-logo" aria-label="Roomlet, главная">roomlet<span aria-hidden="true">.</span></Link>
      <Link href="/" className="ds-back"><ArrowLeft size={16} aria-hidden /> В магазин</Link>
    </header>
    <main className="ds-main">
      <div className="ds-masthead"><div><span className="ds-edition">Библиотека интерфейса · v1.0</span><h1>Дизайн-система</h1></div>
        <nav aria-label="Содержание дизайн-системы" className="ds-index">
          {[["tokens", "Основа"], ["controls", "Управление"], ["states", "Состояния"], ["store", "Витрина"], ["booking", "Бронирование"], ["orders", "Заказы"]].map(([id, name]) =>
            <a key={id} href={`#${id}`}>{name}<ArrowUpRight size={13} aria-hidden /></a>)}
        </nav>
      </div>
      <section className="ds-section" id="tokens"><h2>Цвет и шрифт</h2>
        <div className="ds-palette">{colors.map(([name, token, hex]) => <div key={token} className="ds-swatch">
          <i style={{ backgroundColor: `var(--${token})` }} aria-hidden /><strong>{name}</strong><small>#{hex}</small>
        </div>)}</div>
        <div className="ds-font-list">{typeStyles.map(([label, variable, metrics]) => <div key={variable}>
          <span style={{ font: `var(--${variable})` }}>{label === "Display" ? "Мастерская" : "Миниатюра"}</span>
          <small>{label} · {metrics}</small>
        </div>)}</div>
      </section>
      <section className="ds-section" id="controls"><h2>Элементы управления</h2>
        <div className="ds-actions">
          <Button onClick={() => setToast("Пример уведомления")}>Уведомление</Button>
          <Button variant="secondary" onClick={() => setOverlay("dialog")}>Диалог</Button>
          <Button variant="quiet" onClick={() => setOverlay("sheet")}>Нижняя панель</Button>
          <Button disabled>Недоступно</Button>
          <IconButton label={favorite ? "Удалить из избранного" : "В избранное"} aria-pressed={favorite} onClick={() => setFavorite(!favorite)}>
            <Heart size={21} aria-hidden fill={favorite ? "currentColor" : "none"} />
          </IconButton>
          <TextLink href="/catalog">Каталог</TextLink>
        </div>
        <div className="ds-forms">
          <Input type="email" label="Электронная почта" value={email} placeholder="name@example.ru" onChange={event => setEmail(event.target.value)}
            error={emailError ? "Проверьте адрес электронной почты." : undefined} />
          <SearchInput label="Найти цвет" placeholder="Название или HEX" value={search} onChange={event => setSearch(event.target.value)} />
          <Select label="Способ заказа" defaultValue="ready"><option value="ready">Готовый экземпляр</option><option value="made">Изготовление под заказ</option></Select>
          <Textarea label="Описание проекта" placeholder="Материалы, масштаб, детали" />
        </div>
        {search.trim() && <p role="status" className="ds-hint">
          {colors.filter(([name,,hex]) => (name + " #" + hex).toLowerCase().includes(search.trim().toLowerCase())).map(([name]) => name).join(", ") || "Цвет не найден"}
        </p>}
        <div className="ds-actions ds-status-row">
          <StatusTag tone="success">В наличии</StatusTag><StatusTag tone="primary">Под заказ</StatusTag>
          <StatusTag tone="warning">Скоро</StatusTag><StatusTag>Архив</StatusTag><StatusTag tone="error">Отменено</StatusTag>
          <ObjectNumber value="№ 001" /><Price value={6500} />
        </div>
      </section>
      <section className="ds-section" id="states"><h2>Состояния</h2>
        <div className="ds-state-grid">
          <div className="ds-loading" aria-label="Идёт загрузка"><Skeleton /><Skeleton /><Skeleton /></div>
          <EmptyState title="В избранном пока пусто" description="Сохраните изделие с помощью сердечка в каталоге." />
          {retried ? <div className="ui-state"><h3 role="status">Данные загружены</h3>
            <Button variant="quiet" onClick={() => setRetried(false)}>Показать ошибку снова</Button></div> :
            <ErrorState title="Не удалось загрузить" description="Проверьте соединение и попробуйте ещё раз."
              action={<Button variant="secondary" onClick={() => setRetried(true)}>Повторить</Button>} />}
        </div>
      </section>
      <section className="ds-section" id="store"><h2>Витрина</h2>{storeSamples}</section>
      <section className="ds-section" id="booking"><h2>Производственное окно</h2><div className="ds-booking"><BuyerBooking onSelect={setSelected} /></div>
        {selected && <p role="status" className="ds-hint">Выбранный период · {selected}</p>}
      </section>
      <section className="ds-section" id="orders"><h2>Заказ и его этапы</h2><div className="ds-orders">
        <OrderCard number="№ 014" title="Миниатюра на заказ" status="В работе" detail="Эскиз согласован" />
        <OrderTimeline steps={[{ label: "Заявка принята", state: "done" }, { label: "Сборка", state: "active", detail: "Мастер работает над изделием" }, { label: "Отправка", state: "upcoming" }]} />
      </div></section>
    </main>
    <Dialog open={overlay === "dialog"} onClose={() => setOverlay(null)} title="Очистить избранное?">
      <p>Эта кнопка сбросит сердечко в образце на странице.</p>
      <div className="ds-actions"><Button variant="secondary" onClick={() => setOverlay(null)}>Отмена</Button>
        <Button variant="danger" onClick={() => { setFavorite(false); setOverlay(null); setToast("Избранное очищено"); }}>Очистить</Button></div>
    </Dialog>
    <BottomSheet open={overlay === "sheet"} onClose={() => setOverlay(null)} title="Перейти к разделу">
      <nav className="ds-sheet-links" aria-label="Компоненты"><a href="#store" onClick={() => setOverlay(null)}>Витрина</a>
        <a href="#booking" onClick={() => setOverlay(null)}>Бронирование</a><a href="#orders" onClick={() => setOverlay(null)}>Заказы</a></nav>
    </BottomSheet>
    {toast && <Toast message={toast} onClose={() => setToast("")} />}
  </div>;
}
