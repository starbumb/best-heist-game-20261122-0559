// The people and machines of the heist: the thief, patrolling guards and
// sweeping cameras, plus the vision test they all share.

import {
  TILE, PLAYER_SPEED, SNEAK_SPEED, PLAYER_R,
  GUARD_SPEED, GUARD_CHASE_SPEED, GUARD_R, GUARD_VIEW, GUARD_HALF_ANGLE,
  CAM_VIEW, CAM_HALF_ANGLE, ALARM_CHASE_AT,
  clamp, dist, angleLerp, angleDiff,
} from './config.js';
import { tileCenter } from './world.js';

export function makePlayer(world) {
  return {
    x: world.playerStart.x,
    y: world.playerStart.y,
    r: PLAYER_R,
    facing: 0,
    moving: false,
    sneaking: false,
    stepPhase: 0,
    caught: false,
  };
}

export function makeGuards(level) {
  return level.guards.map((def, i) => {
    const start = tileCenter(def.path[0][0], def.path[0][1]);
    return {
      x: start.x,
      y: start.y,
      r: GUARD_R,
      facing: i * 1.3,
      waypoints: def.path.map(([c, r]) => tileCenter(c, r)),
      wpIndex: 1 % def.path.length,
      pauseTime: def.pause,
      pauseLeft: 0,
      mode: 'patrol', // patrol | investigate | chase | look
      path: null,
      pathIndex: 0,
      target: null,
      lookLeft: 0,
      lastSeen: null,
      lostTimer: 0,
      sees: false,
      scanPhase: i * 2.1,
      stepPhase: i,
      id: i,
    };
  });
}

export function makeCameras(level) {
  return level.cameras.map((def, i) => {
    const at = tileCenter(def.at[0], def.at[1]);
    return {
      x: at.x,
      y: at.y,
      baseDir: def.dir,
      sweep: def.sweep,
      period: def.period,
      phase: i * 1.7,
      angle: def.dir,
      disabledLeft: 0,
      sees: false,
      id: i,
    };
  });
}

// How strongly an observer at (x, y) facing `angle` sees the thief right now:
// 0 when unseen, up to 1 at point blank in the middle of the cone.
export function visionStrength(game, x, y, angle, range, halfAngle) {
  const p = game.player;
  if (game.smokeAt(p.x, p.y)) return 0;
  const d = dist(x, y, p.x, p.y);
  if (d > range) return 0;
  const toPlayer = Math.atan2(p.y - y, p.x - x);
  if (angleDiff(toPlayer, angle) > halfAngle) return 0;
  if (!game.world.lineOfSight(x, y, p.x, p.y)) return 0;
  let s = 0.35 + 0.65 * (1 - d / range);
  if (p.sneaking) s *= 0.45;
  if (!p.moving) s *= 0.8;
  return clamp(s, 0, 1);
}

function followPath(game, guard, dt, speed) {
  if (!guard.path || guard.pathIndex >= guard.path.length) return true;
  const t = guard.path[guard.pathIndex];
  const d = dist(guard.x, guard.y, t.x, t.y);
  if (d < 6) {
    guard.pathIndex++;
    return guard.pathIndex >= guard.path.length;
  }
  const dir = Math.atan2(t.y - guard.y, t.x - guard.x);
  guard.facing = angleLerp(guard.facing, dir, Math.min(1, dt * 7));
  const vx = Math.cos(dir) * speed * dt;
  const vy = Math.sin(dir) * speed * dt;
  game.world.moveCircle(guard, vx, vy, guard.r);
  guard.stepPhase += dt * 9;
  return false;
}

function sendGuardTo(game, guard, x, y) {
  guard.path = game.world.findPath(guard.x, guard.y, x, y);
  guard.pathIndex = 0;
  guard.target = { x, y };
}

export function updateGuard(game, guard, dt) {
  guard.sees = visionStrength(game, guard.x, guard.y, guard.facing, GUARD_VIEW, GUARD_HALF_ANGLE) > 0;

  // A guard who can see you at high alarm gives chase.
  if (guard.sees && game.alarm >= ALARM_CHASE_AT && guard.mode !== 'chase') {
    guard.mode = 'chase';
    guard.lostTimer = 0;
    guard.path = null;
  }

  if (guard.mode === 'chase') {
    if (guard.sees) {
      guard.lastSeen = { x: game.player.x, y: game.player.y };
      guard.lostTimer = 0;
    } else {
      guard.lostTimer += dt;
    }
    const goal = guard.lastSeen ?? { x: guard.x, y: guard.y };
    if (!guard.path || guard.pathIndex >= guard.path.length || guard.sees) {
      sendGuardTo(game, guard, goal.x, goal.y);
    }
    followPath(game, guard, dt, GUARD_CHASE_SPEED);
    if (guard.lostTimer > 3) {
      guard.mode = 'look';
      guard.lookLeft = 2.2;
    }
    if (dist(guard.x, guard.y, game.player.x, game.player.y) < guard.r + game.player.r - 2) {
      game.player.caught = true;
    }
    return;
  }

  // A guard who spots you below chase alarm stops and stares: your fair warning.
  if (guard.sees) {
    const toPlayer = Math.atan2(game.player.y - guard.y, game.player.x - guard.x);
    guard.facing = angleLerp(guard.facing, toPlayer, Math.min(1, dt * 5));
    return;
  }

  if (guard.mode === 'investigate') {
    if (followPath(game, guard, dt, GUARD_SPEED * 1.25)) {
      guard.mode = 'look';
      guard.lookLeft = 2.4;
    }
    return;
  }

  if (guard.mode === 'look') {
    guard.lookLeft -= dt;
    guard.scanPhase += dt * 2.2;
    guard.facing += Math.sin(guard.scanPhase) * dt * 1.6;
    if (guard.lookLeft <= 0) {
      guard.mode = 'patrol';
      const wp = guard.waypoints[guard.wpIndex];
      sendGuardTo(game, guard, wp.x, wp.y);
    }
    return;
  }

  // Patrol: walk the loop, pausing at each waypoint to scan the room.
  if (guard.pauseLeft > 0) {
    guard.pauseLeft -= dt;
    guard.scanPhase += dt * 1.6;
    guard.facing += Math.sin(guard.scanPhase) * dt * 1.1;
    return;
  }
  if (!guard.path || guard.pathIndex >= guard.path.length) {
    const wp = guard.waypoints[guard.wpIndex];
    if (dist(guard.x, guard.y, wp.x, wp.y) < 8) {
      guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      guard.pauseLeft = guard.pauseTime;
      return;
    }
    sendGuardTo(game, guard, wp.x, wp.y);
    if (!guard.path) {
      guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
      return;
    }
  }
  if (followPath(game, guard, dt, GUARD_SPEED)) {
    guard.wpIndex = (guard.wpIndex + 1) % guard.waypoints.length;
    guard.pauseLeft = guard.pauseTime;
  }
}

export function guardInvestigates(game, guard, x, y) {
  if (guard.mode === 'chase') return;
  guard.mode = 'investigate';
  guard.pauseLeft = 0;
  sendGuardTo(game, guard, x, y);
}

export function updateCamera(game, cam, dt) {
  if (cam.disabledLeft > 0) {
    cam.disabledLeft -= dt;
    cam.sees = false;
    return;
  }
  cam.angle = cam.baseDir + Math.sin((game.time * Math.PI * 2) / cam.period + cam.phase) * cam.sweep;
  cam.sees = visionStrength(game, cam.x, cam.y, cam.angle, CAM_VIEW, CAM_HALF_ANGLE) > 0;
}

export function updatePlayer(game, input, dt) {
  const p = game.player;
  let mx = 0;
  let my = 0;
  if (input.left) mx -= 1;
  if (input.right) mx += 1;
  if (input.up) my -= 1;
  if (input.down) my += 1;
  if (mx === 0 && my === 0 && input.mouseDown && input.mouseInRoom) {
    const dx = input.mouseX - p.x;
    const dy = input.mouseY - p.y;
    const d = Math.hypot(dx, dy);
    if (d > 14) {
      mx = dx / d;
      my = dy / d;
    }
  }
  p.sneaking = input.sneak;
  p.moving = mx !== 0 || my !== 0;
  if (p.moving) {
    const len = Math.hypot(mx, my) || 1;
    const speed = p.sneaking ? SNEAK_SPEED : PLAYER_SPEED;
    game.world.moveCircle(p, (mx / len) * speed * dt, (my / len) * speed * dt, p.r);
    p.facing = angleLerp(p.facing, Math.atan2(my, mx), Math.min(1, dt * 14));
    p.stepPhase += dt * (p.sneaking ? 6 : 11);
  }
}

export { TILE };
