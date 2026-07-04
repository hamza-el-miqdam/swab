import type { FastifyReply } from "fastify";
import type { ZodError } from "zod";

/**
 * RFC 7807 problem-details responses everywhere (backend best practices).
 * `requestId` is included as an extension member for log correlation (G3).
 * Details must never echo request values — field paths and messages only.
 */
export function sendProblem(
  reply: FastifyReply,
  status: number,
  title: string,
  detail?: string,
  extras?: Record<string, unknown>,
): FastifyReply {
  return reply
    .code(status)
    .type("application/problem+json")
    .send({
      type: "about:blank",
      title,
      status,
      requestId: reply.request.id,
      ...(detail !== undefined ? { detail } : {}),
      ...extras,
    });
}

/** Zod issues → safe detail string (paths + generic messages, never input values). */
export function zodDetail(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "body"}: ${issue.message}`)
    .join("; ");
}
