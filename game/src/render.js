// All drawing for Vault of the Sunken Crown: the room, raycast vision
// cones, characters, loot, the HUD with its alarm meter, and the
// title / result screens. Pure canvas shapes, no image assets.

import {
  VIEW_W, VIEW_H, HUD_H, TILE, COLS, ROWS,
  GUARD_VIEW, GUARD_HALF_ANGLE, CAM_VIEW, CAM_HALF_ANGLE,
  GADGET_COST, COLORS, clamp,
} from './config.js';

function conePath(ctx, world, x, y, angle, range, halfAngle) {
  const rays = 26;
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i <= rays; i++) {
    const a = angle - halfAngle + (2 * halfAngle * i) / rays;
    const d = world.raycast(x, y, a, range);
    ctx.lineTo(x + Math.cos(a) * d, y + Math.sin(a) * d);
  }
  ctx.closePath();
}

function drawCone(ctx, game, x, y, angle, range, halfAngle, fill) {
  conePath(ctx, game.world, x, y, angle, range, halfAngle);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.10)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function drawFloor(ctx, game) {
  const w = game.world;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = w.charAt(c, r);
      const x = c * TILE;
      const y = HUD_H + r * TILE;
      if (ch === '#') continue;
      ctx.fillStyle = (c + r) % 2 === 0 ? COLORS.floorA : COLORS.floorB;
      ctx.fillRect(x, y, TILE, TILE);
      if (ch === ',') {
        ctx.fillStyle = COLORS.carpet;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = COLORS.carpetEdge;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 6, y + 6, TILE - 12, TILE - 12);
      }
    }
  }
}

function drawWallsAndCrates(ctx, game) {
  const w = game.world;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const ch = w.charAt(c, r);
      const x = c * TILE;
      const y = HUD_H + r * TILE;
      if (ch === '#') {
        ctx.fillStyle = COLORS.wall;
        ctx.fillRect(x, y, TILE, TILE);
        ctx.fillStyle = COLORS.wallTop;
        ctx.fillRect(x, y, TILE, 7);
        ctx.fillStyle = COLORS.wallSide;
        ctx.fillRect(x, y + TILE - 5, TILE, 5);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
      } else if (ch === 'C') {
        ctx.fillStyle = COLORS.crate;
        ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
        ctx.strokeStyle = COLORS.crateDark;
        ctx.lineWidth = 3;
        ctx.strokeRect(x + 5, y + 5, TILE - 10, TILE - 10);
        ctx.beginPath();
        ctx.moveTo(x + 5, y + 5);
        ctx.lineTo(x + TILE - 5, y + TILE - 5);
        ctx.moveTo(x + TILE - 5, y + 5);
        ctx.lineTo(x + 5, y + TILE - 5);
        ctx.stroke();
      }
    }
  }
}

function drawExit(ctx, game) {
  const e = game.world.exit;
  const open = game.hasCrown;
  const pulse = 0.5 + 0.5 * Math.sin(game.time * 3);
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.fillStyle = open ? COLORS.exit : COLORS.exitLocked;
  ctx.globalAlpha = open ? 0.75 + 0.25 * pulse : 0.85;
  ctx.fillRect(-17, -17, 34, 34);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = '#0c2b18';
  ctx.lineWidth = 3;
  ctx.strokeRect(-17, -17, 34, 34);
  ctx.fillStyle = '#eafff2';
  ctx.font = 'bold 11px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EXIT', 0, 4);
  if (!open) {
    ctx.font = 'bold 13px "Trebuchet MS", sans-serif';
    ctx.fillText('🔒', 0, -22);
  }
  ctx.restore();
}

function drawCrown(ctx, x, y, scale, sparkle) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = COLORS.gold;
  ctx.strokeStyle = COLORS.goldDark;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-13, 8);
  ctx.lineTo(-13, -6);
  ctx.lineTo(-7, 1);
  ctx.lineTo(-3, -10);
  ctx.lineTo(0, 0);
  ctx.lineTo(3, -10);
  ctx.lineTo(7, 1);
  ctx.lineTo(13, -6);
  ctx.lineTo(13, 8);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillRect(-13, 8, 26, 4);
  ctx.fillStyle = '#e33e5a';
  ctx.beginPath();
  ctx.arc(0, 4, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.gem;
  ctx.beginPath();
  ctx.arc(-7, 5, 1.9, 0, Math.PI * 2);
  ctx.arc(7, 5, 1.9, 0, Math.PI * 2);
  ctx.fill();
  if (sparkle) {
    ctx.strokeStyle = 'rgba(255,240,180,0.9)';
    ctx.lineWidth = 1.4;
    const s = 5 + 2 * Math.sin(sparkle * 6);
    ctx.beginPath();
    ctx.moveTo(10 - s, -13);
    ctx.lineTo(10 + s, -13);
    ctx.moveTo(10, -13 - s);
    ctx.lineTo(10, -13 + s);
    ctx.stroke();
  }
  ctx.restore();
}

function drawLoot(ctx, game) {
  const w = game.world;
  for (const g of w.gems) {
    if (g.taken) continue;
    ctx.save();
    ctx.translate(g.x, g.y + Math.sin(game.time * 3 + g.c) * 2);
    ctx.fillStyle = COLORS.gem;
    ctx.strokeStyle = '#1f8a70';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, -2);
    ctx.lineTo(4, 8);
    ctx.lineTo(-4, 8);
    ctx.lineTo(-7, -2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.moveTo(0, -9);
    ctx.lineTo(7, -2);
    ctx.lineTo(-7, -2);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  const crown = w.crown;
  if (crown && !crown.taken) {
    // Glass display case with a velvet cushion.
    ctx.fillStyle = '#4a1630';
    ctx.fillRect(crown.x - 17, crown.y - 14, 34, 30);
    drawCrown(ctx, crown.x, crown.y, 1, game.time);
    ctx.fillStyle = 'rgba(159,216,232,0.20)';
    ctx.fillRect(crown.x - 18, crown.y - 18, 36, 36);
    ctx.strokeStyle = COLORS.glassCase;
    ctx.lineWidth = 2;
    ctx.strokeRect(crown.x - 18, crown.y - 18, 36, 36);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('THE CROWN', crown.x, crown.y - 24);
  }
}

function drawGuard(ctx, game, g) {
  const bob = g.mode === 'patrol' || g.mode === 'chase' ? Math.sin(g.stepPhase) * 1.5 : 0;
  ctx.save();
  ctx.translate(g.x, g.y + bob * 0.3);
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 12, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Body
  ctx.fillStyle = COLORS.guard;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#16233f';
  ctx.lineWidth = 2;
  ctx.stroke();
  // Shoulders toward facing
  const fx = Math.cos(g.facing);
  const fy = Math.sin(g.facing);
  ctx.fillStyle = COLORS.skin;
  ctx.beginPath();
  ctx.arc(fx * 5, fy * 5, 6.5, 0, Math.PI * 2);
  ctx.fill();
  // Cap brim
  ctx.fillStyle = COLORS.guardCap;
  ctx.beginPath();
  ctx.arc(fx * 5, fy * 5, 6.5, g.facing - 1.1, g.facing + 1.1);
  ctx.lineTo(fx * 5, fy * 5);
  ctx.closePath();
  ctx.fill();
  // Badge glint
  ctx.fillStyle = COLORS.gold;
  ctx.beginPath();
  ctx.arc(-fy * 6, fx * 6, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
  // Status marker
  ctx.font = 'bold 17px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  if (g.mode === 'chase') {
    ctx.fillStyle = COLORS.alarmHigh;
    ctx.fillText('!', g.x, g.y - 20);
  } else if (g.sees) {
    ctx.fillStyle = COLORS.alarmMid;
    ctx.fillText('!', g.x, g.y - 20);
  } else if (g.mode === 'investigate' || g.mode === 'look') {
    ctx.fillStyle = COLORS.dim;
    ctx.fillText('?', g.x, g.y - 20);
  }
}

function drawCamera(ctx, game, cam) {
  ctx.save();
  ctx.translate(cam.x, cam.y);
  ctx.fillStyle = '#20293f';
  ctx.fillRect(-11, -11, 22, 22);
  ctx.strokeStyle = '#57678c';
  ctx.lineWidth = 2;
  ctx.strokeRect(-11, -11, 22, 22);
  const fx = Math.cos(cam.angle);
  const fy = Math.sin(cam.angle);
  ctx.fillStyle = cam.disabledLeft > 0 ? '#3a4152' : '#d7e6ff';
  ctx.beginPath();
  ctx.arc(fx * 5, fy * 5, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#101623';
  ctx.beginPath();
  ctx.arc(fx * 7, fy * 7, 3, 0, Math.PI * 2);
  ctx.fill();
  if (cam.disabledLeft > 0) {
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 1.5;
    for (let i = 0; i < 3; i++) {
      const a = game.time * 9 + i * 2.1;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 4, Math.sin(a) * 4);
      ctx.lineTo(Math.cos(a) * 11, Math.sin(a) * 11);
      ctx.stroke();
    }
  } else if (Math.sin(game.time * 4 + cam.phase) > 0) {
    ctx.fillStyle = '#ff4d4d';
    ctx.beginPath();
    ctx.arc(8, -8, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = COLORS.dim;
  ctx.font = 'bold 9px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('CAM', cam.x, cam.y - 16);
}

function drawThief(ctx, game) {
  const p = game.player;
  const bob = p.moving ? Math.sin(p.stepPhase) * 1.6 : 0;
  ctx.save();
  ctx.translate(p.x, p.y + bob * 0.3);
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.beginPath();
  ctx.ellipse(0, 12, 11, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = COLORS.thief;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = COLORS.thiefTrim;
  ctx.lineWidth = 2.5;
  ctx.stroke();
  const fx = Math.cos(p.facing);
  const fy = Math.sin(p.facing);
  ctx.fillStyle = COLORS.skin;
  ctx.beginPath();
  ctx.arc(fx * 5, fy * 5, 6, 0, Math.PI * 2);
  ctx.fill();
  // Hood over the back of the head
  ctx.fillStyle = COLORS.thief;
  ctx.beginPath();
  ctx.arc(fx * 4, fy * 4, 6.4, p.facing + 0.9, p.facing + Math.PI * 2 - 0.9);
  ctx.lineTo(fx * 4, fy * 4);
  ctx.closePath();
  ctx.fill();
  // Loot sack when carrying the crown
  if (game.hasCrown) {
    ctx.fillStyle = '#7a5c2e';
    ctx.beginPath();
    ctx.arc(-fx * 11, -fy * 11, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#4f3c1c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = COLORS.thiefTrim;
  ctx.font = 'bold 10px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(p.sneaking ? 'YOU · SNEAKING' : 'YOU', p.x, p.y - 19);
}

function drawEffects(ctx, game) {
  for (const coin of game.coins) {
    ctx.save();
    ctx.translate(coin.x, coin.y);
    ctx.fillStyle = COLORS.gold;
    ctx.strokeStyle = COLORS.goldDark;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    if (coin.landed) {
      ctx.strokeStyle = 'rgba(245,197,66,0.5)';
      ctx.beginPath();
      ctx.arc(coin.x, coin.y, 8 + 4 * Math.sin(game.time * 6), 0, Math.PI * 2);
      ctx.stroke();
    }
  }
  for (const pt of game.particles) {
    ctx.globalAlpha = clamp(pt.life / pt.maxLife, 0, 1);
    ctx.fillStyle = pt.color;
    ctx.beginPath();
    ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  for (const sm of game.smokes) {
    const a = clamp(sm.life / sm.maxLife, 0, 1) * 0.55;
    for (let i = 0; i < 5; i++) {
      const ox = Math.sin(sm.seed + i * 2.4) * sm.r * 0.45;
      const oy = Math.cos(sm.seed * 1.3 + i * 1.9) * sm.r * 0.4;
      const grad = ctx.createRadialGradient(sm.x + ox, sm.y + oy, 2, sm.x + ox, sm.y + oy, sm.r * 0.75);
      grad.addColorStop(0, `rgba(190,198,220,${a})`);
      grad.addColorStop(1, 'rgba(190,198,220,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(sm.x + ox, sm.y + oy, sm.r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  for (const msg of game.messages) {
    ctx.globalAlpha = clamp(msg.life / msg.maxLife, 0, 1);
    ctx.fillStyle = msg.color;
    ctx.fillText(msg.text, msg.x, msg.y);
  }
  ctx.globalAlpha = 1;
}

function alarmColor(alarm) {
  if (alarm < 0.4) return COLORS.alarmLow;
  if (alarm < 0.72) return COLORS.alarmMid;
  return COLORS.alarmHigh;
}

function drawHud(ctx, game) {
  ctx.fillStyle = '#0c101d';
  ctx.fillRect(0, 0, VIEW_W, HUD_H);
  ctx.strokeStyle = '#2b3550';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, HUD_H);
  ctx.lineTo(VIEW_W, HUD_H);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.fillStyle = COLORS.ink;
  ctx.font = 'bold 19px "Trebuchet MS", sans-serif';
  ctx.fillText(game.level.name, 16, 30);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px "Trebuchet MS", sans-serif';
  const mins = Math.floor(game.levelTime / 60);
  const secs = Math.floor(game.levelTime % 60);
  ctx.fillText(`Room ${game.levelIndex + 1} of 3   ·   ${mins}:${String(secs).padStart(2, '0')}   ·   Score ${game.score}`, 16, 54);

  // Alarm meter
  const ax = 430;
  const aw = 380;
  ctx.fillStyle = COLORS.ink;
  ctx.font = 'bold 15px "Trebuchet MS", sans-serif';
  ctx.fillText('ALARM', ax, 26);
  ctx.fillStyle = '#1a2236';
  ctx.fillRect(ax, 34, aw, 20);
  ctx.strokeStyle = '#57678c';
  ctx.lineWidth = 2;
  ctx.strokeRect(ax, 34, aw, 20);
  const frac = clamp(game.alarm, 0, 1);
  ctx.fillStyle = alarmColor(game.alarm);
  ctx.fillRect(ax + 2, 36, (aw - 4) * frac, 16);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  ctx.textAlign = 'center';
  const label = game.alarm >= 0.72 ? 'SPOTTED — RUN!' : game.alarm >= 0.4 ? 'SUSPICIOUS' : game.alarm > 0.03 ? 'SEEN…' : 'UNSEEN';
  ctx.fillText(label, ax + aw / 2, 49);
  ctx.textAlign = 'left';

  // Loot tally
  const lx = 850;
  ctx.fillStyle = COLORS.ink;
  ctx.font = 'bold 14px "Trebuchet MS", sans-serif';
  ctx.fillText(game.hasCrown ? 'CROWN: IN THE BAG' : 'CROWN: IN ITS CASE', lx, 26);
  ctx.fillStyle = COLORS.gem;
  ctx.font = '13px "Trebuchet MS", sans-serif';
  ctx.fillText(`Gems ${game.gemsGot}/${game.world.gems.length}`, lx, 48);
  drawCrown(ctx, lx + 196, 38, 0.85, game.hasCrown ? game.time : 0);

  // Gadgets with their score cost
  const gy = 68;
  ctx.font = 'bold 12px "Trebuchet MS", sans-serif';
  const gadgets = [
    ['Q', 'Smoke', game.gadgets.smoke, GADGET_COST.smoke],
    ['E / right-click', 'Coin', game.gadgets.coin, GADGET_COST.coin],
    ['F', 'EMP', game.gadgets.emp, GADGET_COST.emp],
  ];
  let gx = 16;
  for (const [key, name, count, cost] of gadgets) {
    ctx.fillStyle = count > 0 ? COLORS.ink : '#55617e';
    const text = `[${key}] ${name} ×${count} (−${cost})`;
    ctx.fillText(text, gx, gy);
    gx += ctx.measureText(text).width + 22;
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = '12px "Trebuchet MS", sans-serif';
  ctx.fillText('WASD/arrows or hold mouse to move · Shift sneak · R restart', 700, gy);
}

function panel(ctx, w, h) {
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = COLORS.panel;
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = COLORS.gold;
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  return { x, y };
}

function drawTitle(ctx, game) {
  ctx.fillStyle = 'rgba(6,8,14,0.55)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const { x, y } = panel(ctx, 760, 470);
  ctx.textAlign = 'center';
  drawCrown(ctx, VIEW_W / 2, y + 66, 2.1, game.time);
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 36px Georgia, "Times New Roman", serif';
  ctx.fillText('VAULT OF THE SUNKEN CROWN', VIEW_W / 2, y + 140);
  ctx.fillStyle = COLORS.ink;
  ctx.font = '17px "Trebuchet MS", sans-serif';
  ctx.fillText('A three-room stealth heist. Cross each room unseen, lift the crown, reach the exit.', VIEW_W / 2, y + 172);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '15px "Trebuchet MS", sans-serif';
  const lines = [
    'Move: WASD / arrow keys, or hold the mouse.   Sneak: hold Shift (slower, harder to spot).',
    'Yellow cones are guard eyes, blue cones are cameras. Crates and walls block their view.',
    'Being seen fills the ALARM meter. Full meter — or a guard\'s hand on your shoulder — ends the run.',
    'Gadgets cost score:  Q smoke bomb  ·  E / right-click throw a coin  ·  F EMP pulse.',
    'Grab the crown to unlock the green EXIT. Gems are bonus loot. P pause · R restart room.',
  ];
  lines.forEach((line, i) => ctx.fillText(line, VIEW_W / 2, y + 214 + i * 26));
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 20px "Trebuchet MS", sans-serif';
  ctx.fillText('Press ENTER or click to start the heist', VIEW_W / 2, y + 392);
  ctx.fillStyle = COLORS.dim;
  ctx.font = '13px "Trebuchet MS", sans-serif';
  ctx.fillText('An original game by starbumb — no crowns were harmed', VIEW_W / 2, y + 424);
  void x;
}

function drawResult(ctx, game) {
  ctx.fillStyle = 'rgba(6,8,14,0.6)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  const { y } = panel(ctx, 620, 330);
  ctx.textAlign = 'center';
  if (game.state === 'busted') {
    ctx.fillStyle = COLORS.alarmHigh;
    ctx.font = 'bold 42px Georgia, serif';
    ctx.fillText('BUSTED!', VIEW_W / 2, y + 78);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillText(game.bustedReason, VIEW_W / 2, y + 116);
  } else if (game.state === 'leveldone') {
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 38px Georgia, serif';
    ctx.fillText('ROOM CLEANED OUT', VIEW_W / 2, y + 78);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillText(`${game.level.name} — crown secured, nobody saw a thing.`, VIEW_W / 2, y + 116);
  } else {
    drawCrown(ctx, VIEW_W / 2, y + 60, 1.7, game.time);
    ctx.fillStyle = COLORS.gold;
    ctx.font = 'bold 40px Georgia, serif';
    ctx.fillText('THE CROWN IS YOURS', VIEW_W / 2, y + 128);
    ctx.fillStyle = COLORS.ink;
    ctx.font = '16px "Trebuchet MS", sans-serif';
    ctx.fillText('Three rooms, one legend. The Sunken Crown vanishes into the night.', VIEW_W / 2, y + 162);
  }
  ctx.fillStyle = COLORS.dim;
  ctx.font = '15px "Trebuchet MS", sans-serif';
  const rows = [
    `Loot banked: ${game.lootBanked}`,
    `Gadget costs: −${game.gadgetSpent}`,
    `Time bonus: ${game.timeBonus}`,
  ];
  rows.forEach((row, i) => ctx.fillText(row, VIEW_W / 2, y + 196 + i * 24));
  ctx.fillStyle = COLORS.gold;
  ctx.font = 'bold 22px "Trebuchet MS", sans-serif';
  ctx.fillText(`SCORE ${game.score}`, VIEW_W / 2, y + 196 + rows.length * 24 + 14);
  ctx.fillStyle = COLORS.ink;
  ctx.font = 'bold 16px "Trebuchet MS", sans-serif';
  const prompt = game.state === 'busted'
    ? 'Press R or ENTER to try the room again'
    : game.state === 'leveldone'
      ? 'Press ENTER for the next room'
      : 'Press ENTER to run the heist again';
  ctx.fillText(prompt, VIEW_W / 2, y + 196 + rows.length * 24 + 48);
}

export function draw(ctx, game) {
  ctx.fillStyle = '#101623';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  drawFloor(ctx, game);
  drawExit(ctx, game);
  drawLoot(ctx, game);

  // Vision cones under the characters.
  for (const cam of game.cameras) {
    if (cam.disabledLeft > 0) continue;
    drawCone(ctx, game, cam.x, cam.y, cam.angle, CAM_VIEW, CAM_HALF_ANGLE,
      cam.sees ? 'rgba(255,120,80,0.20)' : COLORS.camCone);
  }
  for (const g of game.guards) {
    const fill = g.sees || g.mode === 'chase' ? COLORS.coneHot
      : game.alarm >= 0.4 ? COLORS.coneWarn : COLORS.coneCalm;
    drawCone(ctx, game, g.x, g.y, g.facing, GUARD_VIEW, GUARD_HALF_ANGLE, fill);
  }

  drawWallsAndCrates(ctx, game);
  for (const cam of game.cameras) drawCamera(ctx, game, cam);
  for (const g of game.guards) drawGuard(ctx, game, g);
  drawThief(ctx, game);
  drawEffects(ctx, game);
  drawHud(ctx, game);

  // Alarm edge pulse
  if (game.state === 'playing' && game.alarm > 0.45) {
    const a = (game.alarm - 0.45) * 0.5 * (0.7 + 0.3 * Math.sin(game.time * 8));
    ctx.strokeStyle = `rgba(245,70,60,${clamp(a, 0, 0.6)})`;
    ctx.lineWidth = 14;
    ctx.strokeRect(7, 7, VIEW_W - 14, VIEW_H - 14);
  }

  if (game.state === 'title') drawTitle(ctx, game);
  else if (game.state === 'busted' || game.state === 'leveldone' || game.state === 'victory') drawResult(ctx, game);
  else if (game.paused) {
    ctx.fillStyle = 'rgba(6,8,14,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = COLORS.ink;
    ctx.font = 'bold 36px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('PAUSED — press P to resume', VIEW_W / 2, VIEW_H / 2);
  }
}
