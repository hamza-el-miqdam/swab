import { z } from "zod";

/**
 * Field schemas shared by more than one route (G1 — one definition, so a
 * hardening fix cannot land on half the surface). Route-specific shapes stay
 * in their own route file.
 */

/** Client-side salted hash of the E.164 number (IDT-01). The raw number must never reach the API. */
export const phoneHashSchema = z
  .string()
  .min(32)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "must be a hash, not a phone number");

/**
 * Printable content only: no control (Cc) or format (Cf — includes bidi
 * overrides like U+202E) characters. Letters, marks, numbers, punctuation,
 * symbols, and plain spaces are all fine (emoji included). The ZWJ (U+200D)
 * and variation-selector-16 (U+FE0F) allowance is required for composite
 * emoji sequences (e.g. family/skin-tone emoji), which \p{Cf} would
 * otherwise reject (SUG-API-015, IDT-01/IDT-09).
 */
export const displayNameSchema = z
  .string()
  .trim()
  .min(1)
  .max(50)
  .regex(/^(?:[^\p{Cc}\p{Cf}]|‍|️)+$/u, "contains unsupported characters");

/**
 * Server-generated row ids (cuid) as they come back from a client. Bounded and
 * charset-restricted so a path parameter can never be a probe payload.
 */
export const rowIdSchema = z.string().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/, "invalid id");
