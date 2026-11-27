import { PageHeading } from "@/components/ui";
import {wantsShowcase} from "@/features/studio/session";
import {StudioShell} from "@/features/studio/Shell";
import {readWorkshop} from "@/features/studio/workshop";
import {WorkshopTimezone} from "@/features/studio/WorkshopTimezone";
import {fullDay, todayInStudio, validDate, weekdays} from "@/features/booking/calendar";
import {BlockPeriodFields} from "@/features/studio/BlockPeriodFields";
import {addBlock,removeBlock,saveSettings} from "./actions";
export default async function Settings({searchParams}:{searchParams:Promise<{result?:string;day?:string}>}) {
  const data=await readWorkshop();
  const environment = <input type="hidden" name="environment" value={await wantsShowcase() ? "demo" : "live"}/>;
  const {result,day} = await searchParams;
  const initialDay = day && validDate(day) && !data.blocks.some(b => day >= b.start_date && day <= b.end_date) ? day : null;
  const zones=Array.from(new Set(["UTC",data.timezone,...Intl.supportedValuesOf("timeZone")]));
  const currencies=Array.from(new Set([data.currency,...Intl.supportedValuesOf("currency")]));
  return <StudioShell active="settings"><p className="rs-cap">Мастерская</p><PageHeading title="Настройки" />
    {result && <p role="status">{result==="saved"?"Изменения сохранены.": result==="invalid"?"Проверьте даты и введённые значения.":"Не удалось сохранить. Проверьте значения и попробуйте снова."}</p>}
    <div className="rs-settings-grid"><form action={saveSettings} className="rs-settings-form">
    {environment}<h2>Рабочий график</h2><WorkshopTimezone key={data.timezoneConfigured ? data.timezone : "auto"} savedZone={data.timezoneConfigured ? data.timezone : null} zones={zones}/>
    <label>Валюта по умолчанию<select name="currency" defaultValue={data.currency}>{currencies.map(v=><option key={v}>{v}</option>)}</select></label>
    <fieldset><legend>Рабочих часов в день</legend><p>Укажите 0 для выходного дня.</p><div className="rs-hours-inputs">{weekdays.map((name,i)=><label key={name}>{name}<input type="number" min="0" max="24" step="any" required name={"day-"+(i+1)} defaultValue={(data.hours.find(h=>h.weekday===i+1)?.minutes??0)/60}/></label>)}</div></fieldset>
    <label>Ежедневный резерв, мин<input name="buffer_minutes" type="number" min="0" max="1440" step="1" required defaultValue={data.bufferMinutes}/></label>
    <button className="rs-primary">Сохранить график</button></form>
    <section className="rs-settings-form"><h2>Заблокированные периоды</h2>
    {data.blocks.length===0 && <p>Блокировок пока нет.</p>}
    {data.blocks.map(b=><form action={removeBlock} key={b.id} className="rs-block-row">{environment}<input type="hidden" name="id" value={b.id}/><strong>{fullDay(b.start_date)} — {fullDay(b.end_date)}</strong><p>{b.reason}</p><button>Снять блокировку</button></form>)}
    <form action={addBlock} className="rs-settings-form">{environment}
      <BlockPeriodFields initialDay={initialDay} initialToday={todayInStudio(new Date(),data.timezone)} timezone={data.timezone} blocks={data.blocks}/>
    </form>
    </section></div></StudioShell>;
}
