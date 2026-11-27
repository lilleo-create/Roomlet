import assert from "node:assert/strict";
import test from "node:test";
import { addDays, fullDay, timeInZone, todayInStudio } from "../src/features/booking/calendar.ts";
import { observeClock, type DeviceClock } from "../src/features/booking/clock.ts";

test("часы обновляют дату в полночь, при смене пояса и возврате после сна", t => {
  const initial = Date.parse("2026-11-27T20:59:59.950Z");
  t.mock.timers.enable({ apis: ["Date", "setTimeout"], now: initial });
  let zone = "Europe/Moscow";
  const resolve = Intl.DateTimeFormat.prototype.resolvedOptions;
  t.mock.method(Intl.DateTimeFormat.prototype, "resolvedOptions", function (this: Intl.DateTimeFormat) {
    return { ...resolve.call(this), timeZone: zone };
  });
  const page = new EventTarget(), visibility = new EventTarget();
  const events: DeviceClock[] = [];
  const stop = observeClock(value => events.push(value), page, visibility);
  function latest() {
    const value = events[events.length - 1];
    return [value.timeZone, todayInStudio(value.now, value.timeZone), timeInZone(value.now, value.timeZone)];
  }
  assert.deepEqual(latest(), ["Europe/Moscow", "2026-11-27", "23:59"]);
  t.mock.timers.tick(50);
  assert.deepEqual(latest(), ["Europe/Moscow", "2026-11-28", "00:00"]);
  zone = "America/Los_Angeles";
  page.dispatchEvent(new Event("focus"));
  assert.deepEqual(latest(), ["America/Los_Angeles", "2026-11-27", "13:00"]);
  zone = "Pacific/Kiritimati";
  t.mock.timers.tick(60_000);
  assert.deepEqual(latest(), ["Pacific/Kiritimati", "2026-11-28", "11:01"]);
  t.mock.timers.setTime(Date.parse("2026-12-02T21:05:00Z"));
  visibility.dispatchEvent(new Event("visibilitychange"));
  assert.deepEqual(latest(), ["Pacific/Kiritimati", "2026-12-03", "11:05"]);
  stop();
  const count = events.length;
  page.dispatchEvent(new Event("pageshow"));
  t.mock.timers.tick(60_000);
  assert.equal(events.length, count);
});

test("переходы на летнее и зимнее время сохраняют календарные дни", () => {
  const zone = "America/New_York";
  const cases = [
    ["2026-03-08T06:59:00Z", "2026-03-08", "01:59"],
    ["2026-03-08T07:00:00Z", "2026-03-08", "03:00"],
    ["2026-11-01T05:59:00Z", "2026-11-01", "01:59"],
    ["2026-11-01T06:00:00Z", "2026-11-01", "01:00"],
  ];
  for (const [utc, day, time] of cases) {
    assert.equal(todayInStudio(new Date(utc), zone), day);
    assert.equal(timeInZone(new Date(utc), zone), time);
  }
  assert.equal(addDays("2026-03-08", 1), "2026-03-09");
  assert.equal(addDays("2026-11-01", 1), "2026-11-02");
  assert.match(fullDay("2026-01-01"), /^1 января 2026/);
});
