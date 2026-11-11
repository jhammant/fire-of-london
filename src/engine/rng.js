// Seeded mulberry32 generator. Its whole state is one uint32 kept in state.rngState.

/** Turns any finite number into a uint32 seed; throws on anything else. */
export function normaliseSeed(seed) {
  const n = Number(seed);
  if (!Number.isFinite(n)) throw new Error(`Seed must be a finite number, got ${String(seed)}.`);
  return Math.trunc(n) >>> 0;
}

/** Creates a random source starting from a uint32 state; next() gives a number in [0, 1). */
export function createRng(rngState) {
  let s = rngState >>> 0;
  return {
    next() {
      s = (s + 0x6d2b79f5) >>> 0;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
    state() {
      return s;
    }
  };
}
