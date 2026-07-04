import type { FastifyInstance } from "fastify";
import type { DbHealthCheck } from "../repo.js";
import { sendProblem } from "../lib/problem.js";

export function registerHealthRoutes(app: FastifyInstance, deps: { dbHealth: DbHealthCheck }): void {
  // Liveness — no dependencies, by contract (G3).
  app.get("/health", async () => ({ status: "ok" }));

  // Readiness — checks DB connectivity via @repo/db dbHealth() (G3 / DAT rule 7).
  app.get("/ready", async (req, reply) => {
    try {
      const db = await deps.dbHealth();
      if (!db.ok) return sendProblem(reply, 503, "Not ready", "Database unreachable.");
      return reply.code(200).send({ status: "ready", db: { latencyMs: db.latencyMs } });
    } catch {
      return sendProblem(reply, 503, "Not ready", "Database unreachable.");
    }
  });
}
