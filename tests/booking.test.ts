import test from "node:test";
import assert from "node:assert/strict";
import { addDays, availableStarts, canStartWindow, fullDay, monthDates, todayInStudio, validDate, weekDates, windowLabel } from "../src/features/booking/calendar.ts";

const friday = "2026-11-27";

test("Moscow midnight changes the workshop day independently of the machine time zone", () => {
  assert.equal(todayInStudio(new Date("2026-11-27T20:59:59Z")), friday);
  assert.equal(todayInStudio(new Date("2026-11-27T21:00:00Z")), "2026-11-28");
});
test("both days must be free, future, and inside the 70-day horizon", () => {
  assert.equal(canStartWindow("2026-11-30", friday, []), true);
  for (const key of [friday, "2026-11-28", "2026-12-01", "2026-12-02", "2026-12-04", addDays(friday, 70)]) {
    assert.equal(canStartWindow(key, friday, []), false, key);
  }
  assert.equal(canStartWindow("2026-11-30", friday, ["2026-12-01"]), false);
  assert.equal(canStartWindow("2026-11-30", friday, ["2026-11-30"]), false);
});
test("calendar grids start Monday, include leap days, and cross year boundaries", () => {
  const leap = monthDates("2024-02-12");
  assert.equal(leap[0], "2024-01-29");
  assert.equal(leap.at(-1), "2024-03-03");
  assert.ok(leap.includes("2024-02-29"));
  assert.equal(weekDates("2027-01-01")[0], "2026-12-28");
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(canStartWindow("bad", friday, []), false);
});
test("windows have readable, unambiguous dates and expose no studio agenda", () => {
  const [start] = availableStarts(friday, []);
  assert.equal(start, "2026-11-30");
  assert.equal(windowLabel(start), `30 ноября — ${fullDay("2026-12-01")}`);
  assert.deepEqual(availableStarts(friday, Array.from({length:70}, (_, i) => addDays(friday, i+1))), []);
});
