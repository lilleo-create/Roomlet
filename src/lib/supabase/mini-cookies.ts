/** Only Mini App sessions use third-party cookies, isolated by the browser's top-level site. */
export const miniCookieOptions = {
  name: "__Host-roomlet-mini", path: "/", secure: true, httpOnly: true,
  sameSite: "none" as const, partitioned: true,
};

export function hasMiniSession(cookies: {name: string; value: string}[]) {
  return cookies.some(({name, value}) => Boolean(value) &&
    (name === miniCookieOptions.name || /^__Host-roomlet-mini\.\d+$/.test(name)));
}
