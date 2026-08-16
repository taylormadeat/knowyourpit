/**
 * Verifies that withCatalogAddTimeout:
 *  - resolves normally when the request completes within the window
 *  - rejects with a timeout message when the request hangs past timeoutMs
 *  - calls onSettle() in both cases so callers can reset loading state
 *  - signals the AbortController on timeout
 */

import { withCatalogAddTimeout } from "../catalogAddTimeout";

jest.useFakeTimers();

describe("withCatalogAddTimeout", () => {
  it("resolves with the request value when it completes in time", async () => {
    const settle = jest.fn();
    const req = jest.fn((_signal: AbortSignal) => Promise.resolve("ok"));

    const promise = withCatalogAddTimeout(req, 15_000, settle);
    await expect(promise).resolves.toBe("ok");
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it("rejects with a timeout error and calls onSettle when the request hangs", async () => {
    const settle = jest.fn();
    // A request that never resolves (simulates a hung network call)
    const req = jest.fn((_signal: AbortSignal) => new Promise<never>(() => {}));

    const promise = withCatalogAddTimeout(req, 15_000, settle);

    // Advance fake timers past the timeout
    jest.advanceTimersByTime(15_001);

    await expect(promise).rejects.toThrow("Request timed out. Please try again.");
    expect(settle).toHaveBeenCalledTimes(1);
  });

  it("aborts the controller when the timeout fires", async () => {
    let capturedSignal: AbortSignal | undefined;
    const req = jest.fn((signal: AbortSignal) => {
      capturedSignal = signal;
      return new Promise<never>(() => {});
    });

    const promise = withCatalogAddTimeout(req, 15_000);
    jest.advanceTimersByTime(15_001);
    await promise.catch(() => {});

    expect(capturedSignal?.aborted).toBe(true);
  });

  it("does not fire the timeout when the request resolves early", async () => {
    const settle = jest.fn();
    const req = jest.fn((_signal: AbortSignal) => Promise.resolve("fast"));

    const promise = withCatalogAddTimeout(req, 15_000, settle);
    await promise;

    // Advance well past timeout — settle should still only be called once
    jest.advanceTimersByTime(30_000);
    expect(settle).toHaveBeenCalledTimes(1);
  });
});
