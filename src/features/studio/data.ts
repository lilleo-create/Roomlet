import "server-only";
import { addDays, dateStatus, dayOfWeek, todayInStudio } from "../booking/calendar";
import { products } from "../store/products";

type Stage = "Эскиз" | "Сборка" | "Отправка" | "Личное время";
export type StudioTask = {time: string; title: string; stage: Stage; order?: string};
export type DemoOrder = {number: string; title: string; status: string; due: string; info: string};
export function orders(today: string): DemoOrder[] {
  return [
    {number:"М-042", title:products[0].title, status:"В работе", due:addDays(today,5), info:"Сборка и проверка деталей"},
    {number:"М-043", title:products[1].title, status:"Эскиз на согласовании", due:addDays(today,8), info:"Подготовлен первый эскиз"},
    {number:"М-044", title:"Миниатюра по референсу", status:"Новая заявка", due:addDays(today,10), info:"Требуется оценить материалы и объём работы"},
  ];
}
export function agenda(day: string): StudioTask[] {
  if (dayOfWeek(day) >= 5) return [];
  const work: StudioTask[] = [
    {time:"10:00", title:"Проверка эскиза", stage:"Эскиз", order:"М-043"},
    {time:"12:00", title:"Сборка миниатюры", stage:"Сборка", order:"М-042"},
  ];
  if (dateStatus(day, []) === "busy") {
    work.push({time:"15:00", title:"Личная встреча мастера", stage:"Личное время"});
  } else if (dayOfWeek(day) === 4) {
    work.push({time:"16:30", title:"Подготовка упаковки", stage:"Отправка", order:"М-042"});
  }
  return work;
}
export function calendarFixture(today = todayInStudio()) {
  const first = addDays(today, -31);
  const last = addDays(today, 70);
  const schedule: Record<string, StudioTask[]> = {};
  for (let day = first; day <= last; day = addDays(day, 1)) schedule[day] = agenda(day);
  return {first,last,schedule};
}
