import { dbHealth } from "@repo/db";
import { buildApp } from "./app.js";
import { loadEnv } from "./env.js";
import { prismaRepository } from "./prisma-repo.js";

async function main(): Promise<void> {
  const env = loadEnv(); // fail fast (G1)
  const app = await buildApp({ env, repo: prismaRepository(), dbHealth });

  const shutdown = (signal: string): void => {
    app.log.info({ signal }, "shutting down");
    void app.close().then(() => process.exit(0));
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));

  await app.listen({ port: env.PORT, host: "0.0.0.0" });
}

main().catch((err: unknown) => {
  // Boot failure happens before the logger exists; message only, never env values.
  process.stderr.write(`fatal: ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
