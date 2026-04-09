export type ToContentMessage = { type: 'toggle' } | { type: 'getState' };

export interface CRTState {
  active: boolean;
  seated: boolean;
  drunkIntensity?: number;
}
