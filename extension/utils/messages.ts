export type ToContentMessage = { type: 'toggle' } | { type: 'getState' };

export interface CRTState {
  active: boolean;
  seated: boolean;
  drunkIntensity?: number;
  hasBeer?: boolean;
  musicPlaying?: boolean;
  musicRecord?: number;
  posX?: number;
  posZ?: number;
  yaw?: number;
  pitch?: number;
}
