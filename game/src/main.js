// Vault of the Sunken Crown — game loop and state machine.
// Cross three guarded rooms, steal each crown, reach the exit unseen.

import {
  VIEW_W, VIEW_H, HUD_H, ALARM_FILL, ALARM_DECAY, ALARM_CHASE_AT,
  GADGET_COST, GEM_VALUE, CROWN_VALUE, COLORS, clamp, dist,
} from './config.js';
import { LEVELS } from './levels.js';
import { World, tileCenter } from './world.js';
import {
  makePlayer, makeGuards, makeCameras, visionStrength,
  updateGuard, updateCamera, updatePlayer, guardInvestigates,
} from './entities.js';
import { GUARD_VIEW, GUARD_HALF_ANGLE, CAM_VIEW, CAM_HALF_ANGLE } from './config.js';
import { createInput } from './input.js';
import { draw } from './render.js';
import { unlockAudio, sfx } from './audio.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const input = createInput(canvas);

const game = {
  state: 'title', // title | playing | leveldone | busted | victory
  paused: false,
  frozen: false,
  time: 0,
  levelIndex: 0,
  level: LEVELS[0],
  world: null,
  player: null,
  guards: [],
  cameras: [],
  alarm: 0,
  levelTime: 0,
  score: 0,
  scoreAtLevelStart: 0,
  lootBanked: 0,
  gadgetSpent: 0,
  timeBonus: 0,
  hasCrown: false,
  gemsGot: 0,
  gadgets: { smoke: 0, coin: 0, emp: 0 },
  coins: [],
  smokes: [],
  particles: [],
  messages: [],
  bustedReason: '',
  alarmBeepAt: 0,
  stepAt: 0,
  smokeAt(x, y) {
    return this.smokes.some((s) => dist(x, y, s.x, s.y) < s.r);
  },
};

function say(text) {
  if (statusEl) statusEl.textContent = text;
}

function floatText(text, x, y, color = COLORS.gold, life = 2.2) {
  game.messages.push({ text, x, y, color, life, maxLife: life });
}

function burst(x, y, color, n = 14, speed = 90) {
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const v = speed * (0.4 + Math.random() * 0.8);
    game.particles.push({
      x, y,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v,
      life: 0.5 + Math.random() * 0.4,
      maxLife: 0.9,
      size: 2 + Math.random() * 2.5,
      color,
    });
  }
}

function loadLevel(index) {
  game.levelIndex = index;
  game.level = LEVELS[index];
  game.world = new World(game.level);
  game.player = makePlayer(game.world);
  game.guards = makeGuards(game.level);
  game.cameras = makeCameras(game.level);
  game.alarm = 0;
  game.levelTime = 0;
  game.hasCrown = false;
  game.gemsGot = 0;
  game.gadgets = { ...game.level.gadgets };
  game.coins = [];
  game.smokes = [];
  game.particles = [];
  game.messages = [];
  game.scoreAtLevelStart = game.score;
  floatText(game.level.briefing, VIEW_W / 2, HUD_H + 36, COLORS.ink, 4.5);
  say(`${game.level.name}. ${game.level.briefing}`);
}

function startHeist() {
  game.score = 0;
  game.lootBanked = 0;
  game.gadgetSpent = 0;
  game.timeBonus = 0;
  loadLevel(0);
  game.state = 'playing';
  game.paused = false;
}

function restartRoom() {
  game.score = game.scoreAtLevelStart;
  loadLevel(game.levelIndex);
  game.state = 'playing';
  game.paused = false;
}

function finishLevel() {
  game.timeBonus = Math.max(0, Math.round(600 - game.levelTime * 5));
  game.score += game.timeBonus;
  sfx.win();
  if (game.levelIndex >= LEVELS.length - 1) {
    game.state = 'victory';
    say('Victory. The crown is yours.');
  } else {
    game.state = 'leveldone';
    say('Room cleaned out. Press enter for the next room.');
  }
}

function bust(reason) {
  game.state = 'busted';
  game.bustedReason = reason;
  sfx.busted();
  say(`Busted. ${reason}`);
}

function spendGadget(name) {
  game.gadgets[name]--;
  game.gadgetSpent += GADGET_COST[name];
  game.score -= GADGET_COST[name];
}

function throwSmoke() {
  if (game.gadgets.smoke <= 0) {
    floatText('No smoke bombs left', game.player.x, game.player.y - 30, COLORS.dim, 1.2);
    return;
  }
  spendGadget('smoke');
  game.smokes.push({
    x: game.player.x, y: game.player.y, r: 72,
    life: 6, maxLife: 6, seed: Math.random() * 10,
  });
  burst(game.player.x, game.player.y, '#aeb8d4', 16, 60);
  sfx.smoke();
  floatText('SMOKE!', game.player.x, game.player.y - 30, COLORS.ink, 1.2);
}

function throwCoin() {
  if (game.gadgets.coin <= 0) {
    floatText('No coins left', game.player.x, game.player.y - 30, COLORS.dim, 1.2);
    return;
  }
  const p = game.player;
  let tx = input.mouseInRoom ? input.mouseX : p.x + Math.cos(p.facing) * 170;
  let ty = input.mouseInRoom ? input.mouseY : p.y + Math.sin(p.facing) * 170;
  // Walk the target back out of any wall it landed in.
  for (let t = 1; t > 0; t -= 0.08) {
    const x = p.x + (tx - p.x) * t;
    const y = p.y + (ty - p.y) * t;
    if (!game.world.circleHits(x, y, 4)) { tx = x; ty = y; break; }
  }
  spendGadget('coin');
  game.coins.push({ x: p.x, y: p.y, fromX: p.x, fromY: p.y, tx, ty, t: 0, landed: false, life: 5 });
  floatText('Coin tossed…', p.x, p.y - 30, COLORS.dim, 1);
}

function fireEmp() {
  if (game.gadgets.emp <= 0) {
    floatText('No EMP charges left', game.player.x, game.player.y - 30, COLORS.dim, 1.2);
    return;
  }
  const p = game.player;
  const hit = game.cameras.filter((c) => dist(p.x, p.y, c.x, c.y) < 270 && c.disabledLeft <= 0);
  if (hit.length === 0) {
    floatText('No camera in EMP range', p.x, p.y - 30, COLORS.dim, 1.4);
    return;
  }
  spendGadget('emp');
  for (const cam of hit) {
    cam.disabledLeft = 7;
    burst(cam.x, cam.y, '#ffd166', 12, 110);
  }
  sfx.emp();
  floatText('EMP — cameras down!', p.x, p.y - 30, '#ffd166', 1.6);
}

function updateCoins(dt) {
  for (const coin of game.coins) {
    if (!coin.landed) {
      coin.t += dt / 0.45;
      const t = Math.min(1, coin.t);
      coin.x = coin.fromX + (coin.tx - coin.fromX) * t;
      coin.y = coin.fromY + (coin.ty - coin.fromY) * t - Math.sin(t * Math.PI) * 26;
      if (t >= 1) {
        coin.landed = true;
        coin.y = coin.ty;
        sfx.coin();
        burst(coin.x, coin.y, COLORS.gold, 6, 50);
        floatText('clink!', coin.x, coin.y - 16, COLORS.gold, 1);
        for (const g of game.guards) {
          if (dist(g.x, g.y, coin.x, coin.y) < 300) guardInvestigates(game, g, coin.x, coin.y);
        }
      }
    } else {
      coin.life -= dt;
    }
  }
  game.coins = game.coins.filter((c) => !c.landed || c.life > 0);
}

function updateEffects(dt) {
  for (const sm of game.smokes) sm.life -= dt;
  game.smokes = game.smokes.filter((s) => s.life > 0);
  for (const pt of game.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.vx *= 0.92;
    pt.vy *= 0.92;
    pt.life -= dt;
  }
  game.particles = game.particles.filter((p) => p.life > 0);
  for (const msg of game.messages) {
    msg.life -= dt;
    msg.y -= dt * 9;
  }
  game.messages = game.messages.filter((m) => m.life > 0);
}

function updatePickups() {
  const p = game.player;
  for (const gem of game.world.gems) {
    if (!gem.taken && dist(p.x, p.y, gem.x, gem.y) < 26) {
      gem.taken = true;
      game.gemsGot++;
      game.lootBanked += GEM_VALUE;
      game.score += GEM_VALUE;
      burst(gem.x, gem.y, COLORS.gem, 12, 80);
      floatText(`+${GEM_VALUE}`, gem.x, gem.y - 18, COLORS.gem, 1.4);
      sfx.pickup();
    }
  }
  const crown = game.world.crown;
  if (crown && !crown.taken && dist(p.x, p.y, crown.x, crown.y) < 30) {
    crown.taken = true;
    game.hasCrown = true;
    game.lootBanked += CROWN_VALUE;
    game.score += CROWN_VALUE;
    burst(crown.x, crown.y, COLORS.gold, 24, 120);
    floatText('CROWN SECURED — GET TO THE EXIT!', crown.x, crown.y - 34, COLORS.gold, 2.6);
    sfx.crown();
    say('Crown secured. Reach the exit.');
  }
  const exit = game.world.exit;
  if (game.hasCrown && dist(p.x, p.y, exit.x, exit.y) < 26) finishLevel();
}

function updateAlarm(dt) {
  let strength = 0;
  for (const g of game.guards) {
    strength = Math.max(strength, visionStrength(game, g.x, g.y, g.facing, GUARD_VIEW, GUARD_HALF_ANGLE));
  }
  for (const cam of game.cameras) {
    if (cam.disabledLeft > 0) continue;
    strength = Math.max(strength, visionStrength(game, cam.x, cam.y, cam.angle, CAM_VIEW, CAM_HALF_ANGLE) * 0.85);
  }
  const before = game.alarm;
  if (strength > 0) {
    game.alarm = clamp(game.alarm + ALARM_FILL * strength * dt, 0, 1);
    if (before < 0.4 && game.alarm >= 0.4) sfx.spotted();
    if (game.alarm >= ALARM_CHASE_AT && game.time > game.alarmBeepAt) {
      sfx.alarm();
      game.alarmBeepAt = game.time + 0.8;
    }
  } else {
    game.alarm = clamp(game.alarm - ALARM_DECAY * dt, 0, 1);
  }
  if (game.alarm >= 1) bust('The alarm meter filled — the whole palace locked down around you.');
  else if (game.player.caught) bust('A guard grabbed you by the collar mid-room.');
}

function handleEvents() {
  for (const ev of input.drain()) {
    unlockAudio();
    if (ev === 'pause' && game.state === 'playing') game.paused = !game.paused;
    if (game.state === 'title' && (ev === 'confirm' || ev === 'click')) startHeist();
    else if (game.state === 'playing' && !game.paused) {
      if (ev === 'smoke') throwSmoke();
      else if (ev === 'coin') throwCoin();
      else if (ev === 'emp') fireEmp();
      else if (ev === 'restart') restartRoom();
    } else if (game.state === 'busted' && (ev === 'confirm' || ev === 'restart' || ev === 'click')) {
      restartRoom();
    } else if (game.state === 'leveldone' && (ev === 'confirm' || ev === 'click')) {
      loadLevel(game.levelIndex + 1);
      game.state = 'playing';
    } else if (game.state === 'victory' && (ev === 'confirm' || ev === 'click')) {
      startHeist();
    }
  }
}

function update(dt) {
  game.time += dt;
  handleEvents();
  if (game.state !== 'playing' || game.paused) {
    // The room stays alive behind the title and result panels.
    if (game.world) {
      for (const cam of game.cameras) updateCamera(game, cam, dt);
      for (const g of game.guards) {
        if (game.state === 'title') updateGuard(game, g, dt);
      }
      updateEffects(dt);
    }
    return;
  }
  game.levelTime += dt;
  updatePlayer(game, input, dt);
  for (const g of game.guards) updateGuard(game, g, dt);
  for (const cam of game.cameras) updateCamera(game, cam, dt);
  updateCoins(dt);
  updatePickups();
  updateAlarm(dt);
  updateEffects(dt);
  if (game.player.moving && !game.player.sneaking && game.time > game.stepAt) {
    sfx.step();
    game.stepAt = game.time + 0.34;
  }
}

// Screenshot staging: ?shot=cover|2|3|4 arranges a real mid-game moment
// of this same code and freezes it, so stills show the game honestly.
function stageShot(name) {
  const place = (entity, c, r, facing) => {
    const t = tileCenter(c, r);
    entity.x = t.x;
    entity.y = t.y;
    if (facing !== undefined) entity.facing = facing;
  };
  if (name === 'cover') {
    loadLevel(1);
    game.state = 'playing';
    place(game.player, 15, 10, -0.5);
    game.player.sneaking = true;
    place(game.guards[0], 13, 5, 0.9);
    place(game.guards[1], 10, 10, 2.9);
    place(game.guards[2], 24, 11, Math.PI);
    game.guards[0].sees = true;
    game.alarm = 0.55;
    game.gemsGot = 1;
    game.score = 850;
    game.levelTime = 74;
    game.messages = [];
    floatText('Crown case ahead — stay out of the cones…', VIEW_W / 2, HUD_H + 36, COLORS.ink, 99);
  } else if (name === '2') {
    loadLevel(0);
    game.state = 'playing';
    place(game.player, 24, 7, 0);
    place(game.guards[0], 9, 4, Math.PI / 2);
    place(game.guards[1], 21, 12, -Math.PI / 2);
    game.alarm = 0.12;
    game.gemsGot = 1;
    game.score = 400;
    game.levelTime = 41;
    game.messages = [];
    floatText('The crown case — one quiet grab…', VIEW_W / 2, HUD_H + 36, COLORS.ink, 99);
  } else if (name === '3') {
    loadLevel(2);
    game.state = 'playing';
    place(game.player, 18, 8, 2.6);
    place(game.guards[0], 8, 3, 0.4);
    place(game.guards[1], 16, 7, 1.2);
    place(game.guards[2], 14, 12, -1.1);
    place(game.guards[3], 27, 7, Math.PI);
    game.guards[1].mode = 'chase';
    game.guards[1].sees = true;
    game.alarm = 0.82;
    game.hasCrown = true;
    game.world.crown.taken = true;
    game.gemsGot = 2;
    game.score = 3100;
    game.levelTime = 96;
    game.smokes.push({ x: game.player.x - 60, y: game.player.y + 30, r: 72, life: 6, maxLife: 6, seed: 3 });
    game.messages = [];
    floatText('SPOTTED — smoke down, run for the exit!', VIEW_W / 2, HUD_H + 36, COLORS.alarmHigh, 99);
  } else if (name === '4') {
    loadLevel(0);
    game.state = 'title';
    game.messages = [];
  } else {
    return false;
  }
  game.frozen = true;
  return true;
}

loadLevel(0);
const shotParam = new URLSearchParams(location.search).get('shot');
if (shotParam) stageShot(shotParam);

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!game.frozen) update(dt);
  draw(ctx, game);
  // A staged screenshot freezes the scene: one painted frame, then idle.
  if (!game.frozen) requestAnimationFrame(frame);
}
// Paint once synchronously so the canvas is never blank, even before the
// first animation frame fires.
draw(ctx, game);
requestAnimationFrame(frame);

window.__heist = game;
