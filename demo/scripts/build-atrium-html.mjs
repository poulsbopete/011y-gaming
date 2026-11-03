#!/usr/bin/env node
/** Bundle Vite dist into one HTML file for Elastic Atrium (self-contained, ≤10 MiB). */
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const assets = join(dist, 'assets');
let html = readFileSync(join(dist, 'index.html'), 'utf8');
const css = readdirSync(assets).find((f) => f.endsWith('.css'));
const js = readdirSync(assets).find((f) => f.endsWith('.js'));
if (!css || !js) throw new Error('missing dist assets — run npm run build first');
html = html.replace(
  /<link[^>]+href="\/assets\/[^"]+\.css"[^>]*>/,
  () => `<style>\n${readFileSync(join(assets, css), 'utf8')}\n</style>`,
);
html = html.replace(
  /<script[^>]+src="\/assets\/[^"]+\.js"[^>]*><\/script>/,
  () => `<script type="module">\n${readFileSync(join(assets, js), 'utf8')}\n</script>`,
);
if (html.includes('/assets/')) throw new Error('asset refs remain');
const outRel = 'demo/aether-games-interactive.html';
const out = join(root, 'aether-games-interactive.html');
writeFileSync(out, html);
const mb = (html.length / (1024 * 1024)).toFixed(2);
if (html.length > 10 * 1024 * 1024) {
  console.error(`ERROR: ${outRel} is ${mb} MiB — Atrium limit is 10 MiB`);
  process.exit(1);
}
console.log(`wrote ${outRel} (${html.length} bytes · ${mb} MiB)`);
