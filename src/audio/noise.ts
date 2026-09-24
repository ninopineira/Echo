/**
 * Génération pure des échantillons de bruit et de la réponse impulsionnelle de réverbération.
 * Les tampons Web Audio sont remplis une seule fois au déblocage (sfx/buffers.ts), puis réutilisés.
 * Aucune dépendance Web Audio : testé en environnement node, avec un hasard injectable.
 */

export type Random = () => number;

/** Bruit blanc uniforme dans [−1, 1]. */
export function fillWhite(out: Float32Array, rand: Random): void {
  for (let i = 0; i < out.length; i++) out[i] = rand() * 2 - 1;
}

/** Bruit brun (intégrateur à fuite) : grave et doux. Non normalisé. */
export function fillBrown(out: Float32Array, rand: Random): void {
  let b = 0;
  for (let i = 0; i < out.length; i++) {
    b = (b + 0.02 * (rand() * 2 - 1)) / 1.02;
    out[i] = b;
  }
}

/** Ramène la crête à `peak`. */
export function normalizePeak(data: Float32Array, peak: number): void {
  let max = 0;
  for (const v of data) max = Math.max(max, Math.abs(v));
  if (max <= 0) return;
  const k = peak / max;
  for (let i = 0; i < data.length; i++) data[i] = data[i]! * k;
}

/**
 * Rend un tampon bouclable sans claquement : `raw` contient length + fade échantillons ;
 * les `fade` derniers sont fondus (puissance constante) dans les `fade` premiers.
 * Ainsi out[length − 1] = raw[length − 1] et out[0] = raw[length] : la jointure est continue.
 */
export function makeLoopable(
  raw: Float32Array,
  length: number,
  fade: number,
): Float32Array<ArrayBuffer> {
  const f = Math.max(0, Math.min(fade, raw.length - length, length));
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    if (i < f) {
      const t = (i / f) * (Math.PI / 2);
      out[i] = raw[i]! * Math.sin(t) + raw[length + i]! * Math.cos(t);
    } else {
      out[i] = raw[i]!;
    }
  }
  return out;
}

/**
 * Crépitement : micro-impulsions de bruit à intervalles aléatoires (loi exponentielle,
 * `rate` impulsions par seconde). Les impulsions sont le contenu voulu ; l'enveloppe de la voix
 * qui lit ce tampon démarre et s'arrête à zéro.
 */
export function fillCrackle(
  out: Float32Array,
  sampleRate: number,
  rate: number,
  rand: Random,
): void {
  out.fill(0);
  let i = 0;
  for (;;) {
    i += Math.max(1, Math.floor((-Math.log(1 - rand()) / rate) * sampleRate));
    if (i >= out.length) break;
    const len = Math.max(4, Math.floor(sampleRate * (0.0005 + rand() * 0.0015)));
    const amp = 0.3 + 0.7 * rand();
    for (let j = 0; j < len && i + j < out.length; j++) {
      const env = 1 - j / len;
      out[i + j] = out[i + j]! + amp * (rand() * 2 - 1) * env * env;
    }
  }
  normalizePeak(out, 0.95);
}

export interface ImpulseOptions {
  seconds: number;
  decayDb: number;
  preDelay: number;
  brightStart: number;
  brightEnd: number;
}

/**
 * Un canal de réponse impulsionnelle : bruit filtré par un pôle dont la brillance baisse avec
 * le temps, décroissance exponentielle jusqu'à −decayDb, pré-délai silencieux, attaque et fin
 * adoucies (4 ms et 50 ms) pour ne jamais claquer.
 */
export function fillImpulseResponse(
  out: Float32Array,
  sampleRate: number,
  opts: ImpulseOptions,
  rand: Random,
): void {
  const n = out.length;
  const pre = Math.min(n, Math.floor(opts.preDelay * sampleRate));
  const body = Math.max(1e-3, opts.seconds - opts.preDelay);
  const k = ((opts.decayDb / 20) * Math.LN10) / body;
  const tail = Math.floor(0.05 * sampleRate);
  let lp = 0;
  for (let i = 0; i < n; i++) {
    if (i < pre) {
      out[i] = 0;
      continue;
    }
    const t = (i - pre) / sampleRate;
    const x = Math.min(1, t / body);
    const coeff = opts.brightStart + (opts.brightEnd - opts.brightStart) * x;
    lp += coeff * (rand() * 2 - 1 - lp);
    const fadeIn = Math.min(1, t / 0.004);
    const fadeOut = Math.min(1, (n - 1 - i) / Math.max(1, tail));
    out[i] = lp * Math.exp(-k * t) * fadeIn * fadeOut;
  }
}
