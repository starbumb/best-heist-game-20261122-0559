// Keyboard and mouse state for the heist. Keys are tracked as held flags;
// one-shot actions (gadgets, restart, confirm) are queued as named events
// the game loop drains each frame.

import { VIEW_W, VIEW_H } from './config.js';

export function createInput(canvas) {
  const input = {
    up: false,
    down: false,
    left: false,
    right: false,
    sneak: false,
    mouseX: VIEW_W / 2,
    mouseY: VIEW_H / 2,
    mouseDown: false,
    mouseInRoom: false,
    events: [],
  };

  const held = {
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ShiftLeft: 'sneak', ShiftRight: 'sneak',
  };
  const taps = {
    KeyQ: 'smoke',
    KeyE: 'coin',
    KeyF: 'emp',
    KeyR: 'restart',
    KeyP: 'pause',
    Space: 'confirm',
    Enter: 'confirm',
    Escape: 'pause',
  };

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const h = held[e.code];
    if (h) input[h] = true;
    const t = taps[e.code];
    if (t) input.events.push(t);
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  window.addEventListener('keyup', (e) => {
    const h = held[e.code];
    if (h) input[h] = false;
  });
  window.addEventListener('blur', () => {
    input.up = input.down = input.left = input.right = input.sneak = false;
    input.mouseDown = false;
  });

  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect();
    input.mouseX = ((e.clientX - rect.left) / rect.width) * VIEW_W;
    input.mouseY = ((e.clientY - rect.top) / rect.height) * VIEW_H;
    input.mouseInRoom = input.mouseY > 80 && input.mouseY < VIEW_H;
  }
  canvas.addEventListener('mousemove', toCanvas);
  canvas.addEventListener('mousedown', (e) => {
    toCanvas(e);
    if (e.button === 0) {
      input.mouseDown = true;
      input.events.push('click');
    } else if (e.button === 2) {
      input.events.push('coin');
    }
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) input.mouseDown = false;
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  input.drain = () => {
    const out = input.events;
    input.events = [];
    return out;
  };
  return input;
}
