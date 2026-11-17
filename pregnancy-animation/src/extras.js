// Embryo close-up rig, symptom icons, week beads, alveoli insert, summary timeline.
import * as THREE from 'three';
import { V, sstep, clamp, lerp, tissue, ell, sphereGeo, sphereLo, makeTube, setGeo, U, Particles, rng, table } from './core.js';
import { Fetus, CRL } from './fetus.js';
import { STAGES } from './repro.js';

// ---------- embryo close-up (normalized units) ----------
export class EmbryoRig {
  constructor() {
    this.g = new THREE.Group();
    this.f = new Fetus(88); this.g.add(this.f.outer);
    U(this.f.mat, 'uColor', '#f4c0ae'); U(this.f.mat, 'uSss', '#e2707a');
    this.amnMat = tissue({ color: '#d6ecf6', sss: '#a6d0e6', xray: 1, opacity: 0.7, rim: '#c6e6f6', rimStr: 0.35 });
    this.amnion = ell(this.amnMat, 1); this.g.add(this.amnion);
    this.chorMat = tissue({ color: '#f1d2c8', sss: '#d89a90', xray: 1, opacity: 0.6, rim: '#f0c0b0', rimStr: 0.45, noise: 0.5, noiseScale: 9 });
    this.chorion = ell(this.chorMat, 1); this.g.add(this.chorion);
    this.villiMat = tissue({ color: '#efc0b8', sss: '#d08080', opacity: 0.75, transparent: true, depthWrite: false });
    const geo = new THREE.SphereGeometry(1, 10, 8);
    this.villi = new THREE.InstancedMesh(geo, this.villiMat, 700); this.g.add(this.villi); this.villi.visible = false;
    const r = rng(4); this.villiDirs = [];
    for (let i = 0; i < 700; i++) { const d = V(r() - .5, r() - .5, r() - .5).normalize(); if (d.x > -0.1) d.x = -d.x - 0.2; if (d.z > 0) d.z *= -1; d.normalize(); this.villiDirs.push([d, 0.6 + r() * 0.6]); }
    this.yolkMat = tissue({ color: '#f6dc9a', sss: '#e0b060', rimStr: 0.4, opacity: 0.95, transparent: true });
    this.yolk = ell(this.yolkMat, 1); this.g.add(this.yolk);
    this.stalkMat = tissue({ color: '#dcdff0', sss: '#9aa4d4', spec: 0.4 });
    this.stalk = new THREE.Mesh(new THREE.BufferGeometry(), this.stalkMat); this.g.add(this.stalk);
    this.yolkDuct = new THREE.Mesh(new THREE.BufferGeometry(), this.yolkMat); this.g.add(this.yolkDuct);
    this.urine = new Particles(30, 0.025, '#f2c24a', 1); this.f.rig.add(this.urine.obj);
  }
  update(w, t, pose = {}) {
    const f = this.f; f.update(w, pose, t);
    f.outer.scale.setScalar(1); f.outer.rotation.set(0, 0, 0);
    f.outer.updateMatrixWorld(true);
    const amnR = table([[5.5, 0.85], [8, 0.8], [10, 0.85], [13, 0.9]], w);
    this.amnion.scale.setScalar(amnR); this.amnion.position.set(0.05, 0, 0);
    const chR = table([[5.5, 2.2], [8, 1.6], [10, 1.25], [13, 1.05]], w);
    this.chorion.scale.setScalar(chR);
    // villi on the chorion (becoming the placenta on one side)
    const m4 = new THREE.Matrix4();
    this.villiDirs.forEach(([d, s], i) => {
      const frond = d.x < -0.45 ? 1 : (1 - sstep(8, 11, w)) * 0.7;
      const sc = 0.022 * s * chR * frond + 1e-4;
      m4.compose(d.clone().multiplyScalar(chR * 1.01), new THREE.Quaternion(), V(sc, sc, sc)); this.villi.setMatrixAt(i, m4);
    });
    this.villi.instanceMatrix.needsUpdate = true;
    // yolk sac (outside the amnion), shrinks relative to the growing embryo
    const ys = clamp(0.3 * Math.pow(CRL(6.5) / CRL(w), 0.55), 0.06, 0.32) * (1 - sstep(11, 13, w) * 0.6);
    const yp = V(0.15, -amnR - ys * 1.3, 0.55);
    this.yolk.scale.setScalar(ys); this.yolk.position.copy(yp);
    // connecting stalk / early cord from embryo to chorion wall (posterior, -x)
    const cordP = f.toWorld(f.R.L.cord);
    const wall = V(-chR * 0.98, 0.1, -0.1);
    setGeo(this.stalk, makeTube([cordP, cordP.clone().lerp(wall, 0.4).add(V(0, 0.25, 0.2)), cordP.clone().lerp(wall, 0.75).add(V(0, -0.1, 0.1)), wall], () => 0.03 + 0.015 * sstep(8, 12, w), 40, 8));
    const mid = cordP.clone().lerp(wall, 0.35);
    setGeo(this.yolkDuct, makeTube([mid, mid.clone().lerp(yp, 0.5).add(V(0.1, 0, 0.1)), yp], () => 0.016, 20, 6));
    this.yolkDuct.visible = this.yolk.visible = ys > 0.05;
  }
}

// ---------- symptom icons (3D, no text) ----------
export class Icons {
  constructor() {
    this.g = new THREE.Group();
    const glowMat = (c) => tissue({ color: c, sss: c, emissive: c, emit: 0.35, spec: 0.5, rimStr: 0.5, opacity: 1, transparent: true });
    // nausea swirl
    this.nMat = glowMat('#8fcfa0');
    const sp = []; for (let i = 0; i <= 60; i++) { const a = i / 60 * Math.PI * 4.2; const r = 0.4 + i / 60 * 2.6; sp.push(V(Math.cos(a) * r, Math.sin(a) * r, i / 60 * 0.6)); }
    this.nausea = new THREE.Mesh(makeTube(sp, u => 0.22 + 0.28 * u, 160, 10), this.nMat);
    // moon (fatigue)
    this.mMat = glowMat('#b9b2ee');
    const sh = new THREE.Shape(); sh.absarc(0, 0, 3, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(1.5, 0.9, 2.6, 0, Math.PI * 2, true);
    // crescent via two arcs
    const cres = new THREE.Shape();
    cres.absarc(0, 0, 3, Math.PI * 0.32, Math.PI * 1.68, false);
    cres.absarc(1.35, 0, 2.35, Math.PI * 1.55, Math.PI * 0.45, true);
    this.moon = new THREE.Mesh(new THREE.ExtrudeGeometry(cres, { depth: 0.8, bevelEnabled: true, bevelThickness: 0.35, bevelSize: 0.3, bevelSegments: 4, curveSegments: 40 }), this.mMat);
    this.moon.geometry.center();
    this.stars = [0, 1, 2].map(i => { const s = ell(this.mMat, 0.35); return s; });
    // tenderness pulse rings
    this.rMat = glowMat('#f2a0b4');
    this.rings = [0, 1, 2].map(() => new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 10, 48), this.rMat));
    // appetite (apple)
    this.aMat = glowMat('#f2b46a'); this.lMat = glowMat('#8fcf8a');
    const ap = []; for (let i = 0; i <= 24; i++) { const t = i / 24; const a = t * Math.PI; ap.push(new THREE.Vector2(Math.max(0.01, Math.sin(a) * (1.9 + 0.35 * Math.sin(a * 2))), -Math.cos(a) * 1.8 + (t < 0.08 || t > 0.92 ? 0.25 * Math.sign(t - 0.5) * -1 : 0))); }
    this.apple = new THREE.Group();
    this.apple.add(new THREE.Mesh(new THREE.LatheGeometry(ap, 32), this.aMat));
    const stem = new THREE.Mesh(makeTube([V(0, 1.4, 0), V(0.1, 2.1, 0), V(0.35, 2.6, 0)], () => 0.14, 10, 6), this.lMat); this.apple.add(stem);
    const leaf = ell(this.lMat, 0.75, 0.32, 0.12, V(0.85, 2.3, 0)); leaf.rotation.z = 0.5; this.apple.add(leaf);
    this.g.add(this.nausea, this.moon, ...this.stars, ...this.rings, this.apple);
  }
  // a: [nausea, fatigue, tender, appetite] appearance 0..1; positions in mother space
  update(t, a) {
    const pop = x => sstep(0, 0.6, x) * (1 + 0.15 * Math.sin(Math.PI * clamp(x / 0.6)));
    const bob = (i) => Math.sin(t * 1.6 + i) * 0.6;
    this.nausea.position.set(16, 20 + bob(0), 10); this.nausea.rotation.set(0.3, -0.5, t * 1.2); this.nausea.scale.setScalar(pop(a[0]) * 1.1 + 1e-4);
    this.moon.position.set(17, 66 + bob(1), 6); this.moon.rotation.set(0.1, -0.6 + Math.sin(t) * 0.15, -0.3); this.moon.scale.setScalar(pop(a[1]) * 1.05 + 1e-4);
    this.stars.forEach((s, i) => { s.position.set(21 + i * 2.4, 70 - i * 3 + bob(i + 2) * 0.5, 5); s.scale.setScalar((0.25 + 0.15 * Math.sin(t * 3 + i * 2)) * pop(a[1]) + 1e-4); });
    this.rings.forEach((r, i) => {
      const ph = (t * 0.6 + i / 3) % 1; r.position.set(12, 30, 9); r.rotation.set(0, Math.PI / 2 - 0.3, 0);
      r.scale.setScalar((2 + ph * 8) * pop(a[2]) + 1e-4); r.material = this.rMat;
    });
    U(this.rMat, 'uOpacity', 0.85 * pop(a[2]) * 0.8);
    this.apple.position.set(19, 46 + bob(3), 8); this.apple.rotation.set(0.2, t * 0.8, 0.1); this.apple.scale.setScalar(pop(a[3]) * 1.15 + 1e-4);
    this.g.visible = Math.max(...a) > 0;
  }
}

// ---------- 40 week beads ----------
export const TRI_COLORS = ['#f0aa86', '#e9839a', '#a28fd6'];
export class Beads {
  constructor(radius = 55) {
    this.g = new THREE.Group(); this.beads = [];
    for (let i = 0; i < 40; i++) {
      const tri = i < 13 ? 0 : i < 27 ? 1 : 2;
      const c = i < 2 ? '#d9d2cb' : TRI_COLORS[tri];
      const m = tissue({ color: c, sss: c, emissive: c, emit: 0, spec: 0.6, rimStr: 0.5, opacity: 1, transparent: true });
      const b = ell(m, 1); this.g.add(b); this.beads.push({ b, m, tri });
    }
    this.spark = new Particles(50, 1.6, '#fff1c0', 1); this.g.add(this.spark.obj);
  }
  // layout on a ring (ch1) or an arc (ch8)
  layoutRing(R, y) { this.beads.forEach((o, i) => { const gap = (o.tri) * 0.09; const a = -Math.PI * 0.5 + (i / 40) * Math.PI * 2 * 0.86 + gap; o.b.position.set(Math.cos(a) * R, y, Math.sin(a) * R); o.base = 1.6; }); }
  layoutArc(fn) { this.beads.forEach((o, i) => { o.b.position.copy(fn(i)); }); }
  update(lit, t, opts = {}) {
    // lit: number of beads lit (float); triGlow: [a,b,c]
    const tg = opts.triGlow || [0, 0, 0];
    this.beads.forEach((o, i) => {
      const on = clamp(lit - i);
      const s = (opts.size || 1.6) * (0.55 + 0.45 * on) * (1 + 0.35 * tg[o.tri]) * (opts.show ?? 1);
      o.b.scale.setScalar(s + 1e-4);
      U(o.m, 'uEmit', 0.15 + 0.6 * on + 0.6 * tg[o.tri]);
      U(o.m, 'uOpacity', (0.35 + 0.65 * on) * (opts.show ?? 1));
    });
  }
}

// ---------- alveoli insert ----------
export class Alveoli {
  constructor() {
    this.g = new THREE.Group();
    this.mat = tissue({ color: '#f3b4bc', sss: '#d87a8c', opacity: 0.85, transparent: true, rimStr: 0.45, noise: 0.1, noiseScale: 3 });
    this.film = tissue({ color: '#ffd88a', sss: '#ffc060', xray: 1, opacity: 0, rim: '#ffe2a0', rimStr: 0.9, emissive: '#ffe0a0', emit: 0.2 });
    this.bronchMat = tissue({ color: '#efb0b4', sss: '#d07888', rimStr: 0.4 });
    this.sacs = []; this.films = [];
    const r = rng(12);
    const ends = [];
    const branch = (p, d, depth, rad) => {
      const len = 3.2 * Math.pow(0.72, depth);
      const q = p.clone().addScaledVector(d, len);
      const m = new THREE.Mesh(makeTube([p, p.clone().lerp(q, 0.5).add(V(r() - .5, r() - .5, r() - .5).multiplyScalar(0.2)), q], u => rad * (1 - 0.25 * u), 16, 12), this.bronchMat); this.g.add(m);
      if (depth >= 3) { ends.push([q, d]); return; }
      for (const s of [-1, 1]) { const nd = d.clone().applyAxisAngle(V(r() - .5, r() - .5, r() - .5).normalize(), 0.55 * s + (r() - .5) * 0.3).normalize(); branch(q, nd, depth + 1, rad * 0.75); }
    };
    branch(V(0, 6, 0), V(0, -1, 0), 0, 0.55);
    for (const [q, d] of ends) {
      const n = 9 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const dir = d.clone().add(V(r() - .5, r() - .5, r() - .5).multiplyScalar(1.8)).normalize();
        const p = q.clone().addScaledVector(dir, 0.55 + r() * 0.25);
        const s = ell(this.mat, 0.42 + r() * 0.1, null, null, p); this.g.add(s); this.sacs.push({ s, base: s.scale.x, ph: r() * 6 });
        const f = ell(this.film, 1, null, null, p); this.g.add(f); this.films.push(f);
      }
    }
    this.center = V(); this.sacs.forEach(o => this.center.add(o.s.position)); this.center.multiplyScalar(1 / this.sacs.length);
    this.parts = new Particles(160, 0.09, '#ffd27a', 1); this.g.add(this.parts.obj);
    this.pseeds = Array.from({ length: 160 }, (_, i) => [Math.floor(r() * this.sacs.length), V(r() - .5, r() - .5, r() - .5).normalize(), r()]);
  }
  update(t, surf, breathe) {
    this.sacs.forEach((o, i) => { const k = 1 + breathe * 0.12 * Math.sin(t * 2.2 + o.ph * 0.2); o.s.scale.setScalar(o.base * k); this.films[i].scale.setScalar(o.base * k * 1.06); });
    U(this.film, 'uOpacity', surf * 0.9); U(this.film, 'uEmit', 0.25 * surf);
    this.pseeds.forEach(([si, d, ph], i) => {
      const o = this.sacs[si]; const prog = (ph + t * 0.25) % 1;
      const p = o.s.position.clone().addScaledVector(d, o.s.scale.x * lerp(1.9, 1.05, prog));
      if (surf > 0.02 && surf < 0.98 || (surf > 0 && prog < surf)) this.parts.set(i, p); else this.parts.hide(i);
    });
    this.parts.commit();
  }
}

// ---------- summary timeline ----------
export class Timeline {
  constructor() {
    this.g = new THREE.Group();
    this.weeks = [6.5, 9, 13, 20, 28, 40];
    this.ghosts = this.weeks.map(w => { const f = new Fetus(60); this.g.add(f.outer); return f; });
    this.ghostMat = tissue({ color: '#f2c2b0', sss: '#e08070', xray: 0.85, opacity: 0.85, rim: '#f0b8a8', rimStr: 0.5 });
    this.live = new Fetus(80); this.g.add(this.live.outer);
    this.cellMat = tissue({ color: '#ffd9b0', sss: '#f0a070', emissive: '#fff0d8', emit: 0.15, spec: 0.35, rimStr: 0.4 });
    this.cells = Array.from({ length: 32 }, () => { const m = new THREE.Mesh(sphereLo, this.cellMat); this.g.add(m); return m; });
    this.ghostCells = [];
    this.init = false;
    this.path = new THREE.CatmullRomCurve3([V(34, -3, -6), V(22, 0.5, 0), V(8, 2, 3), V(-8, 2, 3), V(-22, 0.5, 0), V(-36, -3, -6)]);
  }
  sizeOf(w) { return 1.6 + 9.5 * Math.pow(CRL(Math.max(w, 5.5)) / 36, 0.7); }
  posOf(w) { const u = w <= 4 ? lerp(0, 0.1, w / 4) : lerp(0.1, 1, Math.pow((w - 4) / 36, 0.85)); return this.path.getPointAt(clamp(u)); }
  setup() {
    if (this.init) return; this.init = true;
    this.ghosts.forEach((f, i) => {
      const w = this.weeks[i]; f.xr = 1; f.update(w, {}, 0);
      f.mat = this.ghostMat; f.blob.mc.material = this.ghostMat;
      f.rig.traverse(o => { if (o.isMesh && o.material === f.extraMat) o.material = this.ghostMat; });
      f.outer.scale.setScalar(this.sizeOf(w)); f.outer.position.copy(this.posOf(w)).add(V(0, 0, -4));
      f.outer.rotation.set(0, Math.PI * 0.12, w >= 36 ? Math.PI : 0);
    });
  }
}
