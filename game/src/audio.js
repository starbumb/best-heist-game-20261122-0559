// Tiny synthesized sound effects: no audio files, everything is an
// oscillator blip shaped by an envelope. Starts on first user gesture.

let ctx = null;
let master = null;

export function unlockAudio() {
  if (ctx) {
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});
    return;
  }
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.16;
    master.connect(ctx.destination);
  } catch {
    ctx = null;
  }
}

function blip(freqFrom, freqTo, seconds, type = 'sine', volume = 1) {
  if (!ctx || !master) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freqFrom, t);
    osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqTo), t + seconds);
    gain.gain.setValueAtTime(volume, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t);
    osc.stop(t + seconds + 0.02);
  } catch {
    // Sound is decoration; never let it break the game.
  }
}

export const sfx = {
  pickup() { blip(880, 1320, 0.16, 'triangle', 0.8); },
  crown() { blip(660, 990, 0.22, 'triangle', 0.9); setTimeout(() => blip(990, 1480, 0.3, 'triangle', 0.9), 110); },
  coin() { blip(1900, 1500, 0.09, 'square', 0.35); setTimeout(() => blip(2300, 1900, 0.12, 'square', 0.3), 70); },
  smoke() { blip(300, 90, 0.35, 'sawtooth', 0.25); },
  emp() { blip(1400, 120, 0.3, 'sawtooth', 0.5); },
  spotted() { blip(520, 760, 0.12, 'square', 0.4); },
  alarm() { blip(740, 740, 0.14, 'square', 0.35); },
  busted() { blip(392, 98, 0.7, 'sawtooth', 0.7); },
  win() { blip(523, 523, 0.14, 'triangle', 0.8); setTimeout(() => blip(659, 659, 0.14, 'triangle', 0.8), 130); setTimeout(() => blip(784, 1046, 0.32, 'triangle', 0.9), 260); },
  step() { blip(140, 90, 0.05, 'sine', 0.18); },
};
