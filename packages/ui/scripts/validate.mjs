/**
 * Pure validation for packages/ui/tokens/tokens.json (SUG-DES-005).
 *
 * No side effects, no file I/O — kept in its own module (rather than inline
 * in generate.mjs) so it can be imported by generate.test.mjs without
 * triggering generate.mjs's top-level codegen/write pass.
 *
 * validate(tokens) throws a single Error whose message lists every
 * violation, one per line, each prefixed with its JSON path
 * (e.g. "color.voile-2.value: ...") so a hand-edit mistake in the
 * hand-edited SSOT is actionable immediately, not three build steps later.
 */

const KNOWN_TOP_LEVEL = ["meta", "color", "typography", "spacing", "radius", "component", "motion"];
const HEX_RE = /^#[0-9a-f]{6}$/i;
const VALID_FAMILIES = new Set(["Space Grotesk", "Inter"]);
const VALID_WEIGHTS = new Set([400, 500, 600]);
const VALID_TRANSFORMS = new Set(["none", "uppercase"]);
const COMPONENT_REF_RE = /^(radius|color)\.[\w-]+$/;

function isPositiveNumber(v) {
  return typeof v === "number" && Number.isFinite(v) && v > 0;
}

export function validate(tokens) {
  const errors = [];
  const fail = (path, msg) => errors.push(`${path}: ${msg}`);

  // meta ----------------------------------------------------------------
  if (typeof tokens.meta !== "object" || tokens.meta === null) {
    fail("meta", "must be an object");
  } else {
    for (const field of ["name", "source", "rule", "lastUpdated"]) {
      if (typeof tokens.meta[field] !== "string" || tokens.meta[field].length === 0) {
        fail(`meta.${field}`, `must be a non-empty string, got ${JSON.stringify(tokens.meta[field])}`);
      }
    }
  }

  // top-level shape -------------------------------------------------------
  const known = new Set(KNOWN_TOP_LEVEL);
  for (const key of Object.keys(tokens)) {
    if (!known.has(key)) {
      fail(key, `unknown top-level key (expected one of: ${KNOWN_TOP_LEVEL.join(", ")})`);
    }
  }

  // color -----------------------------------------------------------------
  if (tokens.color) {
    for (const [key, c] of Object.entries(tokens.color)) {
      if (typeof c.value !== "string" || !HEX_RE.test(c.value)) {
        fail(`color.${key}.value`, `must be a 6-digit hex color (e.g. "#0f1426"), got ${JSON.stringify(c.value)}`);
      }
      if (c.opacity !== undefined) {
        if (typeof c.opacity !== "number" || !(c.opacity > 0 && c.opacity < 1)) {
          fail(`color.${key}.opacity`, `must be a number in (0, 1), got ${JSON.stringify(c.opacity)}`);
        }
      }
    }
  }

  // typography --------------------------------------------------------------
  if (tokens.typography) {
    for (const [key, t] of Object.entries(tokens.typography)) {
      if (!VALID_FAMILIES.has(t.family)) {
        fail(
          `typography.${key}.family`,
          `must be one of ${[...VALID_FAMILIES].join(" | ")} (charter rule: no new typefaces without an issue), got ${JSON.stringify(t.family)}`,
        );
      }
      if (!isPositiveNumber(t.size)) {
        fail(`typography.${key}.size`, `must be a positive number, got ${JSON.stringify(t.size)}`);
      }
      if (!VALID_WEIGHTS.has(t.weight)) {
        fail(`typography.${key}.weight`, `must be one of ${[...VALID_WEIGHTS].join(", ")}, got ${JSON.stringify(t.weight)}`);
      }
      if (!isPositiveNumber(t.lineHeight)) {
        fail(`typography.${key}.lineHeight`, `must be a positive number, got ${JSON.stringify(t.lineHeight)}`);
      }
      if (typeof t.letterSpacing !== "number" || !Number.isFinite(t.letterSpacing) || t.letterSpacing < 0) {
        fail(`typography.${key}.letterSpacing`, `must be a number >= 0, got ${JSON.stringify(t.letterSpacing)}`);
      }
      if (!VALID_TRANSFORMS.has(t.textTransform)) {
        fail(
          `typography.${key}.textTransform`,
          `must be one of ${[...VALID_TRANSFORMS].join(", ")}, got ${JSON.stringify(t.textTransform)}`,
        );
      }
    }
  }

  // spacing / radius --------------------------------------------------------
  for (const group of ["spacing", "radius"]) {
    if (!tokens[group]) continue;
    for (const [key, v] of Object.entries(tokens[group])) {
      if (!isPositiveNumber(v)) {
        fail(`${group}.${key}`, `must be a positive number, got ${JSON.stringify(v)}`);
      }
    }
  }

  // component ---------------------------------------------------------------
  if (tokens.component) {
    for (const [groupKey, group] of Object.entries(tokens.component)) {
      for (const [k, v] of Object.entries(group)) {
        const path = `component.${groupKey}.${k}`;
        if (k.endsWith("Token")) {
          if (typeof v !== "string" || !COMPONENT_REF_RE.test(v)) {
            fail(path, `must be a "radius.<key>" or "color.<key>" reference, got ${JSON.stringify(v)}`);
            continue;
          }
          const [category, refKey] = v.split(".");
          if (!tokens[category] || !(refKey in tokens[category])) {
            fail(path, `references unknown ${category} token "${refKey}"`);
          }
        } else if (typeof v === "number") {
          if (!isPositiveNumber(v)) {
            fail(path, `must be a positive number, got ${JSON.stringify(v)}`);
          }
        } else if (typeof v !== "string") {
          fail(path, `must be a positive number or string, got ${JSON.stringify(v)}`);
        }
      }
    }
  }

  // motion (SUG-DES-007 extends this allowlist once landed) -----------------
  if (tokens.motion) {
    for (const [key, m] of Object.entries(tokens.motion)) {
      if (typeof m === "object" && m !== null) {
        for (const [field, v] of Object.entries(m)) {
          const path = `motion.${key}.${field}`;
          if (typeof v === "number") {
            if (!Number.isFinite(v) || v <= 0) {
              fail(path, `must be a positive number, got ${JSON.stringify(v)}`);
            }
          } else if (typeof v !== "string" || v.length === 0) {
            fail(path, `must be a positive number or non-empty string, got ${JSON.stringify(v)}`);
          }
        }
      } else if (typeof m === "number") {
        if (!Number.isFinite(m) || m <= 0) {
          fail(`motion.${key}`, `must be a positive number, got ${JSON.stringify(m)}`);
        }
      } else if (typeof m !== "string" || m.length === 0) {
        fail(`motion.${key}`, `must be a positive number, non-empty string, or object, got ${JSON.stringify(m)}`);
      }
    }
  }

  if (errors.length > 0) {
    throw new Error(errors.join("\n"));
  }
}
