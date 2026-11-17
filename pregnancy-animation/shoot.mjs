// usage: node shoot.mjs page.html "js expression" out.png
import { createRequire } from 'node:module'; const { chromium } = createRequire(import.meta.url)('playwright'); import { start } from './server.mjs';
const [,, page, expr, out] = process.argv;
const srv = await start(8800 + Math.floor(Math.random()*500));
const port = srv.address().port;
const b = await chromium.launch({ args: ['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 1920, height: 1080 } });
p.on('console', m => { if (m.type()==='error' || m.type()==='warning') console.log('[page]', m.text().slice(0,300)); });
p.on('pageerror', e => console.log('[pageerror]', e.message));
await p.goto(`http://localhost:${port}/${page}`);
await p.waitForFunction('window.ready===true', null, { timeout: 60000 });
await p.evaluate('document.fonts.ready');
const exprs = expr.split(';;'); const outs = out.split(',');
for (let i=0;i<exprs.length;i++){ const t0=Date.now(); await p.evaluate(exprs[i]); await p.screenshot({ path: outs[i] , type: outs[i].endsWith('.jpg')?'jpeg':'png', quality: outs[i].endsWith('.jpg')?85:undefined}); console.log(outs[i], Date.now()-t0,'ms'); }
await b.close(); srv.close();
