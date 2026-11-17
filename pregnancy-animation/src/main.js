// Timeline: 8 chapters, deterministic renderAt(t) for frame-by-frame capture.
import * as THREE from 'three';
import { scene, renderer, camera, lookCam, orbitCam, V, clamp, lerp, sstep, ease, seg, table, U, Particles, rng, tissue, ell, makeTube, setGeo } from './core.js';
import { Mother, cutPlane } from './mother.js';
import { Repro } from './repro.js';
import { EmbryoRig, Icons, Beads, Alveoli, Timeline, TRI_COLORS } from './extras.js';
import { CRL } from './fetus.js';

export const CHAPTERS = [
  { title: 'האנטומיה של ההריון', dur: 28 },
  { title: 'מערכת הרבייה הנשית', dur: 36 },
  { title: 'שליש ראשון - שבועות אחד עד שלושה עשר', dur: 32 },
  { title: 'שליש שני - שבועות ארבעה עשר עד עשרים ושבע', dur: 26 },
  { title: 'שליש שלישי - משבוע עשרים ושמונה ועד הלידה', dur: 26 },
  { title: 'השינויים בגוף האם', dur: 50 },
  { title: 'ההכנה ללידה', dur: 22 },
  { title: 'לסיכום', dur: 30 },
];
let acc = 0; for (const c of CHAPTERS) { c.start = acc; acc += c.dur; }
export const TOTAL = acc;

const M = new Mother(); const Rp = new Repro(); const E = new EmbryoRig(); const IC = new Icons();
const BD = new Beads(); const AL = new Alveoli(); const TL = new Timeline();
const RIGS = [M.g, Rp.g, E.g, IC.g, BD.g, AL.g, TL.g];
RIGS.forEach(r => scene.add(r));
function show(...list) { RIGS.forEach(r => r.visible = list.includes(r)); }
const fetusScale = w => table([[20, 1], [30, 0.93], [40, 0.88]], w);

// extra props in mother space
const glowMat = (c) => tissue({ color: c, sss: c, emissive: c, emit: 1, opacity: 0, transparent: true, depthWrite: false });
const backGlow = ell(glowMat('#ff8a6a'), 4, 7, 5, V(-6, 9, 0)); M.g.add(backGlow);
const faceGlow = [0].map(s => { const m = ell(glowMat('#c89070'), 1.3, 3.2, 6.2, V(7.6, 59.5, 0)); M.g.add(m); return m; });
const marksMat = tissue({ color: '#f6d6e0', sss: '#e8b0c0', emissive: '#ffffff', emit: 0.3, opacity: 0, transparent: true, depthWrite: false });
const marks = Array.from({ length: 7 }, () => { const m = new THREE.Mesh(new THREE.BufferGeometry(), marksMat); M.g.add(m); return m; });
const soundMat = tissue({ color: '#9fd8f2', sss: '#9fd8f2', emissive: '#bfe8ff', emit: 0.8, opacity: 0, transparent: true, depthWrite: false });
const sound = [0, 1, 2, 3].map(() => { const m = new THREE.Mesh(new THREE.TorusGeometry(1, 0.08, 8, 64), soundMat); M.g.add(m); return m; });
const colMatRef = tissue({ color: '#c9a4aa', sss: '#a07880', opacity: 0.85, transparent: true, rimStr: 0.4 });
const colMatGhost = tissue({ color: '#ffffff', sss: '#d0d8e0', xray: 1, opacity: 1, rim: '#8a9aaa', rimStr: 0.9 });
const colMatLive = tissue({ color: '#e26472', sss: '#c0404e', emissive: '#ff8090', emit: 0.25, opacity: 0.9, transparent: true });
const colRef = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 1, 32), colMatRef); const colLive = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 32), colMatLive);
const colRef2 = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 1.75, 1, 32), colMatGhost); const colBase = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 1, 32), colMatLive);
M.g.add(colRef, colLive, colRef2, colBase);
const earGlow = new Particles(40, 0.5, '#bfe8ff', 1); M.g.add(earGlow.obj);

const titleEl = document.querySelector('#title .txt'); const titleBox = document.getElementById('title');
const fadeEl = document.getElementById('fade'); const endEl = document.getElementById('endcard');
document.querySelector('#title .num').style.display = 'none';

function mVis(o = {}) {
  M.org.visible = !!o.organs; M.skel.visible = !!o.skel; M.blob.mc.visible = o.skin ?? true;
  M.ut.visible = o.uterus ?? true; M.blood.obj.visible = !!o.blood; M.aorta.visible = M.vena.visible = !!o.vessels;
  M.hormones.obj.visible = !!o.hormones; M.reflux.obj.visible = !!o.reflux; M.air.obj.visible = !!o.air;
  [colRef, colLive, colRef2, colBase].forEach(c => c.visible = !!o.column);
  backGlow.visible = faceGlow[0].visible = !!o.symptoms; marks.forEach(m => m.visible = !!o.symptoms);
  sound.forEach(s => s.visible = !!o.sound); earGlow.obj.visible = !!o.sound;
  M.joints.forEach(j => j.visible = true);
}
function resetMother() {
  U(M.utMat, 'uEmit', 0); U(M.utMat, 'uBandAmt', 0); U(M.capMat, 'uBandAmt', 0); U(M.utMat, 'uBulge', new THREE.Vector4(0, 0, 0, 0));
  U(M.skinMat, 'uOpacity', 0.9); U(M.skinMat, 'uBulge', new THREE.Vector4(0, 0, 0, 0));
  M.fetus.setXray(0, 1); Object.assign(M.fetus.organs, { heart: 0, kidney: 0, lung: 0, brain: 0, bones: 0, nails: 0, nerves: 0 });
  M.fadeUterus(1); M.ut.scale.set(1, 1, 1); M.setDia(25); M.lungs.forEach(l => { l.scale.set(6.0, 9.5, 5.4); l.position.y = 34; });
  M.bladder.scale.set(2.9, 2.4, 3.3); M.intestine.position.set(0, 0, 0); M.intestine.scale.set(1, 1, 1);
  U(M.boneMat, 'uOpacity', 0.55); U(M.diaMat, 'uOpacity', 0.6); U(M.lungMat, 'uOpacity', 0.55); U(M.giMat, 'uOpacity', 0.85);
  M.pelvis.scale.set(1, 1, 1); M.ilia.forEach(il => il.visible = true); M.lungs.forEach(l => l.visible = true); M.heart.visible = M.stomach.visible = M.eso.visible = M.intestine.visible = M.dia.visible = M.bladder.visible = true; U(M.jointMat, 'uOpacity', 0); U(M.ligMat, 'uOpacity', 0);
  U(M.lesMat, 'uOpacity', 0); U(M.burnMat, 'uOpacity', 0); U(M.intMat, 'uWaveAmp', 0); M.les.scale.setScalar(1);
  U(M.bladMat, 'uEmit', 0); U(M.heartMat, 'uEmit', 0.1);
}
// hormone particle cloud from the placenta outward
function hormones(t, amount, spread = 40) {
  const pl = M.ut.localToWorld(M.placenta.position.clone());
  const n = Math.floor(M.hormones.n * amount);
  for (let i = 0; i < n; i++) {
    const r = rng(i * 31 + 7); const d = V(r() - .5, r() - .2, r() - .5).normalize();
    const ph = (r() + t * 0.12) % 1;
    M.hormones.set(i, pl.clone().addScaledVector(d, ph * spread).add(V(Math.sin(t + i) * 1.2, Math.cos(t * 0.7 + i) * 1.2, 0)));
  }
  M.hormones.commit(n);
}

// ======================= CHAPTERS =======================
function ch1(u, D) {
  show(M.g, BD.g); resetMother(); mVis({ uterus: true });
  // weeks preview with the bead ring, then rewind to the beginning
  const lit = 40 * ease(seg(u, 9.5, 21.5));
  const rew = ease(seg(u, 23, 26.5));
  const w = Math.max(0.01, lerp(lit, 2, rew));
  cutPlane.constant = lerp(30, 0, sstep(9, 11, u));
  M.update({ w, time: u, flip: 0, fetusScale: fetusScale(w) });
  U(M.utMat, 'uEmissive', '#ffc0b0'); U(M.utMat, 'uEmit', 0.35 + 0.2 * Math.sin(u * 2.2));
  U(M.skinMat, 'uOpacity', sstep(0, 2.5, u) * 0.9);
  M.ut.visible = u > 1.2; M.ut.scale.setScalar(sstep(1.2, 3, u) * 0.999 + 0.001);
  BD.layoutRing(46, -8);
  const tg = [sstep(17, 18, u) * (1 - sstep(19.5, 20.5, u)), sstep(18.4, 19.4, u) * (1 - sstep(20.5, 21.5, u)), sstep(19.8, 20.8, u) * (1 - sstep(22, 23, u))];
  BD.update(lerp(lit, 0, rew), u, { triGlow: tg, show: sstep(7.5, 9.5, u), size: 1.9 });
  // fertilization spark at bead 3
  const sp = sstep(10.0, 10.5, u) * (1 - sstep(10.5, 12.5, u));
  const b3 = BD.beads[2].b.position;
  for (let i = 0; i < 50; i++) { const r = rng(i + 3); const d = V(r() - .5, r() - .5, r() - .5).normalize(); BD.spark.set(i, b3.clone().addScaledVector(d, sp * 6 * r())); }
  BD.spark.commit(sp > 0.01 ? 50 : 0);
  const push = ease(seg(u, 23.5, D));
  const az = lerp(-0.5, 0.25, u / D), dist = lerp(lerp(255, 225, u / D), 70, push);
  orbitCam(V(0, lerp(2, -5, push), 0), dist, lerp(az, 0.05, push), lerp(0.16, 0.05, push));
}

function ch2(u, D) {
  show(Rp.g); Rp.update(u, { sweep: sstep(11, 12.5, u) * (1 - sstep(13, 14.5, u)) });
  // highlights
  const hl = (a, b) => sstep(a, a + 0.4, u) * (1 - sstep(b, b + 0.6, u)) * 0.55;
  Rp.highlight([Rp.utMat], hl(2.5, 4)); Rp.highlight([Rp.ovMat], hl(4, 5.3)); Rp.highlight([Rp.tubeMat], hl(5.3, 6.6));
  U(Rp.vagMat, 'uEmit', hl(7.8, 9));
  // cervix highlight: band near y ~1.4 on the uterus
  U(Rp.utMat, 'uBandAmt', hl(6.6, 7.8) * 1.4); U(Rp.utMat, 'uBandY', 1.3); U(Rp.utMat, 'uBandW', 1.1); U(Rp.utMat, 'uBandColor', '#ffd8c0');
  // assembly at start
  const asm = ease(seg(u, 0, 2.2));
  Rp.g.scale.setScalar(lerp(0.85, 1, asm));
  // tubes x-ray during the journey
  const xr = sstep(12.5, 14, u) * (1 - sstep(23, 24.5, u));
  U(Rp.tubeMat, 'uXray', xr * 0.85); Rp.tubeMat.transparent = xr > 0; Rp.tubeMat.depthWrite = xr === 0;
  // follicle & ovulation
  const sw = sstep(9.5, 11.3, u), rup = sstep(11.3, 11.9, u);
  Rp.foll.scale.setScalar((0.05 + 0.55 * sw) * (1 - rup * 0.7) + 0.001); Rp.foll.visible = u < 13;
  const curve = Rp.tubeCurve;
  const F = V(7.35, 4.0, 0.75), Eend = curve.getPointAt(1);
  let eggP;
  if (u < 11.4) eggP = F.clone();
  else if (u < 12.6) eggP = F.clone().lerp(Eend, ease(seg(u, 11.4, 12.6)));
  else if (u < 17.5) eggP = curve.getPointAt(lerp(1, 0.62, ease(seg(u, 12.6, 15.2))));
  else if (u < 22.5) eggP = curve.getPointAt(lerp(0.62, 0.0, ease(seg(u, 17.5, 22.5))));
  else {
    const horn = curve.getPointAt(0); const site = Rp.ut.localToWorld(Rp.site.position.clone()).add(V(0, -0.42, 0.1));
    const k = ease(seg(u, 22.5, 24.6));
    const mid = V(0.6, 4.6, 0.3); eggP = horn.clone().multiplyScalar((1 - k) * (1 - k)).addScaledVector(mid, 2 * k * (1 - k)).addScaledVector(site, k * k);
    eggP.y += 0.3 * sstep(24.6, 26.2, u) + 0.15 * sstep(26.2, 29, u);
  }
  Rp.eggG.position.copy(eggP); Rp.eggG.visible = u > 11.2;
  const isEgg = u < 17.3;
  Rp.egg.visible = isEgg;
  // corona radiata (disperses after fertilization)
  const disperse = sstep(15.8, 18, u);
  Rp.coronaPts.forEach((p, i) => Rp.corona.set(i, p.clone().multiplyScalar(1 + disperse * 2.5).add(V(Math.sin(u * 2 + i) * 0.02, Math.cos(u * 2.3 + i) * 0.02, 0))));
  Rp.corona.commit(disperse < 0.99 ? 90 : 0); Rp.corona.mat.opacity = 0.9 * (1 - disperse);
  const zonaOn = 1 - sstep(23.6, 24.6, u); Rp.zona.visible = zonaOn > 0.01; U(Rp.zonaMat, 'uOpacity', 0.9 * zonaOn);
  U(Rp.zonaMat, 'uEmit', sstep(15.8, 16.1, u) * (1 - sstep(16.1, 17.5, u)) * 1.2);
  // pronuclei then cleavage
  const pn = sstep(16.2, 16.8, u) * (1 - sstep(17.2, 17.6, u));
  Rp.pron.forEach((p, i) => { p.visible = pn > 0.01; p.position.set((i ? 1 : -1) * lerp(0.1, 0.02, sstep(16.8, 17.4, u)), 0, 0.05); p.scale.setScalar(0.07 * pn + 1e-4); });
  const stage = u < 17.5 ? -1 : lerp(0, 4, seg(u, 17.6, 22.2)) + sstep(22.5, 24, u);
  Rp.setCells(Math.max(stage, 0), stage >= 0);
  // embed: cells shrink into the wall
  const emb = sstep(25.5, 30, u);
  Rp.eggG.scale.setScalar(lerp(1, 0.6, emb));
  // fertilization flash
  const fl = sstep(15.8, 16.0, u) * (1 - sstep(16.0, 17.0, u));
  for (let i = 0; i < 60; i++) { const r = rng(i + 99); const d = V(r() - .5, r() - .5, r() - .5).normalize(); Rp.flash.set(i, d.multiplyScalar(0.35 + fl * 0.6 * r())); }
  Rp.flash.commit(fl > 0.01 ? 60 : 0);
  // sperm
  Rp.sperm.forEach((s, i) => {
    const r = rng(i * 17 + 5);
    const a = seg(u, 13.6 + r() * 0.5, 15.8 - (i ? 0 : 0.0));
    const vis = u > 13.5 && u < (i ? 17.2 : 15.9);
    s.h.visible = s.t.visible = vis; if (!vis) return;
    const ang = r() * Math.PI * 2;
    const startU = 0.36 + r() * 0.08;
    const tu = lerp(startU, 0.62 - 0.035, ease(a) * (i ? 0.97 : 1));
    const P = curve.getPointAt(tu); const tan = curve.getTangentAt(tu);
    const side = V(0, 0, 1).cross(tan).normalize(); const up = tan.clone().cross(side).normalize();
    const rr = i ? 0.22 * (1 - a * 0.2) : 0.1 * (1 - a);
    P.addScaledVector(side, Math.cos(ang) * rr).addScaledVector(up, Math.sin(ang) * rr);
    s.h.position.copy(P); s.h.quaternion.setFromUnitVectors(V(0, 1, 0), tan); s.h.scale.set(0.035, 0.06, 0.03);
    const pts = []; for (let k = 0; k <= 10; k++) { const q = k / 10; pts.push(P.clone().addScaledVector(tan, -0.05 - q * 0.42).addScaledVector(side, Math.sin(u * 22 + q * 7 + i) * 0.04 * q).addScaledVector(up, Math.cos(u * 19 + q * 6 + i) * 0.02 * q)); }
    setGeo(s.t, makeTube(pts, q => 0.012 * (1 - q * 0.7), 20, 5));
  });
  // cut-away reveal of the uterus, then implantation + early placenta
  Rp.cut(lerp(8, 0, ease(seg(u, 21.5, 24))));
  const vg = ease(seg(u, 25.8, 30.5));
  Rp.villi.forEach((v, i) => {
    const L = v.len * vg * (0.7 + 0.3 * Math.sin(u * 0.6 + v.ph));
    v.m.visible = vg > 0.01; if (!v.m.visible) return;
    const p0 = v.base.clone(), p1 = p0.clone().addScaledVector(v.dir, L * 0.5).addScaledVector(v.kink, L * 0.25), p2 = p0.clone().addScaledVector(v.dir, L).addScaledVector(v.kink, L * 0.1);
    setGeo(v.m, makeTube([p0, p1, p2], q => 0.05 * (1 - 0.6 * q) * Math.min(1, vg * 2), 12, 6));
  });
  const dg = ease(seg(u, 27, 33));
  Rp.disc.visible = dg > 0.01; Rp.disc.scale.set(0.85 * dg + 0.01, 0.26 * dg + 0.01, 0.22 * dg + 0.01); Rp.disc.position.set(0, 0.24, 0.12);
  // exchange: oxygen + nutrients toward the embryo, waste back to the mother
  const fo = sstep(29, 30, u) * (1 - sstep(35.3, 36, u)), fw = sstep(31, 32, u) * (1 - sstep(35.3, 36, u));
  for (let i = 0; i < 90; i++) {
    const r = rng(i + 400); const v = Rp.villi[i % Rp.villi.length];
    const ph = (r() + u * 0.45) % 1;
    const p = v.base.clone().addScaledVector(v.dir, (1 - ph) * v.len * 1.2).add(V(0, -ph * 0.35, 0));
    if (i < 45) Rp.flowO.set(i, p); else Rp.flowO.hide(i);
    Rp.flowN.set(i, p.clone().add(V(r() * 0.2, r() * 0.2, 0)));
  }
  Rp.flowO.commit(fo > 0 ? 45 : 0); Rp.flowN.commit(fo > 0 ? 90 : 0); Rp.flowO.mat.opacity = Rp.flowN.mat.opacity = fo;
  for (let i = 0; i < 60; i++) { const r = rng(i + 800); const v = Rp.villi[(i * 3) % Rp.villi.length]; const ph = (r() + u * 0.35) % 1; Rp.flowW.set(i, v.base.clone().addScaledVector(v.dir, ph * v.len * 1.4).add(V(0.1, -0.3 * (1 - ph), 0.05))); }
  Rp.flowW.commit(fw > 0 ? 60 : 0); Rp.flowW.mat.opacity = fw;
  const hm = sstep(33, 34, u);
  const site = Rp.ut.localToWorld(Rp.site.position.clone());
  for (let i = 0; i < 70; i++) { const r = rng(i + 1200); const d = V(r() - .5, r() - .2, r() * 0.6 + 0.2).normalize(); const ph = (r() + u * 0.18) % 1; Rp.hormone.set(i, site.clone().addScaledVector(d, 0.6 + ph * 6)); }
  Rp.hormone.commit(hm > 0 ? 70 : 0); Rp.hormone.mat.opacity = hm * 0.9;
  // camera
  const tgt0 = V(0, 3.6, 0);
  let tgt, dist, az, el = 0.1;
  if (u < 9.5) { tgt = tgt0; dist = lerp(34, 29, u / 9.5); az = lerp(-0.35, 0.12, u / 9.5); }
  else if (u < 14) { const k = ease(seg(u, 9.5, 12)); tgt = tgt0.clone().lerp(V(8.2, 4.3, 0.8), k); dist = lerp(29, 8.5, k); az = lerp(0.12, 0.45, k); }
  else if (u < 17.5) { const k = ease(seg(u, 14, 15.5)); tgt = V(8.2, 4.3, 0.8).lerp(eggP, k); dist = lerp(8.5, 3.6, k); az = lerp(0.45, 0.7, k); el = lerp(0.1, 0.25, k); }
  else if (u < 22.5) {
    const k = ease(seg(u, 17.5, 22.5)); const uu = lerp(0.62, 0.0, k);
    const tan = curve.getTangentAt(Math.min(1, uu + 0.02));
    tgt = eggP.clone();
    const camP = eggP.clone().addScaledVector(tan, 2.4).add(V(0, 0.9, 2.2));
    const blend = sstep(17.5, 18.5, u);
    const pOrbit = V(eggP.x + 3.6 * Math.cos(0.25) * Math.sin(0.7), eggP.y + 3.6 * Math.sin(0.25), eggP.z + 3.6 * Math.cos(0.25) * Math.cos(0.7));
    lookCam(pOrbit.lerp(camP, blend), tgt); return;
  } else if (u < 25.5) { const k = ease(seg(u, 22.5, 25)); const site2 = Rp.ut.localToWorld(Rp.site.position.clone()); tgt = eggP.clone().lerp(site2, k); dist = lerp(4.5, 7.5, k); az = lerp(0.3, 0.12, k); el = 0.12; }
  else { const k = ease(seg(u, 25.5, D)); const site2 = Rp.ut.localToWorld(Rp.site.position.clone()); tgt = site2.clone().add(V(0, 0.1, 0)); dist = lerp(7.5, 4.2, k); az = lerp(0.12, -0.3, k); el = lerp(0.12, -0.05, k); }
  orbitCam(tgt, dist, az, el);
}

function ch3(u, D) {
  if (u < 22) {
    show(E.g);
    let w;
    if (u < 6.5) w = lerp(5.6, 6.0, u / 6.5); else if (u < 12) w = lerp(6.0, 6.9, seg(u, 6.5, 12)); else if (u < 17) w = lerp(6.9, 10.2, ease(seg(u, 12, 17))); else w = lerp(10.2, 13, seg(u, 17, 22));
    const f = E.f; const o = f.organs;
    o.brain = sstep(6.5, 7.5, u) * (1 - 0.7 * sstep(11.5, 13, u));
    o.heart = sstep(9.8, 10.5, u);
    o.kidney = sstep(17.2, 18, u) * (1 - sstep(21.3, 22, u));
    o.nails = sstep(19.8, 20.6, u);
    o.bones = 0; o.lung = 0; o.nerves = 0;
    const xr = sstep(6.4, 7.2, u) * (1 - sstep(11.8, 12.6, u)) + sstep(17, 17.8, u) * (1 - sstep(19.4, 20, u));
    f.setXray(xr * 0.8, 1);
    E.update(w, u, { armLift: 0.15 * Math.sin(u * 0.7) * sstep(9, 10, w) });
    const s = Math.pow(CRL(w) / 6.8, 0.22);
    E.g.scale.setScalar(s);
    // kidney urine droplets (in rig coords)
    const L = f.R.L;
    for (let i = 0; i < 30; i++) { const r = rng(i + 70); const k = (r() + u * 0.5) % 1; const side = i % 2 ? 1 : -1; E.urine.set(i, L.kidney(side).lerp(L.bladder, k)); }
    E.urine.commit(o.kidney > 0.3 ? 30 : 0);
    // camera
    const hand = f.toWorld(f.R.L.limbs.arms[0].Wr);
    let tgt = V(0, 0, 0), dist = lerp(7.5, 4.2, ease(seg(u, 0, 5))), az = lerp(-0.5, 0.5, u / 22), el = 0.12;
    if (u > 13) { const k = ease(seg(u, 13, 15)) * (1 - ease(seg(u, 16.6, 17.6))); tgt = tgt.lerp(hand, k * 0.7); dist = lerp(dist, 2.5, k); az = lerp(az, 1.0, k); el = lerp(el, -0.2, k); }
    if (u > 19.4) { const k = ease(seg(u, 19.4, 20.6)); tgt = V(0, 0, 0).lerp(hand, k * 0.7); dist = lerp(4.2, 2.3, k); az = lerp(az, 1.0, k); el = lerp(0.12, -0.2, k); }
    orbitCam(tgt, dist * s, az, el);
  } else {
    show(M.g, IC.g); resetMother(); mVis({ uterus: true, hormones: true });
    const w = lerp(10, 13, seg(u, 22, D));
    cutPlane.constant = 0;
    M.update({ w, time: u, fetusScale: 1 });
    hormones(u, 0.6 * sstep(22.3, 23.5, u), 45);
    U(M.utMat, 'uEmit', 0.15);
    IC.update(u, [sstep(24.5, 25.3, u), sstep(26.3, 27.1, u), sstep(28.0, 28.8, u), sstep(29.6, 30.4, u)]);
    orbitCam(V(4, 32, 0), lerp(150, 130, seg(u, 22, D)), lerp(0.42, 0.18, seg(u, 22, D)), 0.05);
  }
}

function ch4(u, D) {
  show(M.g); resetMother(); mVis({ uterus: true, symptoms: true, sound: true });
  const w = u < 15 ? lerp(14, 20.5, seg(u, 0, 15)) : lerp(20.5, 27, ease(seg(u, 15, 24.5)));
  const f = M.fetus;
  // bones harden
  const bn = sstep(4.5, 5.5, u) * (1 - sstep(8.5, 9.5, u));
  f.organs.bones = bn; f.setXray(bn * 0.75, 1);
  U(f.boneMat, 'uEmit', lerp(0, 0.6, sstep(5, 7.5, u))); U(f.boneMat, 'uColor', new THREE.Color('#b9d3e8').lerp(new THREE.Color('#f8f0de'), sstep(5, 7.5, u)));
  // hearing: mother's voice/heartbeat ripples, fetus turns head
  const hear = sstep(6.6, 7.2, u) * (1 - sstep(10.2, 10.8, u));
  const turn = 0.5 * ease(seg(u, 8.2, 9.4)) * (1 - ease(seg(u, 12, 14)));
  // kicks
  const kick = (c) => Math.exp(-Math.pow((u - c) / 0.35, 2));
  const kk = kick(11.6) + kick(13.3) * 0.9 + kick(19.5) * 0.5;
  const flutter = sstep(13.9, 14.3, u) * (1 - sstep(15.2, 15.6, u));
  const pose = { legExt: Math.min(1, kk * 0.9), turn, armLift: hear * 0.4 * Math.sin(u * 3) + flutter * 0.3 * Math.sin(u * 14) };
  const fs = fetusScale(w);
  const kickWorld = (() => { if (!f.R) return V(); return f.toWorld(f.R.L.limbs.legs[0].A); })();
  cutPlane.constant = 0;
  M.update({ w, time: u, pose, fetusScale: fs, kickAmt: Math.min(1, kk) * 1.0, kickPos: kickWorld.clone().add(V(5, 0, 0)) });
  // uterine wall bulge at the kick
  const kl = M.ut.worldToLocal(kickWorld.clone());
  U(M.utMat, 'uBulge', new THREE.Vector4(kl.x, kl.y, kl.z, 1.4 * Math.min(1, kk))); U(M.utMat, 'uBulgeR', 4);
  U(M.utMat, 'uBandAmt', flutter * 0.5 * (0.5 + 0.5 * Math.sin(u * 20))); U(M.utMat, 'uBandY', M.cavC); U(M.utMat, 'uBandW', 6);
  // sound rings travel from the mother's chest toward the uterus
  const src = V(6, 40, 0), dst = M.ut.localToWorld(V(0, M.cavC, 0));
  sound.forEach((s, i) => {
    const ph = (u * 0.55 + i / 4) % 1; const p = src.clone().lerp(dst, ph);
    s.position.copy(p); s.lookAt(dst); s.scale.setScalar(1.5 + ph * 5);
  });
  U(soundMat, 'uOpacity', hear * 0.55);
  const ear = f.R ? f.toWorld(f.R.L.earC(1)) : V();
  for (let i = 0; i < 40; i++) { const r = rng(i + 5); const d = V(r() - .5, r() - .5, r() - .5).normalize(); earGlow.set(i, ear.clone().addScaledVector(d, 0.6 + ((r() + u) % 1) * 1.6)); }
  earGlow.commit(hear > 0.2 && u > 8 ? 40 : 0); earGlow.mat.opacity = hear;
  // mother symptoms (back ache, stretch marks, facial pigmentation)
  U(backGlow.material, 'uOpacity', sstep(19.6, 20.4, u) * (1 - sstep(22.2, 23, u)) * (0.45 + 0.25 * Math.sin(u * 5)));
  const mk = sstep(22, 23, u) * (1 - sstep(25.6, 26, u)) * 0.85;
  U(marksMat, 'uOpacity', mk);
  if (mk > 0) {
    const P = M.P, prof = M.prof;
    marks.forEach((m, i) => {
      const yy = prof.cle + (P.L - prof.cle) * (0.28 + i * 0.03); const ang = -0.9 + i * 0.3;
      const pts = []; for (let k = 0; k <= 8; k++) { const y = yy + (k - 4) * 1.2; const r = prof.outer[Math.min(72, Math.round(y / P.L * 72))].x + 1.55; pts.push(M.ut.localToWorld(V(Math.cos(ang + k * 0.02) * r, y, Math.sin(ang + k * 0.02) * r))); }
      setGeo(m, makeTube(pts, q => 0.12 * Math.sin(Math.PI * q), 16, 5));
    });
  }
  faceGlow.forEach(g => U(g.material, 'uOpacity', sstep(23.6, 24.4, u) * 0.3));
  // camera
  const uc = M.ut.localToWorld(V(0, M.cavC, 0));
  if (u < 10) orbitCam(uc, lerp(64, 55, u / 10), lerp(0.25, -0.1, u / 10), 0.08);
  else if (u < 15.5) { const k = ease(seg(u, 10, 11)); orbitCam(uc.clone().add(V(4 * k, 0, 0)), lerp(55, 72, k), lerp(-0.1, 0.25, ease(seg(u, 10, 15.5))), 0.08); }
  else {
    const k = ease(seg(u, 15.5, 17.5));
    let tgt = uc.clone().add(V(4, 0, 0)).lerp(V(2, 20, 0), k), dist = lerp(72, 175, k), az = lerp(0.25, 0.42, k);
    if (u > 19) { const k2 = ease(seg(u, 19, 20)); az = lerp(az, -0.55, k2) + 0.05 * (u - 19); }
    if (u > 22) { const k3 = ease(seg(u, 22, 23)); tgt = tgt.lerp(V(8, 14, 0), k3); dist = lerp(dist, 110, k3); az = lerp(az, 0.25, k3); }
    if (u > 23.4) { const k4 = ease(seg(u, 23.4, 24.6)); tgt = tgt.lerp(V(4, 42, 0), k4); dist = lerp(dist, 118, k4); az = lerp(az, 0.75, k4); }
    orbitCam(tgt, dist, az, 0.06);
  }
}

function ch5(u, D) {
  const insert = u > 7.6 && u < 11.2;
  if (insert) {
    show(AL.g);
    const k = seg(u, 7.6, 11.2);
    AL.update(u, sstep(8.0, 10.2, u), sstep(10.0, 11, u));
    orbitCam(AL.center.clone().add(V(0, 0.5, 0)), lerp(15, 11.5, k), lerp(-0.4, 0.35, k), 0.15);
    return;
  }
  show(M.g); resetMother(); mVis({ uterus: true });
  let w; if (u < 5.5) w = lerp(28, 31, u / 5.5); else if (u < 14) w = lerp(31, 33, seg(u, 5.5, 14)); else if (u < 20.5) w = lerp(33, 36, seg(u, 14, 20.5)); else w = lerp(36, 39.5, seg(u, 20.5, D));
  const flip = Math.PI * ease(seg(u, 14.8, 19.8));
  const f = M.fetus;
  f.organs.lung = sstep(5.4, 6.2, u) * (1 - sstep(7.4, 7.6, u));
  f.organs.brain = sstep(11.3, 12, u) * (1 - sstep(14, 14.6, u)); f.organs.nerves = f.organs.brain;
  const xr = Math.max(f.organs.lung, f.organs.brain);
  f.setXray(xr * 0.8, 1);
  const pose = { legExt: 0.25 * Math.max(0, Math.sin((u - 15) * 1.3)) * sstep(15, 16, u) * (1 - sstep(19, 20, u)), nod: 0.1 * Math.sin(u * 0.5) };
  cutPlane.constant = 0;
  M.update({ w, time: u, flip, pose, fetusScale: fetusScale(w), fetusShift: V(0, -1.5 * sstep(33, 37, w), 0) });
  const uc = M.ut.localToWorld(V(0, M.cavC, 0));
  if (u < 5.5) orbitCam(uc, lerp(88, 80, u / 5.5), lerp(-0.25, 0.1, u / 5.5), 0.06);
  else if (u < 7.6) { const ch = f.toWorld(f.R.L.lungs(1)); orbitCam(uc.clone().lerp(ch, 0.6), 52, lerp(0.1, 0.2, seg(u, 5.5, 7.6)), 0.06); }
  else if (u < 14.3) { const hd = f.toWorld(f.R.L.hc); orbitCam(uc.clone().lerp(hd, 0.5), lerp(60, 56, seg(u, 11.2, 14.3)), lerp(0.25, 0.1, seg(u, 11.2, 14.3)), 0.06); }
  else { const k = ease(seg(u, 14.3, 16)); orbitCam(uc.clone().lerp(uc.clone().add(V(0, 4, 0)), k), lerp(70, 112, k) + (u > 20.5 ? (u - 20.5) * 4 : 0), lerp(0.1, -0.3, seg(u, 14.3, D)), 0.07); }
}

function ch6(u, D) {
  show(M.g); resetMother();
  mVis({ uterus: true, organs: true, skel: true, vessels: !(u > 13.6 && u < 24),  blood: u < 13, hormones: u > 10.5 && u < 30, reflux: u > 16.5 && u < 22, air: u > 24 && u < 41, column: u > 4.6 && u < 11.5 });
  // early phase uses a small uterus, then it grows from "pear" size to near term
  const grow = ease(seg(u, 30.5, 37.5));
  const w = lerp(3.2, 38, grow) * (u > 30.5 ? 1 : 0) + (u <= 30.5 ? 3.2 : 0);
  cutPlane.constant = lerp(40, 0, sstep(31, 33, u));
  M.update({ w, time: u, fetusScale: fetusScale(w) });
  U(M.utMat, 'uEmit', u > 30.5 && u < 34 ? 0.25 : 0);
  const gi = sstep(13.2, 14, u) * (1 - sstep(23.8, 24.6, u));
  U(M.giMat, 'uOpacity', 0.85 - 0.25 * gi);
  U(M.boneMat, 'uOpacity', 0.55 * (1 - 0.85 * gi)); U(M.diaMat, 'uOpacity', 0.6 * (1 - 0.9 * gi)); U(M.skinMat, 'uOpacity', 0.9 * (1 - 0.5 * gi)); U(M.lungMat, 'uOpacity', 0.55 * (1 - 0.6 * gi));
  // blood volume and cardiac output
  const vol = sstep(2.6, 4.6, u);
  const beat = Math.pow(Math.max(0, Math.sin(u * Math.PI * 2 * lerp(1.15, 1.35, sstep(5, 8, u)))), 4);
  M.heart.scale.setScalar(1 + 0.07 * beat * (1 + 0.6 * sstep(5, 8, u)));
  U(M.heartMat, 'uEmit', 0.1 + 0.5 * beat * sstep(5, 6, u));
  M.updateVessels(u, lerp(0.42, 0.72, vol), lerp(0.06, 0.1, sstep(5, 8, u)), lerp(1, 1.18, vol));
  // output columns: reference (before) and live (pregnancy, up to 1.5x)
  const base = 9, live = base * lerp(1, 1.5, ease(seg(u, 6, 9.5)));
  const cx = 24, cy = 20;
  colRef.scale.set(1, base, 1); colRef.position.set(cx, cy + base / 2, 9);   // before pregnancy
  colBase.visible = false;
  colRef2.scale.set(1, base * 1.5, 1); colRef2.position.set(cx + 1, cy + base * 0.75, 2); // glass outline, 1.5x
  colLive.scale.set(1, live, 1); colLive.position.set(cx + 1, cy + live / 2, 2);       // pregnancy, fills to 1.5x
  U(colMatLive, 'uOpacity', 0.95);
  hormones(u, sstep(10.6, 12, u) * (1 - sstep(28.5, 30, u)), 55);
  // stomach valve relaxes -> reflux, heartburn; slower digestion
  const les = sstep(13.8, 14.4, u) * (1 - sstep(22.5, 23, u));
  U(M.lesMat, 'uOpacity', les); U(M.lesMat, 'uEmit', lerp(0.9, 0.2, sstep(14.8, 16.8, u)));
  M.les.scale.setScalar(lerp(0.9, 1.35, sstep(14.8, 16.8, u)));
  U(M.lesMat, 'uColor', new THREE.Color('#f07a4a').lerp(new THREE.Color('#f3c0a0'), sstep(14.8, 16.8, u)));
  const rf = sstep(17, 18, u) * (1 - sstep(21, 22, u));
  for (let i = 0; i < 40; i++) { const r = rng(i + 33); const ph = (r() + u * 0.35) % 1; const p = V(0.6, 23 + ph * 5.5, -3.4 + (r() - 0.5) * 0.4).lerp(V(-1.2, 23 + ph * 5.5, -1.8), ph); p.x += (r() - .5) * 0.8; M.reflux.set(i, p); }
  M.reflux.commit(rf > 0.05 ? Math.floor(40 * rf) : 0);
  U(M.burnMat, 'uOpacity', sstep(18.6, 19.4, u) * (1 - sstep(21.6, 22.4, u)) * (0.6 + 0.2 * Math.sin(u * 6)));
  const dig = u < 21.5 ? 1 : lerp(1, 0.25, sstep(21.5, 23.5, u));
  M._wave = (M._wave || 0); // deterministic phase integration
  const wavePhase = u < 21.5 ? u * 4.0 : 21.5 * 4.0 + (u - 21.5) * lerp(4.0, 1.0, 0.5) - lerp(0, 1.5, sstep(21.5, 24, u));
  U(M.intMat, 'uWave', wavePhase); U(M.intMat, 'uWaveAmp', 0.28 * sstep(20.6, 21.4, u) * (1 - sstep(23.6, 24.2, u)));
  // breathing: deeper with hormones (before the belly grows), then shallow & restricted late
  const deep = sstep(24.4, 26, u);
  const late = sstep(33, 38, u);
  const rate = u > 37.5 && u < 40.5 ? 2.2 : 1.0;
  const ph = u < 37.5 ? u * 0.95 : 37.5 * 0.95 + (u - 37.5) * 0.95 * rate;
  const br = Math.sin(ph * Math.PI * 2 * 0.3);
  const amp = lerp(0.04, 0.11, deep) * (1 - late * 0.45);
  const diaY = lerp(25, 29.5, late);
  M.setDia(diaY - br * amp * 12);
  M.lungs.forEach(l => { const sy = lerp(9.5, 8.0, late) * (1 + br * amp); l.scale.set(6.0 * (1 + br * amp * 0.6), sy, 5.4 * (1 + br * amp * 0.6)); l.position.y = 43.5 - sy; });
  for (let i = 0; i < 120; i++) { const r = rng(i + 51); const k = (r() + (br > 0 ? 1 : -1) * u * 0.0 + u * 0.4 * Math.sign(Math.cos(ph * Math.PI * 2 * 0.3))) % 1; const kk = (k + 1) % 1; const side = i % 2 ? 1 : -1; const p = V(-1.5, 52 - kk * 10, 0).lerp(V(0.5, 34, side * 7), sstep(0.5, 1, kk)); p.add(V((r() - .5) * 1.2, (r() - .5) * 1.2, (r() - .5) * 1.2)); M.air.set(i, p); }
  M.air.commit(u > 24.4 && u < 41 ? Math.floor(120 * Math.min(1, deep * 1.2)) : 0);
  // organs displaced by the growing uterus
  const g2 = sstep(18, 38, w);
  M.intestine.position.set(-2.5 * g2, 9 * g2, 0); M.intestine.scale.set(1, lerp(1, 0.75, g2), lerp(1, 1.15, g2));
  const bl = sstep(39.6, 40.6, u) * (1 - sstep(42.6, 43.2, u));
  M.bladder.scale.set(lerp(2.9, 3.4, g2), lerp(2.4, 1.35, g2), lerp(3.3, 3.7, g2)); M.bladder.position.y = lerp(-5, -6.3, g2);
  U(M.bladMat, 'uEmit', bl * (0.4 + 0.25 * Math.sin(u * 6)));
  U(M.diaMat, 'uEmit', sstep(36.2, 37, u) * (1 - sstep(39.6, 40.2, u)) * 0.35); U(M.diaMat, 'uEmissive', '#ffb0a0');
  // pelvis ligaments loosen (uterus fades out so the pelvis is visible)
  M.fadeUterus(1 - sstep(42.9, 43.9, u) * 0.92);
  const lg = sstep(43, 44, u);
  U(M.jointMat, 'uOpacity', lg * (0.55 + 0.25 * Math.sin(u * 3))); U(M.ligMat, 'uOpacity', lg * 0.9);
  U(M.ligMat, 'uColor', new THREE.Color('#e8a860').lerp(new THREE.Color('#f8dcc0'), sstep(44, 47, u)));
  const open = sstep(45, 48, u) * (0.5 + 0.5 * Math.sin((u - 45) * 1.4 - Math.PI / 2));
  M.pelvis.scale.set(1, 1, 1 + 0.05 * open); M.ilia.forEach(il => il.rotation.x = 0);
  // camera
  let tgt, dist, az, el = 0.06;
  if (u < 2.6) { tgt = V(0, 18, 0); dist = 175; az = lerp(0.45, 0.3, u / 2.6); }
  else if (u < 5) { const k = ease(seg(u, 2.6, 4.2)); tgt = V(0, 18, 0).lerp(V(2, 14, 0), k); dist = lerp(175, 115, k); az = lerp(0.3, 0.2, k); }
  else if (u < 10.5) { const k = ease(seg(u, 5, 6.5)); tgt = V(2, 14, 0).lerp(V(12, 28, 0), k); dist = lerp(115, 64, k); az = lerp(0.2, 0.32, k); }
  else if (u < 13.5) { const k = ease(seg(u, 10.5, 12)); tgt = V(12, 28, 0).lerp(V(1, 16, 0), k); dist = lerp(64, 120, k); az = lerp(0.32, 0.2, k); }
  else if (u < 21) { const k = ease(seg(u, 13.5, 15)); tgt = V(1, 16, 0).lerp(V(2.5, 21, -4.5), k); dist = lerp(120, 40, k); az = lerp(0.2, -0.45, k); el = lerp(0.06, 0.12, k); }
  else if (u < 24.2) { const k = ease(seg(u, 21, 22.2)); tgt = V(2.5, 21, -4.5).lerp(V(5, 8, 0), k); dist = lerp(40, 48, k); az = lerp(-0.45, 0.15, k); }
  else if (u < 30.5) { const k = ease(seg(u, 24.2, 25.6)); tgt = V(5, 8, 0).lerp(V(1, 36, 0), k); dist = lerp(48, 85, k); az = lerp(0.15, 0.35, k); }
  else if (u < 37.5) { const k = ease(seg(u, 30.5, 32)); tgt = V(1, 36, 0).lerp(V(2, 14, 0), k); dist = lerp(85, 150, k); az = lerp(0.35, 0.12, k); }
  else if (u < 40) { const k = ease(seg(u, 37.5, 38.6)); tgt = V(2, 14, 0).lerp(V(2, 28, 0), k); dist = lerp(150, 85, k); az = 0.12; }
  else if (u < 42.8) { const k = ease(seg(u, 40, 41)); tgt = V(2, 28, 0).lerp(V(5, -4, 0), k); dist = lerp(85, 62, k); az = lerp(0.12, 0.25, k); }
  else { const k = ease(seg(u, 42.8, 44.6)); tgt = V(5, -4, 0).lerp(V(0, 0, 0), k); dist = lerp(62, 58, k); az = lerp(0.25, lerp(0.75, 1.15, seg(u, 44.6, D)), k); el = lerp(0.06, 0.28, k); }
  M.blood.mat.size = clamp(dist * 0.016, 0.6, 2.6); M.hormones.mat.size = clamp(dist * 0.014, 0.6, 2.4); M.reflux.mat.size = 1.1; M.air.mat.size = clamp(dist * 0.012, 0.5, 1.6);
  orbitCam(tgt, dist, az, el);
}

function ch7(u, D) {
  show(M.g); resetMother(); mVis({ uterus: true, skel: true });
  M.org.visible = true; M.ilia.forEach(il => il.visible = false); M.lungs.forEach(l => l.visible = false); M.heart.visible = false; M.stomach.visible = M.eso.visible = M.intestine.visible = M.dia.visible = false; M.bladder.visible = true;
  const w = lerp(38, 40, u / D);
  const low = ease(seg(u, 3.6, 7.2));
  const eff = ease(seg(u, 7.6, 12.2));
  // contractions: two irregular practice ones, then regular stronger ones
  const pulse = (c, wdt) => Math.exp(-Math.pow((u - c) / wdt, 2));
  const practice = (pulse(13.4, 0.55) * 0.35 + pulse(15.2, 0.4) * 0.25);
  let real = 0; for (const c of [17.2, 19.4, 21.6]) real += pulse(c, 0.75);
  const con = practice + real;
  const cx = sstep(7.4, 8.4, u) * (1 - sstep(12.2, 13, u));
  M.fetus.setXray(0.75 * cx, 1);
  cutPlane.constant = 0;
  M.update({ w, time: u, flip: Math.PI, eff, lower: 1.8 * low, fetusShift: V(0, -2.4 * low, 0), fetusScale: fetusScale(w), pose: { nod: 0.15 } });
  M.ut.scale.set(1 - 0.035 * con, 1 - 0.01 * con, 1 - 0.035 * con);
  // band of tightening travelling from the fundus downward
  const bandY = (() => { let best = 0, by = M.P.L; for (const [c, wd, a] of [[13.4, .55, .35], [15.2, .4, .25], [17.2, .75, 1], [19.4, .75, 1], [21.6, .75, 1]]) { const v = Math.exp(-Math.pow((u - c) / wd, 2)) * a; if (v > best) { best = v; by = lerp(M.P.L, M.P.L * 0.3, clamp((u - c + wd * 1.5) / (wd * 3))); } } return by; })();
  [M.utMat, M.capMat].forEach(m => { U(m, 'uBandAmt', con * 0.9); U(m, 'uBandY', bandY); U(m, 'uBandW', M.P.L * 0.3); U(m, 'uBandColor', '#ffb090'); });
  U(M.liningMat, 'uColor', new THREE.Color('#f4aeb0').lerp(new THREE.Color('#f9c8c4'), eff));
  U(M.capMat, 'uColor', new THREE.Color('#d97a7e'));
  const os = M.ut.localToWorld(V(0, 1.6, 0));
  if (u < 12.6) { U(M.capMat, 'uBandAmt', cx * 0.6); U(M.capMat, 'uBandY', M.prof.cle * 0.5); U(M.capMat, 'uBandW', 1.6); U(M.capMat, 'uBandColor', new THREE.Color('#ffd6d0').lerp(new THREE.Color('#ffe6ea'), eff)); }
  if (u < 7.4) orbitCam(V(3, 6, 0), lerp(118, 100, u / 7.4), lerp(0.3, 0.1, u / 7.4), 0.05);
  else if (u < 12.6) { const k = ease(seg(u, 7.4, 8.6)); orbitCam(V(3, 6, 0).lerp(os, k), lerp(100, 17, k), lerp(0.1, 0.0, k), 0.02); }
  else { const k = ease(seg(u, 12.6, 14)); orbitCam(os.clone().lerp(V(3, 10, 0), k), lerp(17, 108, k), lerp(0.0, -0.2, seg(u, 12.6, D)), 0.06); }
}

function ch8(u, D) {
  show(TL.g, BD.g); TL.setup();
  // live morph from fertilized egg to term baby
  const w = lerp(2, 40, ease(seg(u, 1.0, 19.5)));
  const pos = TL.posOf(w); const sz = TL.sizeOf(w);
  const cellPhase = w < 5.4;
  TL.cells.forEach(c => c.visible = cellPhase);
  if (cellPhase) {
    const stage = clamp((w - 2) / 2.2 * 5, 0, 5);
    // reuse the cleavage layouts
    const k = Math.floor(clamp(stage, 0, 4.999)), f = sstep(0.55, 1, stage - k); const n0 = 1 << k, n1 = Math.min(32, n0 * 2);
    TL.cells.forEach((m, i) => { const pa = STG[n0][Math.floor(i * n0 / 32)], pb = STG[n1][Math.floor(i * n1 / 32)]; m.position.copy(pa.clone().lerp(pb, f).multiplyScalar(0.9).add(pos)); m.scale.setScalar(lerp(CR[n0], CR[n1], f) * 0.6); });
    TL.live.outer.visible = false;
  } else {
    TL.live.outer.visible = true;
    TL.live.update(w, { nod: 0.05 * Math.sin(u) }, u);
    TL.live.outer.scale.setScalar(sz * sstep(5.4, 6.2, w)); TL.live.outer.position.copy(pos);
    TL.live.outer.rotation.set(0, Math.PI * 0.12 + 0.2 * Math.sin(u * 0.4), Math.PI * ease(seg(w, 33, 37)));
  }
  TL.ghosts.forEach((g, i) => { g.outer.visible = TL.weeks[i] <= w + 0.5; });
  BD.layoutArc(i => TL.posOf(i + 1).add(V(0, -9, 2)));
  BD.update(w, u, { show: sstep(0.5, 2, u), size: 0.75, triGlow: [0, 0, 0] });
  BD.spark.commit(0);
  const k = ease(seg(u, 19.5, 23.5));
  const tgt = pos.clone().lerp(V(0, -1, 0), k);
  const dist = lerp(lerp(16, 30, seg(u, 0, 19.5)), 92, k);
  orbitCam(tgt, dist, lerp(0.15, 0, k) + 0.05 * Math.sin(u * 0.3), lerp(0.12, 0.18, k));
}
const STG = (await import('./repro.js')).STAGES;
const CR = { 1: 0.98, 2: 0.6, 4: 0.5, 8: 0.42, 16: 0.34, 32: 0.2 };

const FNS = [ch1, ch2, ch3, ch4, ch5, ch6, ch7, ch8];

export function renderAt(t) {
  t = clamp(t, 0, TOTAL - 1e-6);
  let i = CHAPTERS.findIndex(c => t >= c.start && t < c.start + c.dur); if (i < 0) i = CHAPTERS.length - 1;
  const c = CHAPTERS[i]; const u = t - c.start, D = c.dur;
  cutPlane.constant = 1000;
  FNS[i](u, D);
  // title
  titleEl.textContent = c.title;
  const to = sstep(0.6, 1.4, u) * (1 - sstep(5.6, 6.6, u));
  titleBox.style.opacity = to; titleBox.style.transform = `translateX(${(1 - to) * -12}px)`;
  // dips between chapters (and inside a chapter where the shot changes rig)
  let f = 0;
  if (i === 0) f = 1 - sstep(0, 1.4, u); else f = 1 - sstep(0, 0.6, u);
  if (i < CHAPTERS.length - 1) f = Math.max(f, sstep(D - 0.5, D, u));
  const dip = (a) => Math.max(0, 1 - Math.abs(u - a) / 0.4);
  if (i === 2) f = Math.max(f, dip(22));
  if (i === 4) f = Math.max(f, dip(7.6), dip(11.2));
  fadeEl.style.opacity = f;
  // end card
  endEl.style.opacity = i === 7 ? sstep(24.8, 25.9, u) : 0;
  renderer.render(scene, camera);
}
window.M = M; window.AL = AL; window.CAM = { orbitCam, V }; window.RM = () => resetMother(); window.R3 = () => renderer.render(scene, camera); window.SC = scene; window.renderAt = renderAt; window.TOTAL = TOTAL; window.CHAPTERS = CHAPTERS;
window.ready = true;
window.dbgE = (w, dist = 4, az = 0.3) => { show(E.g); Object.assign(E.f.organs, { heart: 0, kidney: 0, lung: 0, brain: 0, bones: 0, nails: 0, nerves: 0 }); E.f.setXray(0, 1); E.update(w, 0); E.g.scale.setScalar(1); orbitCam(V(), dist, az, 0.1); renderer.render(scene, camera); };
