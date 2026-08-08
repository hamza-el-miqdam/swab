// Self-test for the tokens.json validator (SUG-DES-005). No framework —
// node:test + node:assert, run via `pnpm --filter @repo/ui test`
// (packages/ui/package.json's "test" script chains this before the
// generator's own --check drift guard).
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate } from "./validate.mjs";

function validTokens() {
  return {
    meta: {
      name: "Swab Design Tokens — Nuit",
      source: "test fixture",
      rule: "Do NOT hand-invent values here.",
      lastUpdated: "2026-01-01",
    },
    color: {
      nuit: { value: "#0f1426", role: "App background." },
      hair: { value: "#edebe2", opacity: 0.12, role: "Hairline separators." },
    },
    typography: {
      base: { family: "Inter", size: 15, weight: 400, lineHeight: 1.6, letterSpacing: 0, textTransform: "none" },
    },
    spacing: { xs: 4, s: 8 },
    radius: { button: 12 },
    component: {
      button: { height: 48, radiusToken: "radius.button", paddingHorizontal: 14 },
    },
  };
}

test("accepts a well-formed token set", () => {
  assert.doesNotThrow(() => validate(validTokens()));
});

test("rejects a malformed hex color", () => {
  const t = validTokens();
  t.color.nuit.value = "#0f142"; // 5 digits, missing one
  assert.throws(() => validate(t), /color\.nuit\.value/);
});

test("rejects a dangling component token reference", () => {
  const t = validTokens();
  t.component.button.radiusToken = "radius.buton"; // typo, no such radius key
  assert.throws(() => validate(t), /component\.button\.radiusToken/);
});

test("rejects opacity out of the (0, 1) range", () => {
  const t = validTokens();
  t.color.hair.opacity = 12;
  assert.throws(() => validate(t), /color\.hair\.opacity/);
});

test("rejects a missing typography size", () => {
  const t = validTokens();
  delete t.typography.base.size;
  assert.throws(() => validate(t), /typography\.base\.size/);
});

test("rejects an unknown top-level key", () => {
  const t = validTokens();
  t.extra = {};
  assert.throws(() => validate(t), /extra/);
});

test("rejects a non-allowlisted typography family", () => {
  const t = validTokens();
  t.typography.base.family = "Comic Sans";
  assert.throws(() => validate(t), /typography\.base\.family/);
});

test("rejects a negative spacing value", () => {
  const t = validTokens();
  t.spacing.xs = -4;
  assert.throws(() => validate(t), /spacing\.xs/);
});

test("rejects an invalid textTransform", () => {
  const t = validTokens();
  t.typography.base.textTransform = "lowercase";
  assert.throws(() => validate(t), /typography\.base\.textTransform/);
});
