// Room geometry
export const ROOM_SIZE = 8;
export const ROOM_HEIGHT = 3;
export const DESK_TOP = 0.75;

// Monitor positioning
export const MONITOR_GROUP_Z = -3.2;
export const SCREEN_LOCAL_Y = 0.3;
export const SCREEN_LOCAL_Z = 0.296;

// Screen mesh dimensions (matches bezel inner area)
export const SCR_W = 0.62;
export const SCR_H = 0.47;

// Derived (used by content.ts for seat/screen projection)
export const SCREEN_CENTER_Y = DESK_TOP + SCREEN_LOCAL_Y;
export const SCREEN_CENTER_Z = MONITOR_GROUP_Z + SCREEN_LOCAL_Z;
export const SCREEN_HALF_W = SCR_W / 2;
export const SCREEN_HALF_H = SCR_H / 2;
