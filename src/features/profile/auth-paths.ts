export type AuthMode = "login" | "register" | "forgot" | "recover" | "confirm";
export type AuthQuery = { next?: string; code?: string; sb_flow_id?: string; local_proof?: string; error_code?: string; success?: string; error?: string; telegram?:string };

const storePages = new Set(["/", "/mini/link", "/profile/telegram", "/profile/email", "/profile", "/profile/orders", "/profile/settings", "/profile/notifications", "/catalog", "/cart", "/favorites", "/custom"]);
export function authDestination(value: unknown): string {
  if (typeof value !== "string" || value.length > 512 || !value.startsWith("/") || /[\\\s#%]/.test(value)) return "/profile";
  const [path, query] = value.split("?");
  if (!storePages.has(path) && !/^\/product\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(path)) return "/profile";
  if (!query) return path;
  if (path === "/catalog" && /^availability=(all|ready|made|upcoming|archive)$/.test(query) && value === path + "?" + query) return value;
  return path;
}

export function authHref(mode: AuthMode, next: string = "/profile") {
  const path = "/profile/" + mode;
  return next === "/profile" ? path : path + "?next=" + encodeURIComponent(authDestination(next));
}

export function authMailOrigin(configured: string | undefined, host: string | null): string | null {
  if (configured) {
    try {
      const url = new URL(configured);
      if (url.origin === configured.replace(/\/$/, "") && (url.protocol === "https:" ||
        (url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)))) return url.origin;
    } catch { return null; }
    return null;
  }
  // Deployment URLs come from configuration. Only loopback hosts are safe to infer.
  return host && /^(localhost|127\.0\.0\.1|\[::1\])(:\d{1,5})?$/.test(host) ? "http://" + host : null;
}
