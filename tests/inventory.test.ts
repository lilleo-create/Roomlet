import test from "node:test";
import assert from "node:assert/strict";
import { minorUnits, formatMinor, productFields, publicationError } from "../src/features/inventory/model.ts";
import { mediaInput, limitedForm } from "../src/features/inventory/media-input.ts";

const id="114ca856-0921-44fa-a40c-0cfb71bf83e2";
const path=id+"/"+id+".webp";
function baseForm() {
  const form=new FormData();
  for (const [k,v] of Object.entries({title:"Миниатюра",status:"published",price:"0,29",currency:"RUB",cost:"0.15",
    planned_minutes:"40",ready_quantity:"0",category_id:id})) form.set(k,v);
  return form;
}

test("цены в минимальных единицах без округления, включая валюты с 0 и 3 знаками",()=>{
  assert.equal(minorUnits("0,29","RUB"),29);
  assert.equal(minorUnits("480","JPY"),480);
  assert.equal(minorUnits("2.005","KWD"),2005);
  assert.equal(formatMinor(2005,"KWD"),"2.005");
  for(const amount of ["0.009","1e3","NaN","120000000000000","-1"]) assert.throws(()=>minorUnits(amount,"RUB"));
  assert.throws(()=>minorUnits("1.50","JPY"));
  assert.throws(()=>minorUnits("1.50","XYZ"));
});
test("публикация требует фотографии, категории, положительной цены и доступного предложения",()=>{
  const form=baseForm();
  assert.match(publicationError(productFields(form),1)!,/экземпляр/);
  form.set("made_to_order","on");
  assert.equal(publicationError(productFields(form),1),null);
  assert.match(publicationError(productFields(form),0)!,/фотограф/);
  form.delete("category_id");
  assert.ok(publicationError(productFields(form),1));
  form.set("status","draft");
  assert.equal(publicationError(productFields(form),0),null);
});
test("существующие фотографии можно использовать только из текущей карточки",()=>{
  const form=baseForm();
  const one={kind:"stored",key:path,alt:"Ротонда"};
  form.set("media",JSON.stringify([one]));
  assert.deepEqual(mediaInput(form,id,[path]),[{existing:path,alt:"Ротонда"}]);
  assert.throws(()=>mediaInput(form,id,[]));
  assert.throws(()=>mediaInput(form,"00",[path]));
  form.set("media",JSON.stringify([one,one]));
  assert.throws(()=>mediaInput(form,id,[path]));
});
test("multipart чтение ограничивает фактическое тело при отсутствующем заголовке размера",async()=>{
  const form=baseForm();
  assert.equal((await limitedForm(new Request("http://localhost/",{method:"POST",body:form}))).get("title"),"Миниатюра");
  const request=new Request("http://localhost/",{method:"POST",body:new Uint8Array(4_000_001)});
  await assert.rejects(limitedForm(request),/Слишком большой/);
});
