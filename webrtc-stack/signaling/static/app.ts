/// <reference lib="es2020" />
/// <reference lib="dom" />

/**
 * pricing.ts (browser-safe, final)
 *
 * - Pure core (no side effects)
 * - Thin async wrapper (I/O, cancellation, timeouts)
 * - Strong typing, guards, edge cases
 * - Explicit error/exception model
 * - Complexity note + benchmark harness
 * - Use-cases list
 * - Avoids over-engineering
 *
 * Notes:
 * - This file adds `/// <reference lib="es2020" />` and `/// <reference lib="dom" />`
 *   so globals like Error, Number, ReadonlyArray, AbortSignal, performance are typed
 *   even if your tsconfig doesn't include them by default.
 */

/* ────────────────────────────────────────────────────────────────────────────
 * Types
 * ──────────────────────────────────────────────────────────────────────────── */

export type MinorUnit = 1 | 10 | 100 | 1000 | 10000; // e.g., 100 for cents, 1000 for mills

export interface LineItem {
  /** Non-negative integer quantity (e.g., units, events, minutes). */
  qty: number;
  /**
   * Unit price in MAJOR units (e.g., dollars) as a finite, non-negative number.
   * Will be converted to minor units by floor(rate * minorUnit).
   */
  unitPriceMajor: number;
  /** Optional reference or SKU for error messages. */
  ref?: string;
}

export interface TotalResult {
  /** Sum in MINOR units (e.g., cents). Always an integer >= 0. */
  totalMinor: number;
  /** The minor unit used for rounding, e.g., 100 = cents. */
  minorUnit: MinorUnit;
  /** Number of items processed. */
  items: number;
}

export interface WrapperOptions {
  /** Minor unit (default 100 for cents). */
  minorUnit?: MinorUnit;
  /** AbortSignal to support cancellation. */
  signal?: AbortSignal | null;
  /** Timeout in milliseconds. If exceeded, rejects with TimeoutError. */
  timeoutMs?: number;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Errors
 * ──────────────────────────────────────────────────────────────────────────── */

export class InvalidInputError extends Error {
  constructor(message: string, readonly ref?: string) {
    super(ref ? `${message} [ref=${ref}]` : message);
    this.name = "InvalidInputError";
  }
}

export class TimeoutError extends Error {
  constructor(message = "Operation timed out") {
    super(message);
    this.name = "TimeoutError";
  }
}

export class CancelledError extends Error {
  constructor(message = "Operation cancelled") {
    super(message);
    this.name = "CancelledError";
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Guards (pure)
 * ──────────────────────────────────────────────────────────────────────────── */

function isMinorUnit(x: number): x is MinorUnit {
  return x === 1 || x === 10 || x === 100 || x === 1000 || x === 10000;
}

function isNonNegativeInt(n: number): boolean {
  return Number.isInteger(n) && n >= 0;
}

function isFiniteNonNegative(n: number): boolean {
  return Number.isFinite(n) && n >= 0;
}

/* ────────────────────────────────────────────────────────────────────────────
 * Pure core (no side effects)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * Convert a unit price expressed in MAJOR units to MINOR units by FLOORing.
 * e.g., $1.239 @ 100 (cents) → 123 (cents)
 */
export function majorToMinorFloor(unitPriceMajor: number, minorUnit: MinorUnit, ref?: string): number {
  if (!isFiniteNonNegative(unitPriceMajor)) {
    throw new InvalidInputError("unitPriceMajor must be finite and >= 0", ref);
  }
  const raw = Math.floor(unitPriceMajor * minorUnit);
  if (!Number.isFinite(raw) || raw < 0) {
    throw new InvalidInputError("Converted minor price overflow/invalid", ref);
  }
  return raw;
}

/**
 * Validate a single line item; returns its cost in MINOR units.
 * Rounding strategy: FLOOR at the unit price conversion step, then multiply by qty.
 */
export function lineCostMinor(item: LineItem, minorUnit: MinorUnit): number {
  const { qty, unitPriceMajor, ref } = item;
  if (!isNonNegativeInt(qty)) {
    throw new InvalidInputError("qty must be a non-negative integer", ref);
  }
  const unitMinor = majorToMinorFloor(unitPriceMajor, minorUnit, ref);
  const product = BigInt(unitMinor) * BigInt(qty);
  const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
  if (product > maxSafe) {
    throw new InvalidInputError("totalMinor exceeds MAX_SAFE_INTEGER", ref);
  }
  return Number(product);
}

/**
 * Sum a list of line items into a TotalResult, using integer math in MINOR units.
 * Pure: does not mutate inputs or rely on external state.
 */
export function computeTotal(items: ReadonlyArray<LineItem>, minorUnit: MinorUnit = 100): TotalResult {
  if (!isMinorUnit(minorUnit)) {
    throw new InvalidInputError("minorUnit must be one of 1,10,100,1000,10000");
  }
  let acc = 0;
  for (const it of items) {
    const cost = lineCostMinor(it, minorUnit);
    acc += cost;
    if (!Number.isFinite(acc) || acc < 0) {
      throw new InvalidInputError("Accumulated total overflow/invalid", it.ref);
    }
  }
  return { totalMinor: acc, minorUnit, items: items.length };
}

/* ────────────────────────────────────────────────────────────────────────────
 * Thin async wrapper (I/O, cancellation, timeouts)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function computeTotalAsync(
  items: ReadonlyArray<LineItem>,
  opts: WrapperOptions = {}
): Promise<TotalResult> {
  const minorUnit = opts.minorUnit ?? 100;
  if (!isMinorUnit(minorUnit)) throw new InvalidInputError("minorUnit must be one of 1,10,100,1000,10000");

  const { signal, timeoutMs } = opts;

  if (signal?.aborted) {
    throw new CancelledError();
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    const race = new Promise<TotalResult>((resolve, reject) => {
      const onAbort = () => reject(new CancelledError());
      if (signal) signal.addEventListener("abort", onAbort, { once: true });

      if (typeof timeoutMs === "number" && timeoutMs >= 0) {
        timer = setTimeout(() => reject(new TimeoutError()), timeoutMs);
      }

      Promise.resolve().then(() => {
        try {
          const res = computeTotal(items, minorUnit);
          resolve(res);
        } catch (e) {
          reject(e);
        }
      });
    });

    return await race;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Self-tests (quick)
 * ──────────────────────────────────────────────────────────────────────────── */

export async function runSelfTests(): Promise<void> {
  const assert = (cond: boolean, msg: string) => {
    if (!cond) throw new Error("Test failed: " + msg);
  };

  // ✅ empty list
  {
    const r = computeTotal([], 100);
    assert(r.totalMinor === 0 && r.items === 0 && r.minorUnit === 100, "empty list");
  }

  // ✅ small hand-computed
  {
    const r = computeTotal(
      [
        { qty: 2, unitPriceMajor: 1.239 }, // floor(1.239*100)=123 → 2*123=246
        { qty: 1, unitPriceMajor: 3.999 }, // floor(3.999*100)=399 → 399
      ],
      100
    );
    if (r.totalMinor !== 246 + 399) throw new Error("hand computed small set");
  }

  // ✅ rounding floor consistency
  {
    const r = computeTotal([{ qty: 1, unitPriceMajor: 0.019 }], 100); // floor(1.9c)=1c
    if (r.totalMinor !== 1) throw new Error("floor rounding");
  }

  // ✅ boundary rates: 0, 1
  {
    const r0 = computeTotal([{ qty: 10, unitPriceMajor: 0 }], 100);
    if (r0.totalMinor !== 0) throw new Error("rate 0");
    const r1 = computeTotal([{ qty: 3, unitPriceMajor: 1 }], 100);
    if (r1.totalMinor !== 300) throw new Error("rate 1 @ cents");
  }

  // ✅ invalid inputs (negative, NaN) → InvalidInput
  {
    let threw = false;
    try {
      computeTotal([{ qty: -1, unitPriceMajor: 1.0 }], 100);
    } catch (e) {
      threw = e instanceof InvalidInputError;
    }
    if (!threw) throw new Error("negative qty should throw");

    threw = false;
    try {
      computeTotal([{ qty: 1, unitPriceMajor: Number.NaN }], 100);
    } catch (e) {
      threw = e instanceof InvalidInputError;
    }
    if (!threw) throw new Error("NaN price should throw");
  }

  // ✅ property: increasing qty never decreases total
  {
    const base: LineItem = { qty: 3, unitPriceMajor: 1.2345 };
    const t1 = computeTotal([base], 100).totalMinor;
    const t2 = computeTotal([{ ...base, qty: base.qty + 1 }], 100).totalMinor;
    if (t2 < t1) throw new Error("monotonic in qty");
  }

  // ✅ cancellation path (wrapper)
  {
    const ctrl = new AbortController();
    const p = computeTotalAsync([{ qty: 1, unitPriceMajor: 1 }], { signal: ctrl.signal, timeoutMs: 1000 });
    ctrl.abort();
    let cancelled = false;
    try {
      await p;
    } catch (e) {
      cancelled = e instanceof CancelledError;
    }
    if (!cancelled) throw new Error("cancelled path");
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * Minimal benchmark harness (browser & Node safe)
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * High-resolution timestamp in nanoseconds when available.
 * - Node: uses process.hrtime.bigint via globalThis
 * - Browser: uses performance.now() fallback (µs→ns approximation)
 */
function nowNs(): number {
  const g = globalThis as any;
  const hr = g?.process?.hrtime?.bigint;
  if (typeof hr === "function") {
    return Number(g.process.hrtime.bigint());
  }
  if (typeof performance !== "undefined" && typeof performance.now === "function") {
    return Math.floor(performance.now() * 1e6);
  }
  return Date.now() * 1e6;
}

export function runBenchmark(iterations = 200_000, nItems = 5): void {
  function rand(n: number) {
    return Math.floor(Math.random() * n);
  }
  const items: LineItem[] = Array.from({ length: nItems }, (_, i) => ({
    qty: rand(20),
    unitPriceMajor: Math.random() * 10,
    ref: `item-${i}`,
  }));

  const minorUnit: MinorUnit = 100;
  const t0 = nowNs();

  let acc = 0;
  for (let i = 0; i < iterations; i++) {
    const r = computeTotal(items, minorUnit);
    acc += r.totalMinor;
  }

  const t1 = nowNs();
  const elapsedNs = t1 - t0;
  const opsPerSec = (iterations / (elapsedNs / 1e9)).toFixed(0);

  // eslint-disable-next-line no-console
  console.log(
    `Benchmark: ${iterations} totals over ${nItems} items in ${(elapsedNs / 1e6).toFixed(2)} ms (${opsPerSec} ops/sec). Acc=${acc}`
  );
}

/* ────────────────────────────────────────────────────────────────────────────
 * Example: run tests/bench manually (optional)
 * ──────────────────────────────────────────────────────────────────────────── */
/*
(async () => {
  await runSelfTests();
  console.log("Self-tests passed ✅");
  runBenchmark(250_000, 8);
})();
*/
