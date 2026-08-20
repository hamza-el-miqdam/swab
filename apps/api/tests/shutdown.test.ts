import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createShutdown, type ShutdownApp } from "../src/lib/shutdown.js";

function makeApp(close: ShutdownApp["close"]): ShutdownApp {
  return {
    log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
    close,
  };
}

describe("createShutdown", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("exits 0 when close resolves", async () => {
    const close = vi.fn(() => Promise.resolve());
    const app = makeApp(close);
    const exit = vi.fn();

    createShutdown(app, exit)("SIGTERM");
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(close).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledWith(0);
  });

  it("exits 1 when close rejects", async () => {
    const close = vi.fn(() => Promise.reject(new Error("boom")));
    const app = makeApp(close);
    const exit = vi.fn();

    createShutdown(app, exit)("SIGINT");
    await vi.waitFor(() => expect(exit).toHaveBeenCalled());

    expect(exit).toHaveBeenCalledWith(1);
    expect(app.log.error).toHaveBeenCalledWith(
      { err: { message: "boom" } },
      "close failed",
    );
  });

  it("force-exits 1 when close exceeds the deadline", async () => {
    const close = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const app = makeApp(close);
    const exit = vi.fn();

    createShutdown(app, exit, 8_000)("SIGTERM");
    expect(exit).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(8_000);

    expect(exit).toHaveBeenCalledWith(1);
    expect(app.log.warn).toHaveBeenCalledWith("close deadline exceeded, forcing exit");
  });

  it("a second signal is a no-op while a close is already in flight", async () => {
    const close = vi.fn(() => new Promise<void>(() => {})); // never resolves
    const app = makeApp(close);
    const exit = vi.fn();

    const shutdown = createShutdown(app, exit);
    shutdown("SIGTERM");
    shutdown("SIGTERM");
    shutdown("SIGINT");

    expect(close).toHaveBeenCalledTimes(1);
  });
});
