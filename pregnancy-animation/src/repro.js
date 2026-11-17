// Chapter 2 rig: non-pregnant reproductive system (front view), ovulation, fertilization,
// cleavage, transport, implantation and the beginning of the placenta.  Units: cm. +Z = anterior.
import * as THREE from 'three';
import { V, sstep, clamp, lerp, tissue, ell, sphereGeo, sphereLo, makeTube, setGeo, U, Particles, rng, seg, ellBetween } from './core.js';
import { uterusProfile, capGeoms, cutPlane } from './mother.js';

const fib = (n, r) => Array.from({ length: n }, (_, i) => { const y = 1 - (i + 0.5) / n * 2; const rr = Math.sqrt(1 - y * y); const th = i * 2.39996; return V(Math.cos(th) * rr * r, y * r, Math.sin(th) * rr * r); });
const STAGES = (() => {
  const s = {};
  s[1] = [V()];
  s[2] = [V(-0.5, 0, 0), V(0.5, 0, 0)];
  s[4] = [V(1, 1, 1), V(-1, -1, 1), V(-1, 1, -1), V(1, -1, -1)].map(v => v.normalize().multiplyScalar(0.62));
  s[8] = [];
  for (const x of [-1, 1]) for (const y of [-1, 1]) for (const z of [-1, 1]) s[8].push(V(x, y, z).normalize().multiplyScalar(0.62));
  s[16] = fib(12, 0.62).concat(fib(4, 0.22));
  s[32] = fib(26, 0.92).concat(fib(6, 0.32).map(v => v.add(V(0, -0.45, 0))));
  return s;
})();
const CELLR = { 1: 0.98, 2: 0.6, 4: 0.5, 8: 0.42, 16: 0.34, 32: 0.2 };

export class Repro {
  constructor() {
    this.g = new THREE.Group();
    this.P = { L: 7.5, R: 2.55, cl: 2.8, rc: 1.3, uc: 0.62, wall: 1.15, eff: 0 };
    this.prof = uterusProfile(this.P);
    this.utMat = tissue({ color: '#e99586', sss: '#c4505a', rim: '#ffd8cc', rimStr: 0.25, spec: 0.25, noise: 0.08, noiseScale: 2, emissive: '#ffd0b8' });
    this.utMat.clippingPlanes = [cutPlane];
    this.endoMat = tissue({ color: '#f6b2ac', sss: '#d87078', side: THREE.BackSide, noise: 0.18, noiseScale: 5 });
    this.endoMat.clippingPlanes = [cutPlane];
    this.utOuter = new THREE.Mesh(new THREE.LatheGeometry(this.prof.outer, 72), this.utMat);
    this.utInner = new THREE.Mesh(new THREE.LatheGeometry(this.prof.inner, 72), this.endoMat);
    this.capMat = tissue({ color: '#d97a7e', sss: '#b04450', side: THREE.DoubleSide, noise: 0.22, noiseScale: 6, spec: 0.12 });
    this.liningMat = tissue({ color: '#f4a8ac', sss: '#d87078', side: THREE.DoubleSide, noise: 0.3, noiseScale: 9, spec: 0.1 });
    this.cap = new THREE.Mesh(new THREE.BufferGeometry(), this.capMat);
    this.capL = new THREE.Mesh(new THREE.BufferGeometry(), this.liningMat);
    this.ut = new THREE.Group(); this.ut.add(this.utOuter, this.utInner, this.cap, this.capL); this.g.add(this.ut);
    // vagina
    this.vagMat = tissue({ color: '#eea596', sss: '#c8606a', rimStr: 0.3, noise: 0.1, noiseScale: 2, emissive: '#ffd0b8' });
    this.vagina = new THREE.Mesh(makeTube([V(0, 0.9, 0), V(0, -2, 0.15), V(0, -5, 0.5), V(0, -8, 0.9)], u => 1.15 + 0.15 * u, 40, 24, false, 0.55), this.vagMat);
    this.g.add(this.vagina);
    // tubes, ovaries, ligaments
    this.tubeMat = tissue({ color: '#ee9e8f', sss: '#c8606a', rimStr: 0.3, noise: 0.1, noiseScale: 4, emissive: '#ffd0b8' });
    this.ovMat = tissue({ color: '#f1cdb4', sss: '#d89a80', rimStr: 0.3, noise: 0.18, noiseScale: 3, emissive: '#ffe0c0' });
    this.tubes = []; this.ovaries = []; this.fimbriae = []; this.follicles = [];
    for (const s of [1, -1]) {
      const pts = [V(2.0, 6.3, 0), V(3.6, 7.0, 0), V(5.6, 7.5, 0.2), V(7.6, 7.2, 0.5), V(9.0, 6.0, 0.8), V(9.25, 4.7, 1.0), V(8.5, 3.75, 1.25)].map(p => V(p.x * s, p.y, p.z));
      const g = makeTube(pts, u => 0.22 + 0.22 * sstep(0.25, 0.6, u) + 0.35 * sstep(0.82, 1, u), 120, 20);
      const m = new THREE.Mesh(g, this.tubeMat); this.g.add(m); this.tubes.push(m);
      const end = g.curve.getPointAt(1), tan = g.curve.getTangentAt(1);
      const fs = [];
      for (let i = 0; i < 11; i++) {
        const f = new THREE.Mesh(sphereLo, this.tubeMat); this.g.add(f); fs.push({ m: f, i, end, tan });
      }
      this.fimbriae.push(fs);
      const ov = ell(this.ovMat, 1.75, 0.95, 1.1, V(6.3 * s, 3.3, 0.2)); ov.rotation.z = 0.35 * s; this.g.add(ov); this.ovaries.push(ov);
      const r = rng(s > 0 ? 3 : 9);
      for (let i = 0; i < 6; i++) {
        const a = r() * Math.PI * 2, b = (r() - 0.5) * 1.6;
        const p = V(Math.cos(a) * 1.55, Math.sin(b) * 0.75, Math.sin(a) * 0.95).applyAxisAngle(V(0, 0, 1), 0.35 * s).add(ov.position);
        const fo = ell(this.ovMat, 0.25 + r() * 0.15, null, null, p); this.g.add(fo);
      }
      const lig = new THREE.Mesh(makeTube([V(4.6 * s, 3.8, 0), V(3.4 * s, 4.7, -0.1), V(2.1 * s, 5.4, 0)], () => 0.22, 20, 8), this.ovMat); this.g.add(lig);
    }
    this.tubeCurve = this.tubes[0].geometry.curve; // right tube used for the journey
    // dominant follicle on the right ovary
    this.follMat = tissue({ color: '#f9e3c4', sss: '#f0b880', xray: 0.6, opacity: 0.95, rimStr: 0.5, emissive: '#ffe0a0' });
    this.foll = ell(this.follMat, 0.01, null, null, V(7.35, 4.0, 0.75)); this.g.add(this.foll);
    // egg
    this.eggG = new THREE.Group(); this.g.add(this.eggG);
    this.eggMat = tissue({ color: '#ffe2a6', sss: '#f2b860', emissive: '#fff0c8', emit: 0.25, spec: 0.4, rimStr: 0.5 });
    this.egg = ell(this.eggMat, 0.24); this.eggG.add(this.egg);
    this.zonaMat = tissue({ color: '#fff6e0', sss: '#ffe8b0', xray: 1, opacity: 0.9, rim: '#fff2d0', rimStr: 0.6, emissive: '#fff4d0', emit: 0 });
    this.zona = ell(this.zonaMat, 0.32); this.eggG.add(this.zona);
    this.corona = new Particles(90, 0.09, '#fff1cf', 0.9); this.eggG.add(this.corona.obj);
    const cr = rng(5); this.coronaPts = Array.from({ length: 90 }, () => { const d = V(cr() - .5, cr() - .5, cr() - .5).normalize(); return d.multiplyScalar(0.36 + cr() * 0.14); });
    this.pron = [ell(tissue({ color: '#ffd080', sss: '#ffb040', emissive: '#ffd890', emit: 0.8 }), 0.07), null];
    this.pron[1] = ell(this.pron[0].material, 0.07); this.pron.forEach(p => this.eggG.add(p));
    // cells (cleavage)
    this.cellMat = tissue({ color: '#ffd9b0', sss: '#f0a070', emissive: '#fff0d8', emit: 0.12, spec: 0.35, rimStr: 0.4 });
    this.cells = Array.from({ length: 32 }, () => { const m = new THREE.Mesh(sphereLo, this.cellMat); this.eggG.add(m); return m; });
    this.flash = new Particles(60, 0.12, '#fff3c0', 1); this.eggG.add(this.flash.obj);
    // sperm
    this.spermMat = tissue({ color: '#eef2fa', sss: '#b8c4e0', spec: 0.6, rimStr: 0.5 });
    this.sperm = Array.from({ length: 7 }, () => { const h = new THREE.Mesh(sphereLo, this.spermMat); const t = new THREE.Mesh(new THREE.BufferGeometry(), this.spermMat); this.g.add(h, t); return { h, t }; });
    // implantation & early placenta
    this.villiMat = tissue({ color: '#d67a86', sss: '#a03a50', emissive: '#ff9aa8', emit: 0.25, rimStr: 0.3, noise: 0.2, noiseScale: 8 });
    this.villi = []; const vr = rng(21);
    for (let i = 0; i < 34; i++) {
      const a = vr() * Math.PI * 2, rad = 0.15 + vr() * 0.65;
      const base = V(Math.cos(a) * rad * 0.45, 0, Math.sin(a) * rad * 0.12);
      const dir = V(Math.cos(a) * rad * 0.9, 1.1 + vr() * 0.6, Math.sin(a) * rad * 0.15).normalize();
      const m = new THREE.Mesh(new THREE.BufferGeometry(), this.villiMat); this.villi.push({ m, base, dir, len: 0.5 + vr() * 0.6, ph: vr() * 6, kink: V(vr() - .5, vr() - .5, vr() - .5) });
    }
    this.site = new THREE.Group(); this.ut.add(this.site);
    this.villi.forEach(v => this.site.add(v.m));
    this.discMat = tissue({ color: '#c96a78', sss: '#8a3048', noise: 0.08, noiseScale: 3, side: THREE.DoubleSide, opacity: 0.95, transparent: true });
    this.disc = ell(this.discMat, 1, 1, 1); this.site.add(this.disc);
    this.flowO = new Particles(90, 0.12, '#7fd3f0', 0.95); this.flowN = new Particles(90, 0.12, '#ffcf6a', 0.95); this.flowW = new Particles(60, 0.11, '#9a86b8', 0.9);
    this.hormone = new Particles(70, 0.2, '#b394ec', 0.9);
    this.site.add(this.flowO.obj, this.flowN.obj, this.flowW.obj); this.g.add(this.hormone.obj);
    // implant point (posterior inner wall, uterus local)
    const top = this.P.L - this.P.wall;
    this.siteY = top - 0.12;
    this.site.position.set(0.25, this.siteY, 0.22);
  }
  highlight(arr, v) { arr.forEach(m => U(m, 'uEmit', v)); }
  cut(c, lining = 0.55) {
    cutPlane.constant = c;
    const show = c < 6; this.cap.visible = this.capL.visible = show;
    if (show) { const r = capGeoms(this.prof, this.P.wall, c, lining); setGeo(this.cap, r[0]); setGeo(this.capL, r[1]); this.cap.position.z = r[2]; this.capL.position.z = r[2] + 0.01; }
  }
  // stage: number of cells as a continuous value in [0,5] (0=1 cell .. 5=blastocyst)
  setCells(stage, visible) {
    const k = Math.floor(clamp(stage, 0, 4.999)), f = sstep(0.55, 1, stage - k);
    const n0 = 1 << k, n1 = Math.min(32, n0 * 2);
    const A = STAGES[n0], B = STAGES[n1];
    const s = 0.27;
    this.cells.forEach((m, i) => {
      m.visible = visible;
      const ia = Math.floor(i * n0 / 32), ib = Math.floor(i * n1 / 32);
      const pa = A[ia], pb = B[ib];
      const p = pa.clone().lerp(pb, f).multiplyScalar(s * lerp(1, 1.0 + 0.15 * (n1 === 32), f));
      const r = lerp(CELLR[n0], CELLR[n1], f) * s * 0.62;
      m.position.copy(p); m.scale.setScalar(r);
      // blastocyst: outer cells flatten
      if (n1 === 32 && f > 0.5 && ib < 26) m.scale.set(r * 1.05, r * 1.05, r * 0.65), m.lookAt(V());
      else m.rotation.set(0, 0, 0);
    });
  }
  update(t, o) {
    // fimbriae waving
    for (const fs of this.fimbriae) for (const f of fs) {
      const a = f.i / fs.length * Math.PI * 2; const tan = f.tan;
      const side = V(0, 0, 1).cross(tan).normalize(); const up = tan.clone().cross(side).normalize();
      const rad = side.clone().multiplyScalar(Math.cos(a)).addScaledVector(up, Math.sin(a));
      const base = f.end.clone().addScaledVector(rad, 0.55);
      const wave = Math.sin(t * 2.2 + f.i) * 0.25 + (o.sweep || 0) * 0.5;
      const dir = tan.clone().multiplyScalar(0.8).addScaledVector(rad, 0.9 + wave).normalize();
      ellBetween(f.m, base, base.clone().addScaledVector(dir, 0.75), 0.12);
    }
  }
}
export { STAGES };
