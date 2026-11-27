export type DeviceClock = { now: Date; timeZone: string };

export function observeClock(onChange: (clock: DeviceClock) => void, page: EventTarget = window, visibility: EventTarget = document) {
  let timer: ReturnType<typeof setTimeout>;
  function update() {
    clearTimeout(timer);
    const now = new Date();
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    onChange({ now, timeZone });
    timer = setTimeout(update, 60_000 - (now.getTime() % 60_000));
  }

  update();
  page.addEventListener("focus", update);
  page.addEventListener("pageshow", update);
  visibility.addEventListener("visibilitychange", update);
  return () => {
    clearTimeout(timer);
    page.removeEventListener("focus", update);
    page.removeEventListener("pageshow", update);
    visibility.removeEventListener("visibilitychange", update);
  };
}
