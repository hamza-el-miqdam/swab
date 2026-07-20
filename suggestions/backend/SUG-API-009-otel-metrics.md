# SUG-API-009 — G3 metrics are absent: no OpenTelemetry histograms for request or DB durations

- **Area:** backend
- **Topic:** observability
- **Impact:** medium
- **Effort:** M
- **Implementing agent:** backend-specialist (.claude/agents/backend-specialist.md)
- **Related requirement IDs:** n/a (G3, backend rule 8)

## Problem / Opportunity

G3 requires "request duration, DB query duration, and match-computation duration as histograms (OpenTelemetry API, console/OTLP exporter — vendor-neutral)". Backend rule 8 repeats it. The API has none of it:

- `apps/api/package.json:15-21` — dependencies are fastify, rate-limit, pino, zod, @repo/db; no `@opentelemetry/*` anywhere.
- `apps/api/src/app.ts` — no timing hooks; the only latency measured in the codebase is the `/ready` probe's ad-hoc `performance.now()` in `packages/db/src/index.ts:20-26`, which is returned in the response, not recorded as a metric.

Without request-duration histograms there is no p95 baseline before the FS-05 matching hot path lands with its "p95 < 150ms" target (backend agent file, Domain Best Practices) — the target will be unmeasurable on day one.

## Implementation plan

1. Add deps to `/Users/mikedown/Workspace/Swab/apps/api/package.json` (justify per G4): `@opentelemetry/api`, `@opentelemetry/sdk-metrics` (+ `@opentelemetry/exporter-metrics-otlp-http` optional; start with the SDK's `ConsoleMetricExporter` / `PeriodicExportingMetricReader` — vendor-neutral, no collector needed for POC).
2. New file `apps/api/src/lib/metrics.ts`:
   ```ts
   import { metrics, type Histogram } from "@opentelemetry/api";
   export interface ApiMetrics { requestDuration: Histogram; dbHealthDuration: Histogram; }
   export function createMetrics(): ApiMetrics {
     const meter = metrics.getMeter("swab-api");
     return {
       requestDuration: meter.createHistogram("http.server.request.duration", { unit: "ms" }),
       dbHealthDuration: meter.createHistogram("db.health.duration", { unit: "ms" }),
     };
   }
   ```
   (Using the global `metrics` API means tests run with the no-op MeterProvider — zero overhead, no wiring needed.)
3. In `/Users/mikedown/Workspace/Swab/apps/api/src/app.ts`, record per-request timing with hooks (after the rate-limit registration, before routes):
   ```ts
   const m = createMetrics();
   app.addHook("onRequest", async (req) => { (req as FastifyRequest & { startTime?: bigint }).startTime = process.hrtime.bigint(); });
   app.addHook("onResponse", async (req, reply) => {
     const start = (req as FastifyRequest & { startTime?: bigint }).startTime;
     if (start === undefined) return;
     m.requestDuration.record(Number(process.hrtime.bigint() - start) / 1e6, {
       "http.route": req.routeOptions.url ?? "unmatched",
       "http.request.method": req.method,
       "http.response.status_code": reply.statusCode,
     });
   });
   ```
   Attribute cardinality note: use `routeOptions.url` (the route PATTERN, e.g. `/vault`), never `req.url` — raw URLs are unbounded-cardinality and could carry user data.
4. Record the `/ready` DB latency: in `apps/api/src/routes/health.ts:12-14`, after `deps.dbHealth()`, `m.dbHealthDuration.record(db.latencyMs)` (pass `ApiMetrics` through the route deps).
5. In `/Users/mikedown/Workspace/Swab/apps/api/src/server.ts` `main()`, install the real provider before `buildApp`: `MeterProvider` with a `PeriodicExportingMetricReader` (console exporter by default; OTLP endpoint from an optional validated `OTEL_EXPORTER_OTLP_ENDPOINT` env in `env.ts`). Keeping provider setup in server.ts (not app.ts) keeps tests no-op.
6. When FS-05 lands, the match-computation histogram slots into the same `metrics.ts` — note this in the file header so the FS-05 implementer finds it.
7. Changelog entry (G5).

## Tests & acceptance criteria

- New `apps/api/tests/metrics.test.ts` (run: `pnpm --filter @repo/api test`): install an in-memory `MeterProvider` (`@opentelemetry/sdk-metrics` `InMemoryMetricExporter` + `PeriodicExportingMetricReader` or `metricReader.collect()`) as the global provider, `makeApp()`, inject `GET /health` and `GET /vault` (401), collect, and assert:
  - `"G3: every request records http.server.request.duration with route-pattern attributes"` — data points exist with `http.route` `/health` and `/vault`, correct `status_code` attrs;
  - `"G3: metric attributes never contain raw URLs or user data"` — assert attribute keys are exactly the three declared ones.
- Existing tests unaffected (no-op provider path).

## Risks & gotchas

- The global OTel meter provider is process-wide — reset it (`metrics.disable()`) in test teardown or subsequent suites see the test provider.
- Never put `userId`, `phoneHash`, or request bodies in metric attributes (G3 — same rules as logs; IDs are allowed in logs but are cardinality poison in metrics).
- `onResponse` hooks run for 404s too — `routeOptions.url` is undefined there; the `"unmatched"` fallback keeps cardinality bounded.
- Console exporter output is noisy in `docker compose` dev — consider gating the reader on an env flag (`METRICS_EXPORTER=console|otlp|none`, validated in `env.ts`).
