import test from "node:test";
import assert from "node:assert/strict";
import { authDestination, authHref, authMailOrigin } from "../src/features/profile/auth-paths.ts";

test("email onboarding preserves supported store destinations and query filters", () => {
  for (const next of ["/", "/profile/orders", "/profile/settings", "/profile/notifications", "/catalog?availability=made", "/product/night-library"]) {
    assert.equal(authDestination(next), next);
    assert.equal(new URL(authHref("register", next), "https://roomlet.test").searchParams.get("next"), next);
  }
  assert.equal(authDestination("/catalog?unknown=1"), "/catalog");
  assert.equal(authHref("login"), "/profile/login");
});

test("email onboarding rejects external, private and callback destinations", () => {
  for (const path of [undefined, {}, "https://example.test/", "//example.test", "/\\example.test", "/%2fexample.test", "/profile/login", "/profile/confirm", "/studio", "/design-system", "/profile/../studio", "/product/foo/../bar"]) {
    assert.equal(authDestination(path), "/profile");
  }
});

test("email callbacks use configured deployment or exact loopback origin", () => {
  assert.equal(authMailOrigin("https://roomlet.test", "unknown.test"), "https://roomlet.test");
  assert.equal(authMailOrigin(undefined, "localhost:3211"), "http://localhost:3211");
  assert.equal(authMailOrigin(undefined, "127.0.0.1:3000"), "http://127.0.0.1:3000");
  for (const host of ["other.test", "localhost.other.test", "localhost:3211@test", null]) assert.equal(authMailOrigin(undefined, host), null);
  for (const address of ["http://roomlet.test", "https://user@roomlet.test", "https://roomlet.test/path"]) assert.equal(authMailOrigin(address, null), null);
});
