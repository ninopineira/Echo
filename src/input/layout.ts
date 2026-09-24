/** API expérimentale (Chromium) : lettres réelles des touches physiques. */
interface KeyboardLayoutMap {
  get(code: string): string | undefined;
}
interface KeyboardWithLayout {
  getLayoutMap(): Promise<KeyboardLayoutMap>;
}

const MOVE_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'] as const;

/** Libellé des touches de nage : lettres réelles si le navigateur les donne, sinon « ZQSD / WASD ». */
export function movementLabel(letters: readonly (string | undefined)[]): string {
  if (letters.length === 4 && letters.every((l) => l !== undefined && l.length === 1)) {
    return letters.join('').toUpperCase();
  }
  return 'ZQSD / WASD';
}

export async function detectMovementLabel(nav: Navigator): Promise<string> {
  const keyboard = (nav as Navigator & { keyboard?: KeyboardWithLayout }).keyboard;
  if (!keyboard) return movementLabel([]);
  try {
    const map = await keyboard.getLayoutMap();
    return movementLabel(MOVE_CODES.map((c) => map.get(c)));
  } catch {
    return movementLabel([]);
  }
}
