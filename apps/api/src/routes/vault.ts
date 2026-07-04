import type { FastifyInstance } from "fastify";
import { z } from "zod";
import type { Env } from "../env.js";
import type { Repository } from "../repo.js";
import { requireAuth } from "../lib/auth.js";
import { sendProblem, zodDetail } from "../lib/problem.js";

/**
 * VLT-02/VLT-03: the server is dumb storage. The blob is opaque bytes moved as
 * base64 — this module must never decode, parse, log, or index its CONTENT.
 * The only permitted inspection is byte length, for the quota.
 */
const MAX_VAULT_BYTES = 1_048_576; // 1 MB per user (free-tier budget, VLT-03)

const BASE64_RE = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/;

const vaultWriteSchema = z.object({
  blob: z.string().min(1).regex(BASE64_RE, "must be valid base64"),
  version: z.number().int().min(0), // version the client's copy is based on; 0 = first write
});

export interface VaultRouteDeps {
  env: Env;
  repo: Repository;
}

export function registerVaultRoutes(app: FastifyInstance, deps: VaultRouteDeps): void {
  const auth = requireAuth(deps.env);

  app.get("/vault", { preHandler: auth }, async (req, reply) => {
    const userId = req.userId;
    if (userId === undefined) return sendProblem(reply, 401, "Unauthorized");

    const vault = await deps.repo.getVault(userId);
    if (vault === null) {
      return sendProblem(reply, 404, "Vault not found", "No vault has been synced yet.");
    }
    // G3/VLT-03: byte length only — contents never touch the logs.
    req.log.info({ userId, version: vault.version, bytes: vault.blob.byteLength }, "vault read");
    return reply.code(200).send({
      blob: vault.blob.toString("base64"),
      version: vault.version,
      updatedAt: vault.updatedAt.toISOString(),
    });
  });

  app.post("/vault", { preHandler: auth }, async (req, reply) => {
    const userId = req.userId;
    if (userId === undefined) return sendProblem(reply, 401, "Unauthorized");

    const parsed = vaultWriteSchema.safeParse(req.body);
    if (!parsed.success) {
      return sendProblem(reply, 400, "Invalid request body", zodDetail(parsed.error));
    }
    // base64 → bytes is transport decoding only; the bytes are never interpreted.
    const bytes = Buffer.from(parsed.data.blob, "base64");
    if (bytes.byteLength > MAX_VAULT_BYTES) {
      return sendProblem(reply, 413, "Vault blob too large", `Quota is ${MAX_VAULT_BYTES} bytes.`);
    }

    const result = await deps.repo.upsertVault(userId, bytes, parsed.data.version);
    if (!result.ok) {
      // VLT-02: stale base version — client re-pulls, merges locally, retries.
      return sendProblem(reply, 409, "Stale vault version", "Re-pull, merge locally, retry.", {
        currentVersion: result.currentVersion,
      });
    }
    req.log.info({ userId, version: result.version, bytes: bytes.byteLength }, "vault written");
    return reply.code(200).send({ version: result.version });
  });
}
