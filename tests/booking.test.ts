import test from "node:test";
import assert from "node:assert/strict";
import {todayInStudio,startsFromDays,monthDates,weekDates,validDate} from "../src/features/booking/calendar.ts";

test("день мастерской определяется её часовым поясом",()=>{
  const instant=new Date("2026-11-27T22:10:00Z");
  assert.equal(todayInStudio(instant,"Asia/Tokyo"),"2026-11-28");
  assert.equal(todayInStudio(instant,"America/Toronto"),"2026-11-27");
});
test("начало окна использует доступность обоих дней из базы",()=>{
  const days=[{day:"2026-12-31",available_minutes:60},{day:"2027-01-01",available_minutes:15},{day:"2027-01-02",available_minutes:0}];
  assert.deepEqual(startsFromDays(days),["2026-12-31"]);
  assert.deepEqual(startsFromDays(days.slice(1)),[]);
});
test("сетка корректна на границе года и в високосный месяц",()=>{
  assert.ok(monthDates("2024-02-12").includes("2024-02-29"));
  assert.equal(weekDates("2027-01-01")[0],"2026-12-28");
  assert.equal(validDate("2026-02-30"),false);
});
