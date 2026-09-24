import type { DeepPartial, Tuning } from '../data/tuning';

type Plain = Record<string, unknown>;

function isPlain(v: unknown): v is Plain {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function mergeInto(base: Plain, over: Plain): Plain {
  const out: Plain = {};
  for (const [key, value] of Object.entries(base)) {
    out[key] = isPlain(value) ? mergeInto(value, {}) : value;
  }
  for (const [key, value] of Object.entries(over)) {
    if (value === undefined) continue;
    const current = out[key];
    out[key] = isPlain(value) && isPlain(current) ? mergeInto(current, value) : value;
  }
  return out;
}

/** Copie profonde de `base` avec les surcharges appliquées (base jamais modifiée). */
export function mergeTuning(base: Tuning, overrides?: DeepPartial<Tuning>): Tuning {
  return mergeInto(base, overrides ?? {}) as unknown as Tuning;
}
