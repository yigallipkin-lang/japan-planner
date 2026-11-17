// Frame-by-frame renderer: node render.mjs <outDir> [fps] [chapters e.g. 1,2,5] [pages]
// Renders each chapter to its own MP4 (chapter_N.mp4) by stepping window.renderAt(t) deterministically.
import { createRequire } from 'node:module'; import { spawn } from 'node:child_process'; import fs from 'node:fs';
import { start } from './server.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const outDir = process.argv[2] || 'out'; const fps = +(process.argv[3] || 24);
const only = process.argv[4] ? process.argv[4].split(',').map(Number) : null;
const nPages = +(process.argv[5] || 3);
fs.mkdirSync(outDir, { recursive: true });
const srv = await start(9300 + Math.floor(Math.random() * 300)); const port = srv.address().port;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
async function newPage() {
  const p = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  p.on('pageerror', e => console.log('[pageerror]', e.message));
  await p.goto(`http://localhost:${port}/index.html`);
  await p.waitForFunction('window.ready===true', null, { timeout: 120000 });
  await p.evaluate('document.fonts.ready');
  return p;
}
const probe = await newPage();
const chapters = await probe.evaluate('window.CHAPTERS.map(c=>({start:c.start,dur:c.dur,title:c.title}))');
await probe.close();
const queue = chapters.map((c, i) => ({ ...c, n: i + 1 })).filter(c => !only || only.includes(c.n));
// longest first for better load balance
queue.sort((a, b) => b.dur - a.dur);
async function worker(id) {
  const p = await newPage();
  while (queue.length) {
    const c = queue.shift(); const frames = Math.round(c.dur * fps);
    const file = `${outDir}/chapter_${c.n}.mp4`;
    const ff = spawn('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(fps), '-c:v', 'mjpeg', '-i', '-',
      '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p', '-r', String(fps), '-movflags', '+faststart', file], { stdio: ['pipe', 'inherit', 'inherit'] });
    const t0 = Date.now();
    for (let f = 0; f < frames; f++) {
      const t = c.start + (f + 0.5) / fps;
      await p.evaluate(`renderAt(${t})`);
      const buf = await p.screenshot({ type: 'jpeg', quality: 93 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (f % 120 === 0) console.log(`[w${id}] ch${c.n} ${f}/${frames} ${((Date.now() - t0) / 1000).toFixed(0)}s`);
    }
    ff.stdin.end(); await new Promise(r => ff.on('close', r));
    console.log(`[w${id}] ch${c.n} done in ${((Date.now() - t0) / 1000).toFixed(0)}s -> ${file}`);
  }
  await p.close();
}
await Promise.all(Array.from({ length: nPages }, (_, i) => worker(i)));
await browser.close(); srv.close();
console.log('ALL DONE');
