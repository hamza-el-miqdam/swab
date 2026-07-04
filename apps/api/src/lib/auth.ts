import type { FastifyReply, FastifyRequest } from "fastify";
import type { Env } from "../env.js";
import { verifyJwt } from "./jwt.js";
import { sendProblem } from "./problem.js";

declare module "fastify" {
  interface FastifyRequest {
    userId?: string;
  }
}

/** preHandler guard: requires a valid, unexpired Bearer *access* token (IDT-02). */
export function requireAuth(env: Env) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") === true ? header.slice("Bearer ".length) : null;
    const payload = token !== null ? verifyJwt(token, env.JWT_SECRET) : null;
    if (payload === null || payload.type !== "access") {
      sendProblem(reply, 401, "Unauthorized", "A valid Bearer access token is required.");
      return;
    }
    req.userId = payload.sub;
  };
}
