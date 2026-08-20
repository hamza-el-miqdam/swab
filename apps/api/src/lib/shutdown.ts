// SUG-API-014: shutdown used to be inline in server.ts, which vitest.config.ts
// excludes from coverage as boot wiring (`src/server.ts` in the `exclude` list)
// — extracted here so the actual close/timeout/exit-code logic is unit-testable.
// `exit` is injected rather than calling `process.exit` directly: real callers
// pass `process.exit`, tests pass a spy.

export interface ShutdownLogger {
  info: (obj: Record<string, unknown>, msg: string) => void;
  warn: (msg: string) => void;
  error: (obj: Record<string, unknown>, msg: string) => void;
}

export interface ShutdownApp {
  log: ShutdownLogger;
  close: () => Promise<void>;
}

const DEFAULT_TIMEOUT_MS = 8_000; // stays under Docker's default 10s SIGKILL grace

/**
 * Builds a signal handler that closes `app` with a deadline, exits 0/1
 * accordingly, and ignores a second signal while a close is already in
 * flight (SIGINT/SIGTERM can both arrive, or the same signal twice).
 */
export function createShutdown(
  app: ShutdownApp,
  exit: (code: number) => void,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): (signal: string) => void {
  let shuttingDown = false;

  return (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;

    app.log.info({ signal }, "shutting down");

    const deadline = setTimeout(() => {
      app.log.warn("close deadline exceeded, forcing exit");
      exit(1);
    }, timeoutMs);
    deadline.unref(); // never keeps the process alive on the happy path

    app.close().then(
      () => {
        clearTimeout(deadline);
        exit(0);
      },
      (err: unknown) => {
        clearTimeout(deadline);
        app.log.error(
          { err: { message: err instanceof Error ? err.message : String(err) } },
          "close failed",
        );
        exit(1);
      },
    );
  };
}
