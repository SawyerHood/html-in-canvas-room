export type ShaderEffect =
  | 'crt'
  | 'underwater'
  | 'vhs'
  | 'nightvision'
  | 'pixelate'
  | 'thermal';

export type ToContentMessage =
  | { type: 'toggle'; enabled: boolean; shader: ShaderEffect }
  | { type: 'setShader'; shader: ShaderEffect }
  | { type: 'setIntensity'; intensity: number }
  | { type: 'setSpeed'; speed: number }
  | { type: 'getState' };

export interface ShaderState {
  active: boolean;
  shader: ShaderEffect;
  intensity: number;
  speed: number;
}

export const DEFAULT_STATE: ShaderState = {
  active: false,
  shader: 'crt',
  intensity: 0.8,
  speed: 0.5,
};
