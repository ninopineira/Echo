import { describe, expect, it } from 'vitest';
import {
  earnedStars,
  formatFraction,
  formatPercent,
  formatTime,
  litSegments,
  NBSP,
  NNBSP,
  stepVolume,
  volumeFromRatio,
  VOLUME_SEGMENTS,
} from './format';

describe('formatTime', () => {
  it('écrit m:ss en tronquant les secondes', () => {
    expect(formatTime(0)).toBe('0:00');
    expect(formatTime(5.9)).toBe('0:05');
    expect(formatTime(83.2)).toBe('1:23');
    expect(formatTime(600)).toBe('10:00');
    expect(formatTime(3599.99)).toBe('59:59');
  });

  it('passe à h:mm:ss à partir d’une heure', () => {
    expect(formatTime(3600)).toBe('1:00:00');
    expect(formatTime(3725)).toBe('1:02:05');
  });

  it('ramène les valeurs invalides à 0:00', () => {
    expect(formatTime(-3)).toBe('0:00');
    expect(formatTime(Number.NaN)).toBe('0:00');
    expect(formatTime(Number.POSITIVE_INFINITY)).toBe('0:00');
  });
});

describe('formatFraction et formatPercent', () => {
  it('sépare par des espaces insécables', () => {
    expect(formatFraction(14, 30)).toBe(`14${NBSP}/${NBSP}30`);
  });

  it('écrit le volume en pourcentage entier', () => {
    expect(formatPercent(0.8)).toBe(`80${NNBSP}%`);
    expect(formatPercent(0)).toBe(`0${NNBSP}%`);
    expect(formatPercent(1.4)).toBe(`100${NNBSP}%`);
  });
});

describe('stepVolume', () => {
  it('avance par crans de 5 %', () => {
    expect(stepVolume(0.8, 1)).toBeCloseTo(0.85);
    expect(stepVolume(0.8, -1)).toBeCloseTo(0.75);
  });

  it('range un volume hors grille sur le cran voisin', () => {
    expect(stepVolume(0.83, 1)).toBeCloseTo(0.85);
    expect(stepVolume(0.83, -1)).toBeCloseTo(0.8);
  });

  it('reste borné à 0..1', () => {
    expect(stepVolume(1, 1)).toBe(1);
    expect(stepVolume(0, -1)).toBe(0);
    expect(stepVolume(0.02, -1)).toBe(0);
  });

  it('parcourt toute la plage en 20 pas', () => {
    let v = 0;
    for (let i = 0; i < VOLUME_SEGMENTS; i++) v = stepVolume(v, 1);
    expect(v).toBe(1);
  });
});

describe('jauge de volume', () => {
  it('convertit une position en cran', () => {
    expect(volumeFromRatio(0)).toBe(0);
    expect(volumeFromRatio(1)).toBe(1);
    expect(volumeFromRatio(0.5)).toBe(0.5);
    expect(volumeFromRatio(0.51)).toBe(0.5);
    expect(volumeFromRatio(-2)).toBe(0);
    expect(volumeFromRatio(7)).toBe(1);
  });

  it('allume un segment tous les 5 %', () => {
    expect(litSegments(0)).toBe(0);
    expect(litSegments(0.05)).toBe(1);
    expect(litSegments(0.8)).toBe(16);
    expect(litSegments(1)).toBe(VOLUME_SEGMENTS);
  });
});

describe('earnedStars', () => {
  it('compte les étoiles obtenues', () => {
    expect(earnedStars({ complete: false, pearls: false, par: false })).toBe(0);
    expect(earnedStars({ complete: true, pearls: false, par: true })).toBe(2);
    expect(earnedStars({ complete: true, pearls: true, par: true })).toBe(3);
  });
});
