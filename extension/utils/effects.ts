import type { ShaderEffect } from './messages';

export interface EffectMeta {
  id: ShaderEffect;
  name: string;
  icon: string;
  index: number;
}

export const EFFECTS: EffectMeta[] = [
  { id: 'crt', name: 'CRT', icon: '\u{1F4FA}', index: 0 },
  { id: 'underwater', name: 'Underwater', icon: '\u{1F30A}', index: 1 },
  { id: 'vhs', name: 'VHS Glitch', icon: '\u{1F4FC}', index: 2 },
  { id: 'nightvision', name: 'Night Vision', icon: '\u{1F52D}', index: 3 },
  { id: 'pixelate', name: 'Pixelate', icon: '\u{1F7E9}', index: 4 },
  { id: 'thermal', name: 'Thermal', icon: '\u{1F321}\u{FE0F}', index: 5 },
];

export const EFFECT_MAP: Record<ShaderEffect, number> = Object.fromEntries(
  EFFECTS.map((e) => [e.id, e.index]),
) as Record<ShaderEffect, number>;
