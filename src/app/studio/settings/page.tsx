import {StudioShell} from "@/features/studio/Shell";
import {readWorkshop} from "@/features/studio/workshop";
import {fullDay, weekdays} from "@/features/booking/calendar";
import {addBlock,removeBlock,saveSettings} from "./actions";
export default async function Settings({searchParams}:{searchParams:Promise<{result?:string;day?:string}>}) {
  const data=await readWorkshop();
  const {result,day} = await searchParams;
  const zones=Array.from(new Set(["UTC",data.timezone,...Intl.supportedValuesOf("timeZone")]));
  const currencies=Array.from(new Set([data.currency,...Intl.supportedValuesOf("currency")]));
  return <StudioShell active="settings"><p className="rs-cap">Мастерская</p><div className="rs-page-title"><h1>Настройки</h1></div>
    {result && <p role="status">{result==="saved"?"Изменения сохранены.": result==="invalid"?"Проверьте даты и введённые значения.":"Не удалось сохранить. Проверьте значения и попробуйте снова."}</p>}
    <div className="rs-settings-grid"><form action={saveSettings} className="rs-settings-form">
    <h2>Рабочий график</h2><label>Часовой пояс<select name="timezone" defaultValue={data.timezone}>{zones.map(v=><option key={v}>{v}</option>)}</select></label>
    <label>Валюта по умолчанию<select name="currency" defaultValue={data.currency}>{currencies.map(v=><option key={v}>{v}</option>)}</select></label>
    <fieldset><legend>Рабочих часов в день</legend><p>Укажите 0 для выходного дня.</p><div className="rs-hours-inputs">{weekdays.map((name,i)=><label key={name}>{name}<input type="number" min="0" max="24" step="any" required name={"day-"+(i+1)} defaultValue={(data.hours.find(h=>h.weekday===i+1)?.minutes??0)/60}/></label>)}</div></fieldset>
    <label>Ежедневный резерв, мин<input name="buffer_minutes" type="number" min="0" max="1440" step="1" required defaultValue={data.bufferMinutes}/></label>
    <button className="rs-primary">Сохранить график</button></form>
    <section className="rs-settings-form"><h2>Заблокированные периоды</h2>
    {data.blocks.length===0 && <p>Блокировок пока нет.</p>}
    {data.blocks.map(b=><form action={removeBlock} key={b.id} className="rs-block-row"><input type="hidden" name="id" value={b.id}/><strong>{fullDay(b.start_date)} — {fullDay(b.end_date)}</strong><p>{b.reason}</p><button>Снять блокировку</button></form>)}
    <form action={addBlock} className="rs-settings-form"><label>С даты<input required name="start" type="date" defaultValue={day}/></label>
    <label>По дату включительно<input required name="end" type="date" defaultValue={day}/></label>
    <label>Причина для мастера<input name="reason" maxLength={200}/></label><button className="rs-primary">Закрыть период</button></form>
    </section></div></StudioShell>;
}
