import test from "node:test";
import assert from "node:assert/strict";
import { verifyTelegramInitData } from "../src/lib/telegram/init-data.server.ts";

const token = "roomlet-test-only";
const issuedAt = 1787500800;

// Independently computed HMAC fixtures with synthetic profile fields and test secret.
const fields = {
  user: JSON.stringify({ id: 9876543210, first_name: "Mira", last_name: "Volkova", username: "mira_demo",
    language_code: "ru", photo_url: "https://example.test/photo.jpg", role: "owner" }),
  auth_date: String(issuedAt),
  signature: "signed-ext",
  query_id: "test+fixture",
  hash: "b4d97dcc436cf413a3bb83f1c80e730fa54b3fa57c94c9e380ed88885dfb2ae3",
};
const encode = (extra: Partial<typeof fields> = {}) => new URLSearchParams({ ...fields, ...extra }).toString();

test("Telegram verifies the signed profile, preserves large IDs and only returns display fields", () => {
  const proof = verifyTelegramInitData(encode(), token, issuedAt);
  assert.deepEqual(proof, {
    telegramId: "9876543210", displayName: "Mira Volkova", username: "mira_demo", languageCode: "ru",
    photoUrl: "https://example.test/photo.jpg", expiresAt: issuedAt + 300, replayKey: proof.replayKey,
  });
  assert.match(proof.replayKey, /^[a-f\d]{64}$/);
  const reordered = new URLSearchParams(Object.entries(fields).reverse()).toString().replace("%2B", "%2b");
  assert.equal(verifyTelegramInitData(reordered, token, issuedAt).replayKey, proof.replayKey);
});

test("Telegram rejects changed fields, duplicate keys and mismatched bot secrets", () => {
  for (const raw of [encode({ signature: "" }), encode({ query_id: "" }), encode() + "&auth_date=" + issuedAt,
    encode() + "&hash=" + fields.hash, encode({ hash: "" }), encode({ hash: "f".repeat(64) }), ""]) {
    assert.throws(() => verifyTelegramInitData(raw, token, issuedAt), /Invalid Telegram/);
  }
  assert.throws(() => verifyTelegramInitData(encode(), "another-test-bot", issuedAt));
  assert.throws(() => verifyTelegramInitData(encode(), "", issuedAt));
});

test("Telegram accepts a fresh launch within clock tolerance and rejects expired or future launches", () => {
  for (const now of [issuedAt - 30, issuedAt, issuedAt + 299]) {
    assert.equal(verifyTelegramInitData(encode(), token, now).telegramId, "9876543210");
  }
  for (const now of [issuedAt - 31, issuedAt + 300, NaN]) {
    assert.throws(() => verifyTelegramInitData(encode(), token, now));
  }
});

test("Telegram refuses signed data with an invalid user, ID or timestamp", () => {
  for (const extra of [
    { user: '{"id":0,"first_name":"Mira"}', hash: "7c987e809f619325acbcd250b6f934a2e173ee127adced8e371ae590599393eb" },
    { user: "null", hash: "bb35ef6c3e3f6f010ebdb1a137acd8bc652550ce1ac93c826537e2d413cadaf5" },
    { user: "not-json", hash: "0feba5e0f341926de42b780a2dac4f16aba7a768169ed431c4e19b3ef1770450" },
    { auth_date: "no-date", hash: "be093c73ccb2a790522ae091f6014a081a0cf6523b102aa1e4ac6d5b17fb0dc9" },
  ]) assert.throws(() => verifyTelegramInitData(encode(extra), token, issuedAt), /Invalid Telegram/);
});
