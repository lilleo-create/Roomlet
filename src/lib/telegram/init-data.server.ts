import { createHash, createHmac, timingSafeEqual } from "node:crypto";

const maxAgeSeconds = 300;
const clockSkewSeconds = 30;

export type TelegramLaunch = {
  telegramId: string;
  displayName: string | null;
  username: string | null;
  languageCode: string | null;
  photoUrl: string | null;
  expiresAt: number;
  replayKey: string;
};

function invalid(): never {
  throw new Error("Invalid Telegram launch data");
}

function textField(value: unknown, maxLength: number) {
  if (typeof value !== "string" || value.length > maxLength) return null;
  return value.trim() || null;
}

function photoField(value: unknown) {
  const text = textField(value, 2048);
  if (!text || !URL.canParse(text)) return null;
  const url = new URL(text);
  return url.protocol === "https:" && !url.username && !url.password ? url.href : null;
}

/** Verifies one launch. The broker must consume replayKey before issuing a login. */
export function verifyTelegramInitData(raw: string, botToken: string, nowSeconds = Math.floor(Date.now() / 1000)): TelegramLaunch {
  if (!botToken || !raw || raw.length > 16384 || !Number.isSafeInteger(nowSeconds)) invalid();
  const fields = new Map<string, string>();
  for (const [key, value] of new URLSearchParams(raw)) {
    if (fields.has(key) || !/^[a-z][a-z0-9_]*$/.test(key) || /[\r\n]/.test(value)) invalid();
    fields.set(key, value);
  }
  const hash = fields.get("hash");
  if (!hash || !/^[0-9a-f]{64}$/.test(hash)) invalid();
  fields.delete("hash");
  // Bot-token HMAC covers all other fields, including the optional third-party signature.
  const canonical = [...fields.keys()].sort().map(key => key + "=" + fields.get(key)).join("\n");
  const secret = createHmac("sha256", "WebAppData").update(botToken).digest();
  const expected = createHmac("sha256", secret).update(canonical).digest();
  if (!timingSafeEqual(expected, Buffer.from(hash, "hex"))) invalid();

  const date = fields.get("auth_date");
  if (!date || !/^\d{1,12}$/.test(date)) invalid();
  const issuedAt = Number(date);
  const expiresAt = issuedAt + maxAgeSeconds;
  if (issuedAt > nowSeconds + clockSkewSeconds || nowSeconds >= expiresAt) invalid();
  let user;
  try {
    user = JSON.parse(fields.get("user") ?? "");
  } catch {
    invalid();
  }
  if (!user || !Number.isSafeInteger(user.id) || user.id <= 0 || user.is_bot === true) invalid();

  const name = [textField(user.first_name, 128), textField(user.last_name, 128)].filter(Boolean).join(" ");
  return {
    telegramId: String(user.id),
    displayName: name || null,
    username: textField(user.username, 64),
    languageCode: textField(user.language_code, 35),
    photoUrl: photoField(user.photo_url),
    expiresAt,
    // Query ordering or re-encoding cannot produce another redemption key.
    replayKey: createHash("sha256").update(expected).digest("hex"),
  };
}
