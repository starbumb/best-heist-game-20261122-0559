// World geometry: the tile grid of one room, collision, line of sight,
// guard pathfinding and the raycasts that shape vision cones.

import { TILE, COLS, ROWS, HUD_H } from './config.js';

export function tileCenter(c, r) {
  return { x: c * TILE + TILE / 2, y: HUD_H + r * TILE + TILE / 2 };
}

export function toTile(x, y) {
  return { c: Math.floor(x / TILE), r: Math.floor((y - HUD_H) / TILE) };
}

export class World {
  constructor(level) {
    this.level = level;
    this.grid = level.map.map((row) => [...row]);
    this.playerStart = null;
    this.exit = null;
    this.crown = null;
    this.gems = [];
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const ch = this.grid[r][c];
        if (ch === 'P') this.playerStart = tileCenter(c, r);
        else if (ch === 'X') this.exit = { ...tileCenter(c, r), c, r };
        else if (ch === '$') this.crown = { ...tileCenter(c, r), c, r, taken: false };
        else if (ch === 'g') this.gems.push({ ...tileCenter(c, r), c, r, taken: false });
      }
    }
  }

  charAt(c, r) {
    if (c < 0 || r < 0 || c >= COLS || r >= ROWS) return '#';
    return this.grid[r][c];
  }

  isSolid(c, r) {
    const ch = this.charAt(c, r);
    return ch === '#' || ch === 'C';
  }

  blocksSight(c, r) {
    return this.isSolid(c, r);
  }

  // Move a circle by (dx, dy), sliding along walls axis by axis.
  moveCircle(p, dx, dy, radius) {
    p.x += dx;
    if (this.circleHits(p.x, p.y, radius)) {
      p.x -= dx;
      const step = Math.sign(dx) * 1;
      while (step !== 0 && !this.circleHits(p.x + step, p.y, radius)) p.x += step;
    }
    p.y += dy;
    if (this.circleHits(p.x, p.y, radius)) {
      p.y -= dy;
      const step = Math.sign(dy) * 1;
      while (step !== 0 && !this.circleHits(p.x, p.y + step, radius)) p.y += step;
    }
  }

  circleHits(x, y, radius) {
    const minC = Math.floor((x - radius) / TILE);
    const maxC = Math.floor((x + radius) / TILE);
    const minR = Math.floor((y - HUD_H - radius) / TILE);
    const maxR = Math.floor((y - HUD_H + radius) / TILE);
    for (let r = minR; r <= maxR; r++) {
      for (let c = minC; c <= maxC; c++) {
        if (!this.isSolid(c, r)) continue;
        const nx = Math.max(c * TILE, Math.min(x, c * TILE + TILE));
        const ny = Math.max(HUD_H + r * TILE, Math.min(y, HUD_H + r * TILE + TILE));
        if (Math.hypot(x - nx, y - ny) < radius) return true;
      }
    }
    return false;
  }

  // True when nothing sight-blocking sits between the two points.
  lineOfSight(x1, y1, x2, y2) {
    const d = Math.hypot(x2 - x1, y2 - y1);
    const steps = Math.max(1, Math.ceil(d / 7));
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      const { c, r } = toTile(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t);
      if (this.blocksSight(c, r)) return false;
    }
    return true;
  }

  // Distance until a ray hits a sight-blocking tile, capped at maxDist.
  raycast(x, y, angle, maxDist) {
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    let d = 0;
    while (d < maxDist) {
      d += 6;
      const { c, r } = toTile(x + dx * d, y + dy * d);
      if (this.blocksSight(c, r)) return d - 3;
    }
    return maxDist;
  }

  // Breadth-first tile path between two pixel positions, as pixel waypoints.
  findPath(x1, y1, x2, y2) {
    const start = toTile(x1, y1);
    const goal = toTile(x2, y2);
    if (this.isSolid(goal.c, goal.r)) return null;
    const key = (c, r) => r * COLS + c;
    const prev = new Map();
    const seen = new Set([key(start.c, start.r)]);
    const queue = [start];
    while (queue.length > 0) {
      const cur = queue.shift();
      if (cur.c === goal.c && cur.r === goal.r) break;
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = cur.c + dc;
        const nr = cur.r + dr;
        const k = key(nc, nr);
        if (seen.has(k) || this.isSolid(nc, nr)) continue;
        seen.add(k);
        prev.set(k, cur);
        queue.push({ c: nc, r: nr });
      }
    }
    if (!seen.has(key(goal.c, goal.r))) return null;
    const tiles = [];
    let cur = goal;
    while (!(cur.c === start.c && cur.r === start.r)) {
      tiles.push(cur);
      cur = prev.get(key(cur.c, cur.r));
      if (!cur) return null;
    }
    tiles.reverse();
    const points = tiles.map((t) => tileCenter(t.c, t.r));
    points.push({ x: x2, y: y2 });
    return points;
  }
}
