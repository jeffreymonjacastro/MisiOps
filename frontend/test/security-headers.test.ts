import { test } from "node:test";
import assert from "node:assert/strict";

import nextConfig from "../next.config.ts";

// Headers flagged as missing by the ZAP baseline scan (specs/011-devsecops, FR-014).
async function headersFor(path: string) {
  const rules = (await nextConfig.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === "/:path*");
  assert.ok(rule, `no header rule covers ${path}`);
  return Object.fromEntries(rule.headers.map((h) => [h.key, h.value]));
}

test("every page sends the hardening headers", async () => {
  const h = await headersFor("/");
  assert.equal(h["X-Content-Type-Options"], "nosniff");
  assert.equal(h["X-Frame-Options"], "DENY");
  assert.equal(h["Referrer-Policy"], "no-referrer");
  assert.equal(h["Cross-Origin-Opener-Policy"], "same-origin");
  assert.equal(h["Cross-Origin-Resource-Policy"], "same-origin");
  assert.match(h["Permissions-Policy"], /camera=\(\)/);
});

test("the CSP forbids framing and foreign scripts but allows the API", async () => {
  const csp = (await headersFor("/"))["Content-Security-Policy"];
  assert.match(csp, /default-src 'self'/);
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
  assert.match(csp, /connect-src 'self' http:\/\/localhost:8000/);
  assert.doesNotMatch(csp, /script-src[^;]*\*/);
});

test("the X-Powered-By header is disabled", () => {
  assert.equal(nextConfig.poweredByHeader, false);
});
