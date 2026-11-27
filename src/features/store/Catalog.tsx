"use client";
import { useState } from "react";
import { EmptyState, SearchInput, Select } from "@/components/ui";
import { track } from "@/lib/analytics";
import { ProductCard } from "./ProductCard";
import { availabilityNames, filterProducts, type Product, type Availability } from "./products";

type FilterProps = {
  products: readonly Product[]; demo: boolean;
  availability: Availability; onAvailability: (value: Availability) => void;
  category: string; onCategory: (value: string) => void;
  query: string; onQuery: (value: string) => void;
};
export function FilterBar({ products, demo, availability, onAvailability, category, onCategory, query, onQuery }: FilterProps) {
  return <div className="store-filters">
    <div className="store-filter-fields">
      <SearchInput label="Поиск" placeholder="Название или номер" value={query} maxLength={100} onChange={e => onQuery(e.target.value)} />
      <Select label="Категория" value={category} onChange={e => onCategory(e.target.value)}>
        <option value="">Все категории</option>{Array.from(new Set(products.map(p => p.category))).map(c => <option key={c}>{c}</option>)}
      </Select>
    </div>
    <div className="store-tabs" role="group" aria-label="Доступность">
      {(Object.keys(availabilityNames) as Availability[]).filter(v => demo || (v !== "archive" && v !== "upcoming")).map(value => <button key={value} type="button" aria-pressed={value === availability} onClick={() => onAvailability(value)}>{availabilityNames[value]}</button>)}
    </div>
  </div>;
}

export function Catalog({ initial = "all", products, demo }: { initial?: Availability; products: Product[]; demo: boolean }) {
  const [availability, setAvailability] = useState<Availability>(demo || !["archive","upcoming"].includes(initial) ? initial : "all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const visible = filterProducts(products, query, category, availability);
  return <div className="store-page"><div className="store-page-head"><h1>Каталог</h1></div>
    {products.length > 0 && <FilterBar products={products} demo={demo} availability={availability} category={category} query={query}
      onAvailability={v => { setAvailability(v); track("filter_apply", { availability: v }); }}
      onCategory={v => { setCategory(v); track("filter_apply", { category: v }); }}
      onQuery={v => { setQuery(v); if (v.trim()) track("search", { length: v.trim().length }); }} />}
    {products.length > 0 && <p aria-live="polite" className="store-result-count">Найдено объектов: {visible.length}</p>}
    {visible.length > 0 ? <div className="store-grid">{visible.map(product => <ProductCard key={product.slug} product={product} />)}</div>
      : !products.length ? <EmptyState title="В каталоге пока нет изделий" description="Опубликованные работы появятся здесь." /> : <EmptyState title="Объектов не найдено" description="Попробуйте другой запрос или сбросьте фильтры." action={<button className="store-light-button" onClick={() => { setQuery(""); setCategory(""); setAvailability("all"); }}>Сбросить фильтры</button>} />}
  </div>;
}
