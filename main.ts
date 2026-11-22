// Hand-in program for "Vault of the Sunken Crown" (Node 22+, stdlib only).
// Copies this repo's game/ and screenshots/ into the output directory
// (/output in the grader, MAKEFUN_OUTPUT_DIR elsewhere) and writes the
// dossier the judge reads, using the vendored make.fun game library.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(outDir, { recursive: true });
cpSync(join(repoRoot, 'game'), join(outDir, 'game'), { recursive: true });

const shotsIn = join(repoRoot, 'screenshots');
const shotsOut = join(outDir, 'screenshots');
mkdirSync(shotsOut, { recursive: true });
if (existsSync(shotsIn)) {
  cpSync(shotsIn, shotsOut, { recursive: true });
}

// Caps mirror the scorer's gate: dossier text budget, at most 4 screenshots
// of 256 KiB each, and the game tree limits (993 entries / 48 MiB / 1000-byte
// paths) that share the output directory's own ceiling.
const dossier = buildDossier(outDir, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(outDir, 'dossier.json'), dossier);
