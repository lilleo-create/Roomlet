"use client";

import { Photo as ProductPhoto } from "@/components/Photo";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUp, Camera, Plus, Trash2 } from "lucide-react";
import { Button, Dialog, IconButton, Input, Select, Textarea } from "@/components/ui";
import { createCategory } from "@/app/studio/products/categories";
import { formatMinor, imageLimit, statusLabels, type Category, type InventoryItem } from "./model";
import { preparePhoto } from "./optimize";

type Photo = {key:string;url:string;alt:string;file?:File};

export function ProductEditor({item, categories, notice, showcase=false}: {showcase?:boolean;item:InventoryItem;categories:Category[];notice?:string}) {
  const router = useRouter();
  const [photos, setPhotos] = useState<Photo[]>(() => item.media.map(row=>({key:row.storage_path,url:row.url,alt:row.alt_text})));
  const [categoryList,setCategoryList] = useState(categories);
  const [categoryId,setCategoryId] = useState(item.category_id || "");
  const [categoryOpen,setCategoryOpen] = useState(false);
  const [categoryName,setCategoryName] = useState("");
  const [categoryError,setCategoryError] = useState("");
  const [categoryPending,setCategoryPending] = useState(false);
  const [deleteOpen,setDeleteOpen] = useState(false);
  const [progress,setProgress] = useState("");
  const [error,setError] = useState("");
  const [status,setStatus] = useState(item.status);
  const pending = useRef(false);
  const previews = useRef(new Set<string>());
  const errorBox = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    const urls=previews.current;
    return () => { for (const url of urls) URL.revokeObjectURL(url); };
  }, []);
  useEffect(() => { if (error) errorBox.current?.focus(); }, [error]);

  function pickFiles(files: File[]) {
    if (!files.length) return;
    if (files.length + photos.length > imageLimit) { setError("Можно добавить до 12 фотографий."); return; }
    if (files.some(file=>file.size > 24*1024*1024)) { setError("Выберите фотографии до 24 МБ каждая."); return; }
    const added = files.map(file => {
      const url = URL.createObjectURL(file);
      previews.current.add(url);
      return {key:crypto.randomUUID(),url,file,alt:""};
    });
    setPhotos(prev => [...prev,...added]);
    setError("");
  }
  async function newCategory() {
    if (categoryPending) return;
    setCategoryPending(true); setCategoryError("");
    try {
      const result = await createCategory(categoryName,showcase);
      if (!result.item) { setCategoryError(result.error || "Не удалось добавить категорию."); return; }
      const added=result.item;
      setCategoryList(prev => prev.some(c=>c.id===added.id) ? prev : [...prev,added]);
      setCategoryId(added.id);setCategoryOpen(false);setCategoryName("");
    } catch { setCategoryError("Проверьте соединение и доступ к Studio."); }
    finally { setCategoryPending(false); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current=true;
    const form=new FormData(event.currentTarget);
    setError("");setProgress("Сохранение…");
    try {
      if (status === "published" && !photos.length) throw new Error("Для публикации нужна хотя бы одна фотография.");
      form.set("media", JSON.stringify(photos.map(p=>({key:p.key,kind:p.file?"upload":"stored",alt:p.alt}))));
      for (const [index,photo] of photos.entries()) {
        if (!photo.file) continue;
        setProgress("Подготовка фото " + (index+1) + " из " + photos.length + "…");
        form.set("upload-"+photo.key, await preparePhoto(photo.file), "photo.webp");
      }
      setProgress("Сохранение изделия…");
      const response=await fetch("/studio/products/"+item.id+"/save", {method:"POST",headers:{"x-roomlet-environment":showcase?"demo":"live"},body:form});
      if (response.redirected) throw new Error("Сессия завершилась. Войдите в Studio повторно.");
      const result=await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось сохранить изделие.");
      router.replace("/studio/products/"+item.id+(result.warning?"?notice=cleanup":"?notice=saved"));
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось сохранить изменения."); setProgress("");pending.current=false; }
  }
  async function remove() {
    if (pending.current || !item.updated_at) return;
    pending.current=true;setDeleteOpen(false);setError("");setProgress("Удаление…");
    try {
      const response=await fetch("/studio/products/"+item.id+"/save", {method:"DELETE", headers:{"x-product-version":item.updated_at,"x-roomlet-environment":showcase?"demo":"live"}});
      if (response.redirected) throw new Error("Сессия завершилась. Войдите в Studio повторно.");
      const result=await response.json();
      if (!response.ok) throw new Error(result.error || "Не удалось удалить изделие.");
      router.replace("/studio/products?notice="+(result.warning?"cleanup":"deleted"));
      router.refresh();
    } catch (err) { setError(err instanceof Error ? err.message : "Не удалось удалить изделие.");setProgress("");pending.current=false; }
  }

  return <div className="inventory">
    <Link href="/studio/products" className="inventory-back">← Все изделия</Link>
    <h1>{item.updated_at ? item.title : "Новое изделие"}</h1>
    {item.is_demo && <p className="rs-demo">Демонстрационное изделие</p>}
    {notice && <p role="status" className="inventory-note">{notice}</p>}
    <form onSubmit={save}>
      <fieldset disabled={Boolean(progress)} className="inventory-fields">
        <input type="hidden" name="expected_updated_at" value={item.updated_at || ""}/>
        <section><h2>Карточка изделия</h2>
          <Input label="Название" name="title" defaultValue={item.title} maxLength={200} required/>
          <Textarea label="Описание" name="description" defaultValue={item.description} rows={4} maxLength={10000}/>
          <div className="inventory-category"><Select name="category_id" label="Категория" value={categoryId} onChange={e=>setCategoryId(e.target.value)} required={status==="published"}>
            <option value="">Выберите категорию</option>{categoryList.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</Select>
            <IconButton label="Новая категория" onClick={()=>{setCategoryError("");setCategoryOpen(true);}}><Plus size={20}/></IconButton></div>
          <div className="inventory-pair"><Input name="dimensions" label="Размеры" placeholder="Высота × ширина × глубина, см" maxLength={1000} defaultValue={item.dimensions}/>
            <Input name="materials" label="Материалы" maxLength={1000} defaultValue={item.materials}/></div>
        </section>
        <section><h2>Фотографии</h2><p>Первая фотография станет обложкой. До 12 снимков, каждый до 24 МБ.</p>
          <div className="inventory-gallery">{photos.map((photo,index)=><div key={photo.key} className="inventory-photo">
            <div className="inventory-photo-preview"><ProductPhoto photo={{src:photo.url, alt:photo.alt || "Фотография "+(index+1)}} sizes="(max-width: 480px) 100vw, 240px" /></div>
            <div className="inventory-photo-tools"><span>{index===0?"Обложка":"Фото "+(index+1)}</span>
              {index>0 && <IconButton label={"Сделать обложкой фото "+(index+1)} onClick={()=>setPhotos([photo,...photos.filter(p=>p!==photo)])}><ArrowUp size={17}/></IconButton>}
              <IconButton label={"Убрать фото "+(index+1)} onClick={()=>{if(photo.file){URL.revokeObjectURL(photo.url);previews.current.delete(photo.url);}setPhotos(photos.filter(p=>p!==photo));}}><Trash2 size={17}/></IconButton></div>
            <Input label={"Подпись к фото "+(index+1)} maxLength={300} value={photo.alt} onChange={e=>setPhotos(photos.map(p=>p===photo?{...p,alt:e.target.value}:p))}/>
          </div>)}</div>
          {photos.length<imageLimit && <label className="inventory-upload"><Camera size={20}/> Добавить фотографии<input type="file" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={e=>{pickFiles(Array.from(e.target.files || []));e.target.value="";}}/></label>}
        </section>
        <section><h2>Цена и производство</h2>
          <div className="inventory-pair"><Input label="Цена" name="price" inputMode="decimal" required defaultValue={formatMinor(item.price_minor,item.currency)}/>
            <Input label="Валюта" name="currency" required maxLength={3} minLength={3} placeholder="RUB" defaultValue={item.currency}/></div>
          <div className="inventory-pair"><Input label="Себестоимость в той же валюте" name="cost" inputMode="decimal" required defaultValue={formatMinor(item.cost_minor,item.currency)}/>
            <Input label="Плановые трудозатраты, мин" name="planned_minutes" type="number" min={0} max={525600} required defaultValue={item.planned_minutes}/></div>
          <Input label="Готовые экземпляры в наличии" hint="Укажите число свободных экземпляров." name="ready_quantity" type="number" min={0} max={1000} required defaultValue={item.ready_quantity}/>
          <label className="inventory-check"><input type="checkbox" name="made_to_order" defaultChecked={item.made_to_order}/> Доступно под заказ</label>
          <label className="inventory-check"><input type="checkbox" name="requires_sketch" defaultChecked={item.requires_sketch}/> Требуется эскиз</label>
        </section>
        <section><h2>Публикация</h2>
          {item.is_demo && <Select label="Доступность для витрины" name="catalog_stage" defaultValue={item.catalog_stage ?? "active"}>
            <option value="active">По наличию и условиям заказа</option><option value="upcoming">Предстоящий выпуск</option><option value="sold">Продано</option>
          </Select>}
          <Select label="Статус изделия" name="status" value={status} onChange={e=>setStatus(e.target.value as InventoryItem["status"])}>
            {Object.entries(statusLabels).map(([value,label])=><option value={value} key={value}>{label}</option>)}</Select>
          <p>В магазине видны опубликованные изделия. Чтобы снять изделие с публикации, сохраните его как черновик или перенесите в архив.</p>
          <Button type="submit">{progress || "Сохранить изделие"}</Button>
        </section>
      </fieldset>
    </form>
    {error && <p className="inventory-error" role="alert" tabIndex={-1} ref={errorBox}>{error}</p>}
    {item.updated_at && <Button variant="danger" onClick={()=>setDeleteOpen(true)} disabled={Boolean(progress)}>Удалить изделие</Button>}
    <Dialog title="Добавить категорию" open={categoryOpen} onClose={()=>setCategoryOpen(false)}>
      <Input label="Название категории" value={categoryName} onChange={e=>setCategoryName(e.target.value)} maxLength={100}/>
      {categoryError && <p role="alert" className="inventory-error">{categoryError}</p>}
      <Button onClick={newCategory} disabled={!categoryName.trim() || categoryPending}>Добавить категорию</Button>
    </Dialog>
    <Dialog title="Удалить изделие?" open={deleteOpen} onClose={()=>setDeleteOpen(false)}>
      <p>«{item.title}» и его фотографии будут удалены. Чтобы сохранить карточку, выберите статус «В архиве».</p>
      <Button variant="secondary" onClick={()=>setDeleteOpen(false)}>Отмена</Button> <Button variant="danger" onClick={remove}>Удалить окончательно</Button>
    </Dialog>
  </div>;
}
