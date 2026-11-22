// Vault of the Sunken Crown — shared constants for every module.

export const VIEW_W = 1280;
export const VIEW_H = 720;
export const HUD_H = 80;
export const TILE = 40;
export const COLS = 32;
export const ROWS = 16;

export const PLAYER_SPEED = 168;
export const SNEAK_SPEED = 86;
export const PLAYER_R = 13;

export const GUARD_SPEED = 74;
export const GUARD_CHASE_SPEED = 138;
export const GUARD_R = 13;
export const GUARD_VIEW = 185;
export const GUARD_HALF_ANGLE = 0.62;

export const CAM_VIEW = 205;
export const CAM_HALF_ANGLE = 0.44;

export const ALARM_FILL = 0.62;      // alarm per second at point blank
export const ALARM_DECAY = 0.16;     // alarm per second while unseen
export const ALARM_CHASE_AT = 0.72;  // guards start hunting above this

export const GADGET_COST = { smoke: 150, coin: 60, emp: 250 };
export const GEM_VALUE = 400;
export const CROWN_VALUE = 2000;

export const COLORS = {
  floorA: '#232c42',
  floorB: '#1d2538',
  carpet: '#5a2436',
  carpetEdge: '#7a3249',
  wall: '#3d4a68',
  wallTop: '#5a6c94',
  wallSide: '#2b3550',
  crate: '#8a6a3b',
  crateDark: '#6d522c',
  glassCase: '#9fd8e8',
  gold: '#f5c542',
  goldDark: '#c9962a',
  gem: '#59e6c8',
  thief: '#2e2a3a',
  thiefTrim: '#b388ff',
  guard: '#31456e',
  guardCap: '#1e2c49',
  skin: '#e8b98a',
  coneCalm: 'rgba(245, 197, 66, 0.16)',
  coneWarn: 'rgba(245, 140, 66, 0.22)',
  coneHot: 'rgba(245, 70, 60, 0.26)',
  camCone: 'rgba(120, 200, 255, 0.13)',
  exit: '#3fae6a',
  exitLocked: '#6b7280',
  alarmLow: '#59e6c8',
  alarmMid: '#f5c542',
  alarmHigh: '#f5463c',
  ink: '#eef2ff',
  dim: '#9aa7c7',
  panel: 'rgba(10, 13, 22, 0.88)',
};

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function dist(ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  return Math.hypot(dx, dy);
}

export function angleLerp(a, b, t) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return a + d * t;
}

export function angleDiff(a, b) {
  let d = Math.abs((a - b) % (Math.PI * 2));
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d;
}
