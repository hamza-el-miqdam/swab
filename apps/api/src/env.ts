import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z.string().min(1),
    JWT_SECRET: z.string().min(32),
    PORT: z.coerce.number().int().positive().default(3001),
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    // POC (OQ-IDT-1): echo the OTP code in the response. Fail-closed: off unless explicitly enabled.
    OTP_DEV_CODE: z.enum(["enabled", "disabled"]).default("disabled"),
    // Number of trusted reverse-proxy hops in front of the API (0 = directly
    // exposed). Fail-closed default: `X-Forwarded-For` is ignored (and thus
    // unspoofable) until an operator explicitly names how many hops to trust
    // (IDT-03 — per-IP throttling is meaningless without this behind an ALB).
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(10).default(0),
    // IDT-03's strict per-IP OTP throttle (10/min) trips constantly in local
    // dev and on-device/E2E runs (issue #128, PR #138) where many scripted
    // requests share one IP in a short window. "relaxed" lifts it to a
    // 100-per-20-minutes ceiling for exactly those environments. Fail-closed
    // like OTP_DEV_CODE: refused below if requested in production.
    OTP_RATE_LIMIT: z.enum(["strict", "relaxed"]).default("strict"),
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.OTP_DEV_CODE === "enabled"), {
    path: ["OTP_DEV_CODE"],
    message: "must not be enabled in production",
  })
  .refine((e) => !(e.NODE_ENV === "production" && e.OTP_RATE_LIMIT === "relaxed"), {
    path: ["OTP_RATE_LIMIT"],
    message: "must not be relaxed in production (IDT-03)",
  });

export type Env = z.infer<typeof envSchema>;

/**
 * Fail-fast env validation at boot (G1). On failure, the error names the
 * offending variables only — values are never included (secrets, G3).
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const offenders = [...new Set(parsed.error.issues.map((i) => i.path.join(".")))].join(", ");
    throw new Error(`Invalid environment configuration: ${offenders}`);
  }
  return parsed.data;
}
