export type ToContentMessage = { type: 'toggle' } | { type: 'getState' };

export interface DrunkState {
  active: boolean;
  intensity: number;
}
