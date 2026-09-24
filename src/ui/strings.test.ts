import { describe, expect, it } from 'vitest';
import { NBSP } from './format';
import { levelCardLabel, levelTitle, starsOutOf, STRINGS } from './strings';

function allStrings(value: unknown, path = ''): [string, string][] {
  if (typeof value === 'string') return [[path, value]];
  if (typeof value === 'object' && value !== null) {
    return Object.entries(value).flatMap(([k, v]) => allStrings(v, path ? `${path}.${k}` : k));
  }
  return [];
}

describe('STRINGS', () => {
  it('reste en casse normale (seul le logo est en capitales)', () => {
    for (const [path, text] of allStrings(STRINGS)) {
      if (path === 'title.logo') continue;
      const letters = text.replace(/[^\p{L}]/gu, '');
      if (letters.length < 2) continue;
      expect(letters, path).not.toBe(letters.toUpperCase());
    }
  });

  it('n’a aucune chaîne vide', () => {
    for (const [path, text] of allStrings(STRINGS)) expect(text.trim(), path).not.toBe('');
  });
});

describe('textes composés', () => {
  it('numéro de niveau simple, sans zéro initial', () => {
    expect(levelTitle(3, 'Oursins')).toBe(`Niveau 3${NBSP}: Oursins`);
    expect(levelTitle(10, 'Le Léviathan')).toBe(`Niveau 10${NBSP}: Le Léviathan`);
  });

  it('accorde « étoile » comme en français', () => {
    expect(starsOutOf(0, 3)).toBe('0 étoile sur 3');
    expect(starsOutOf(1, 3)).toBe('1 étoile sur 3');
    expect(starsOutOf(2, 3)).toBe('2 étoiles sur 3');
  });

  it('décrit une case de la sélection', () => {
    expect(levelCardLabel(2, 'Méandres', false, 3, 3)).toBe('Niveau 2, Méandres, 3 étoiles sur 3');
    expect(levelCardLabel(4, 'Courants', true, 0, 3)).toBe('Niveau 4, Courants, verrouillé');
  });
});
