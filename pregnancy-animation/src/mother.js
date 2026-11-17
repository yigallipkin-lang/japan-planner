// Mother: translucent body shell, skeleton, organs, uterus with placenta, amnion, cord and fetus.
// Units: cm. Origin: centre of pelvis. +X = anterior (she faces +X), +Y = up, Z = lateral (-Z = her left).
import * as THREE from 'three';
import { V, table, sstep, clamp, lerp, tissue, Blob, ell, sphereGeo, makeTube, setGeo, U, Particles, rng, ellBetween } from './core.js';
import { Fetus, CRL } from './fetus.js';

export const cutPlane = new THREE.Plane(V(0, 0, -1), 1000); // keeps z <= constant
const smax = (a, b, k) => (a + b + Math.sqrt((a - b) * (a - b) + k * k)) / 2;

// ---- uterus profile ----
export function uterusParams(w) {
  const preg = sstep(3.5, 14, w);
  return {
    L: table([[3, 7.5], [6, 8.4], [8, 9.8], [12, 12.5], [16, 16], [20, 22], [24, 26], [28, 30], [32, 34], [36, 38], [40, 38.5]], w),
    R: table([[3, 2.4], [6, 3.0], [8, 3.8], [12, 5.3], [16, 7.0], [20, 9.2], [24, 10.8], [28, 12.3], [32, 13.4], [36, 14.4], [40, 14.9]], w),
    cl: lerp(2.8, 3.4, preg), rc: lerp(1.3, 1.7, preg), uc: lerp(0.62, 0.5, preg),
    wall: table([[3, 1.0], [12, 1.0], [20, 0.85], [40, 0.7]], w),
    tilt: lerp(0.8, 0.33, sstep(4, 16, w)), eff: 0,
  };
}
export function uterusProfile(P) {
  const { L, R, cl, rc, uc, wall } = P; const eff = P.eff || 0;
  const cle = lerp(cl, 0.9, eff);
  const yc = cle + uc * (L - cle), a1 = (yc - cle) + 0.35, a2 = L - yc;
  const re = (y, Rr, A1, A2, Y) => { const a = y < Y ? A1 : A2; const q = (y - Y) / a; return Rr * Math.sqrt(Math.max(0, 1 - q * q)); };
  const outer = [], inner = [];
  const N = 72;
  const rcx = rc * lerp(1, 1.12, eff);
  for (let i = 0; i <= N; i++) {
    const y = L * i / N;
    let rcv = rcx * (0.5 + 0.5 * Math.sqrt(clamp(y / (0.5 * rcx))));
    let r = y < cle ? rcv : smax(rcx, re(y, R, a1, a2, yc), 0.9);
    if (y >= cle) r = Math.min(r, re(y, R, a1 * 5, a2, yc) + 0.0001) ; // close the top
    if (i === N) r = 0.0001;
    outer.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  const top = L - wall;
  for (let i = 0; i <= N; i++) {
    const y = top * i / N;
    const can = 0.14 + eff * 1.1 * Math.pow(clamp(y / cle), 2.2) * rcx * 0.8;
    let r = y < cle ? can : smax(can, re(y, R - wall, a1 - wall * 0.5, a2 - wall, yc), 0.6);
    if (i === N) r = 0.0001;
    inner.push(new THREE.Vector2(Math.max(r, 0.0001), y));
  }
  return { outer, inner, yc, cle, rAt: y => { const i = clamp(Math.round(y / top * N), 0, N); return inner[i].x; } };
}

export function capGeoms(prof, wallW, c, liningFrac) {
  const z = Math.max(c, 0) - 0.02;
  const half = (r) => Math.sqrt(Math.max(0, r * r - z * z));
  const contour = (pts, add = 0) => { const right = [], left = []; for (const p of pts) { const h = half(p.x + add); if (h > 0.01) { right.push(new THREE.Vector2(h, p.y)); left.push(new THREE.Vector2(-h, p.y)); } } return right.concat(left.reverse()); };
  const o = contour(prof.outer), im = contour(prof.inner, wallW * liningFrac), i = contour(prof.inner);
  const mk = (outerC, holeC) => { if (outerC.length < 3) return new THREE.BufferGeometry(); const sh = new THREE.Shape(outerC); if (holeC.length > 3) sh.holes.push(new THREE.Path(holeC)); return new THREE.ShapeGeometry(sh, 1); };
  return [mk(o, im), mk(im, i), z];
}
const SPINE = [V(-5.5, -3, 0), V(-4.5, 5, 0), V(-3.8, 12, 0), V(-4, 18, 0), V(-6, 26, 0), V(-7.6, 33, 0), V(-7, 40, 0), V(-4.5, 47, 0), V(-2.5, 53, 0)];

export class Mother {
  constructor() {
    this.g = new THREE.Group();
    // body shell
    this.skinMat = tissue({ color: '#f5d2bf', sss: '#e9a48c', rim: '#d99c86', rimStr: 0.55, xray: 1, opacity: 0.9, spec: 0.3, noise: 0.03, noiseScale: 0.2 });
    this.blob = new Blob(110, 174, this.skinMat, 45000);
    this.blob.mc.position.set(0, -7, 0);
    this.g.add(this.blob.mc);
    this.lastBelly = '';
    this.kick = V(0, 0, 0); this.kickAmt = 0;

    // skeleton
    this.boneMat = tissue({ color: '#efe6d4', sss: '#d8c7a6', opacity: 0.55, transparent: true, depthWrite: false, rimStr: 0.3 });
    this.skel = new THREE.Group(); this.g.add(this.skel);
    const spineCurve = new THREE.CatmullRomCurve3(SPINE);
    this.spineCurve = spineCurve;
    for (let i = 0; i < 24; i++) {
      const u = i / 23; const p = spineCurve.getPointAt(u);
      const m = ell(this.boneMat, 2.0 - u * 0.6, 1.05, 2.0 - u * 0.6, p); this.skel.add(m);
    }
    this.ribs = [];
    for (let i = 0; i < 10; i++) for (const s of [1, -1]) {
      const y0 = 44 - i * 2.15;
      const pts = [V(-7.2, y0, s * 1.5), V(-5, y0 - 0.5, s * 8.5), V(1, y0 - 2.4, s * 12), V(7.5, y0 - 4.2 - i * 0.25, s * 8.8 * (1 - i * 0.02))];
      if (i < 7) pts.push(V(10.2, y0 - 5.5 - i * 0.35, s * 2.2));
      const m = new THREE.Mesh(makeTube(pts, () => 0.55, 40, 8), this.boneMat); this.skel.add(m); this.ribs.push(m);
    }
    const sternum = ell(this.boneMat, 0.9, 6.5, 1.6, V(10.6, 36.5, 0)); sternum.rotation.z = -0.12; this.skel.add(sternum);
    // pelvis
    this.pelvis = new THREE.Group(); this.skel.add(this.pelvis);
    this.ilia = [];
    const ilG = new THREE.SphereGeometry(1, 28, 16, 0.2, 2.2, 0.35, 1.35);
    this.boneMat2 = tissue({ color: '#efe6d4', sss: '#d8c7a6', opacity: 0.5, transparent: true, depthWrite: false, rimStr: 0.3, side: THREE.DoubleSide });
    for (const s of [1, -1]) { const w = new THREE.Mesh(ilG, this.boneMat2); w.scale.set(7.5, 8, 8.5 * s); w.position.set(-1, -0.5, 0); this.pelvis.add(w); this.ilia.push(w); }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(6.5, 1.25, 16, 64), this.boneMat);
    ring.position.set(1, -2, 0); ring.rotation.set(0, 0, 0); ring.rotateZ(-0.9); ring.rotateX(-Math.PI / 2); this.pelvis.add(ring); this.ring = ring;
    const sac = ell(this.boneMat, 2.2, 6, 3.8, V(-5.6, -1, 0)); sac.rotation.z = 0.45; this.pelvis.add(sac);
    // joint glows (pubic symphysis, sacroiliac)
    this.jointMat = tissue({ color: '#f3a35f', sss: '#f3a35f', emissive: '#ffb070', emit: 0.8, opacity: 0, transparent: true, depthWrite: false });
    this.joints = [ell(this.jointMat, 1.4, 2.2, 1.6, V(5.0, -7.1, 0)), ell(this.jointMat, 1.3, 2.4, 1.3, V(-4.2, 2, 4.3)), ell(this.jointMat, 1.3, 2.4, 1.3, V(-4.2, 2, -4.3))];
    this.joints.forEach(j => this.pelvis.add(j));
    // ligament bands
    this.ligMat = tissue({ color: '#f0c48a', sss: '#e6a060', emissive: '#ffcc88', emit: 0.2, opacity: 0, transparent: true, depthWrite: false });
    this.ligs = [];
    for (const s of [1, -1]) {
      for (const pts of [[V(-4.5, 4, s * 3), V(-2, 3, s * 7), V(0, 4, s * 10)], [V(-5.5, -4, s * 2), V(-2, -6, s * 4), V(2, -6.5, s * 5)]]) {
        const m = new THREE.Mesh(makeTube(pts, () => 0.45, 24, 8), this.ligMat); this.pelvis.add(m); this.ligs.push(m);
      }
    }

    // organs
    this.org = new THREE.Group(); this.g.add(this.org);
    this.lungMat = tissue({ color: '#f2b2b8', sss: '#d87c8c', opacity: 0.55, transparent: true, depthWrite: false, rimStr: 0.4, noise: 0.15, noiseScale: 0.8 });
    this.lungs = [1, -1].map(s => { const m = ell(this.lungMat, 6.0, 9.5, 5.4, V(0.2, 34, s * 7)); this.org.add(m); return m; });
    this.heartMat = tissue({ color: '#de6f78', sss: '#b8404e', emissive: '#ff8090', emit: 0.1, spec: 0.35 });
    this.heart = new THREE.Group(); this.heart.position.set(4, 29.5, -1.5); this.org.add(this.heart);
    const hg = new THREE.LatheGeometry(Array.from({ length: 25 }, (_, i) => { const t = i / 24; return new THREE.Vector2(Math.max(0.001, Math.sin(Math.PI * Math.pow(t, 0.8)) * (1 - 0.35 * t) * 3.0), -3.6 + t * 6.6); }), 32);
    this.heartMesh = new THREE.Mesh(hg, this.heartMat); this.heartMesh.rotation.z = 2.3; this.heartMesh.rotation.x = 0.3; this.heart.add(this.heartMesh);
    // diaphragm dome
    this.diaMat = tissue({ color: '#e99a8c', sss: '#c86a60', opacity: 0.6, transparent: true, depthWrite: false, side: THREE.DoubleSide, rimStr: 0.3 });
    this.dia = new THREE.Mesh(new THREE.SphereGeometry(14, 48, 16, 0, Math.PI * 2, 0, 0.95), this.diaMat); this.org.add(this.dia);
    this.dia.scale.set(1, 0.85, 1.05); this.setDia(25);
    // esophagus + stomach
    this.giMat = tissue({ color: '#f1b691', sss: '#d98060', opacity: 0.85, transparent: true, depthWrite: false, rimStr: 0.35, noise: 0.08, noiseScale: 0.6 });
    this.eso = new THREE.Mesh(makeTube([V(-3, 50, 0), V(-2.6, 40, -0.5), V(-1.2, 30, -1.5), V(0.5, 23.2, -3.5)], () => 0.85, 40, 10), this.giMat); this.org.add(this.eso);
    this.stomach = new THREE.Mesh(makeTube([V(0.5, 23.2, -3.5), V(2.2, 21.5, -6.5), V(4.8, 18, -7.6), V(7.4, 15.6, -5.4), V(8.6, 15.8, -2), V(8.2, 17.2, 1.4)], u => 1.0 + 2.4 * Math.sin(Math.PI * Math.min(1, u * 1.15)) * (1 - 0.5 * u) + 0.3, 48, 18), this.giMat); this.org.add(this.stomach);
    this.lesMat = tissue({ color: '#f08a5a', sss: '#f08a5a', emissive: '#ff9a5a', emit: 0.0, opacity: 0, transparent: true, depthWrite: false });
    this.les = new THREE.Mesh(new THREE.TorusGeometry(1.15, 0.38, 12, 32), this.lesMat); this.les.position.set(0.45, 23.4, -3.4); this.les.rotation.x = Math.PI / 2; this.les.rotation.z = 0.3; this.org.add(this.les);
    this.reflux = new Particles(40, 0.9, '#f2b950', 0.9); this.org.add(this.reflux.obj);
    this.burnMat = tissue({ color: '#ff8a50', sss: '#ff8a50', emissive: '#ff7040', emit: 1, opacity: 0, transparent: true, depthWrite: false });
    this.burn = ell(this.burnMat, 2.2, 5, 2.2, V(-1.0, 29, -1.6)); this.org.add(this.burn);
    // intestines
    const ip = []; const r = rng(7);
    for (let k = 0; k < 7; k++) { const y = 13 - k * 2.0; const s = k % 2 ? 1 : -1; ip.push(V(3 + 3 * Math.sin(k * 1.7), y, s * 6.5), V(6 + 2 * Math.cos(k), y - 0.6, s * 0.5), V(3.5 + 2 * Math.sin(k * 2.3), y - 1.0, -s * 6.0)); }
    this.intBase = ip;
    this.intMat = tissue({ uv: true, color: '#f3c4a6', sss: '#e09a7c', opacity: 0.7, transparent: true, depthWrite: false, rimStr: 0.35, noise: 0.06 });
    this.intestine = new THREE.Mesh(makeTube(ip, () => 1.15, 300, 10), this.intMat); this.org.add(this.intestine);
    U(this.intMat, 'uWaveFreq', 90);
    // bladder
    this.bladMat = tissue({ color: '#f3d58a', sss: '#d8b050', opacity: 0.75, transparent: true, depthWrite: false, rimStr: 0.4, emissive: '#ffd070', emit: 0 });
    this.bladder = ell(this.bladMat, 2.9, 2.4, 3.3, V(6.6, -5.0, 0)); this.org.add(this.bladder);
    // vessels + blood particles
    this.artMat = tissue({ color: '#e07a84', sss: '#c04a58', opacity: 0.35, transparent: true, depthWrite: false, rimStr: 0.3 });
    this.venMat = tissue({ color: '#9aa2d6', sss: '#6c76b8', opacity: 0.35, transparent: true, depthWrite: false, rimStr: 0.3 });
    this.aorta = new THREE.Mesh(new THREE.BufferGeometry(), this.artMat); this.org.add(this.aorta);
    this.vena = new THREE.Mesh(new THREE.BufferGeometry(), this.venMat); this.org.add(this.vena);
    this.blood = new Particles(700, 1.7, '#e0606e', 1); this.org.add(this.blood.obj);
    this.bloodSeeds = Array.from({ length: 700 }, (_, i) => [rng(i + 11)(), rng(i * 7 + 3)()]);
    this.hormones = new Particles(160, 1.4, '#a98be6', 0.9); this.g.add(this.hormones.obj);
    this.air = new Particles(120, 1.0, '#9fd8f2', 0.8); this.org.add(this.air.obj);

    // uterus
    this.ut = new THREE.Group(); this.g.add(this.ut);
    this.utMat = tissue({ color: '#e99586', sss: '#c4505a', rim: '#ffd8cc', rimStr: 0.25, spec: 0.25, noise: 0.08, noiseScale: 0.5, bandColor: '#ffb0a0' });
    this.utMat.clippingPlanes = [cutPlane];
    this.endoMat = tissue({ color: '#f6b8b0', sss: '#d87078', side: THREE.BackSide, noise: 0.12, noiseScale: 1.2, bandColor: '#ffb0a0' });
    this.endoMat.clippingPlanes = [cutPlane];
    this.utOuter = new THREE.Mesh(new THREE.BufferGeometry(), this.utMat);
    this.utInner = new THREE.Mesh(new THREE.BufferGeometry(), this.endoMat);
    this.amnMat = tissue({ color: '#cfe6f3', sss: '#9cc8e0', xray: 1, opacity: 0.5, side: THREE.BackSide, rim: '#bfe2f5', rimStr: 0.3 });
    this.amnMat.clippingPlanes = [cutPlane];
    this.amnion = new THREE.Mesh(new THREE.BufferGeometry(), this.amnMat);
    this.ut.add(this.utOuter, this.utInner, this.amnion);
    // cut faces (cross-section of the uterine wall)
    this.capMat = tissue({ color: '#d97a7e', sss: '#b04450', side: THREE.DoubleSide, noise: 0.22, noiseScale: 2.2, spec: 0.12, bandColor: '#ffb0a0' });
    this.liningMat = tissue({ color: '#f4aeb0', sss: '#d87078', side: THREE.DoubleSide, noise: 0.25, noiseScale: 3, spec: 0.1 });
    this.cap = new THREE.Mesh(new THREE.BufferGeometry(), this.capMat);
    this.capL = new THREE.Mesh(new THREE.BufferGeometry(), this.liningMat);
    this.ut.add(this.cap, this.capL);
    this.placMat = tissue({ color: '#c46a74', sss: '#8a3048', side: THREE.DoubleSide, noise: 0.25, noiseScale: 1.4, spec: 0.3 });
    this.placMat.clippingPlanes = [cutPlane];
    this.placenta = new THREE.Mesh(sphereGeo, this.placMat); this.ut.add(this.placenta);
    this.cordMat = tissue({ color: '#dcdff0', sss: '#9aa4d4', spec: 0.5, rimStr: 0.4, noise: 0.1, noiseScale: 3 });
    this.cord = new THREE.Mesh(new THREE.BufferGeometry(), this.cordMat); this.ut.add(this.cord);
    this.fetus = new Fetus(76); this.ut.add(this.fetus.outer);
    this.fetusFlip = 0; this.fetusShift = V(0, 0, 0);
    this.lastUt = '';
    this.opts = {};
    [this.reflux.obj, this.burn, this.air.obj, this.blood.obj, this.hormones.obj, this.les].forEach(o => o.renderOrder = 5);
  }
  fadeUterus(a) {
    for (const m of [this.utMat, this.endoMat, this.capMat, this.liningMat, this.placMat, this.cordMat]) { U(m, 'uOpacity', a); m.transparent = a < 0.999; m.depthWrite = a >= 0.999; }
    U(this.amnMat, 'uOpacity', 0.5 * a);
    this.fetus.setXray(this.fetus.xr || 0, a);
    this.ut.visible = a > 0.01;
  }

  buildCap(prof, c, liningFrac) {
    const show = c < 40;
    this.cap.visible = this.capL.visible = show;
    if (!show) return;
    const r = capGeoms(prof, this.P.wall, c, liningFrac);
    setGeo(this.cap, r[0]); setGeo(this.capL, r[1]);
    this.cap.position.z = r[2]; this.capL.position.z = r[2] + 0.01;
  }
  setDia(y) { this.diaY = y; this.dia.position.set(0.5, y - 14 * 0.85, 0); }
  // compute uterus + update everything. o: {w, eff, fetusFlip, fetusPose, time, kick, cut, lowerOs}
  update(o) {
    const w = o.w; const P = uterusParams(w); P.eff = o.eff || 0;
    if (o.uterusScale) { P.L *= o.uterusScale; P.R *= o.uterusScale; }
    const os = V(-1, -8 - (o.lower || 0), 0);
    this.ut.position.copy(os); this.ut.rotation.set(0, 0, -P.tilt);
    const key = [w.toFixed(3), P.eff.toFixed(3), (o.uterusScale || 1).toFixed(3)].join();
    const prof = uterusProfile(P); this.prof = prof; this.P = P;
    if (key !== this.lastUt) {
      setGeo(this.utOuter, new THREE.LatheGeometry(prof.outer, 72));
      setGeo(this.utInner, new THREE.LatheGeometry(prof.inner, 72));
      this.amnion.geometry = this.utInner.geometry;
      this.lastUt = key;
    }
    this.buildCap(prof, cutPlane.constant, o.lining ?? 0.3);
    const cavC = (prof.cle + P.L - P.wall) / 2;
    this.cavC = cavC;
    this.amnion.position.y = cavC * 0.03; this.amnion.scale.setScalar(0.97);
    // placenta on posterior wall
    const py = prof.cle + (P.L - prof.cle) * 0.66; const pr = prof.rAt(py);
    const pSize = table([[5, 0.5], [12, 0.9], [20, 1.0], [40, 1.0]], w);
    const pl = clamp((w - 5) / 8, 0.15, 1);
    this.placenta.position.set(-pr + pr * 0.13 * pl, py, 0);
    this.placenta.scale.set(pr * 0.17 * pl + 0.2, pr * 0.62 * pSize, pr * 0.62 * pSize);
    this.placenta.visible = w > 5;
    // fetus
    const f = this.fetus;
    f.outer.visible = w > 5.2;
    if (f.outer.visible) {
      f.update(w, o.pose || {}, o.time || 0);
      f.outer.scale.setScalar(CRL(w) * (o.fetusScale || 1));
      f.outer.position.set(1.0 * sstep(10, 30, w), cavC, 0).add(o.fetusShift || V());
      f.outer.rotation.set(0, Math.PI, (o.flip || 0));
      f.outer.updateMatrixWorld(true);
      // cord
      const a = this.placenta.position.clone().add(V(this.placenta.scale.x * 0.8, 0, 0));
      const b = this.ut.worldToLocal(f.toWorld(f.R.L.cord));
      const mid = a.clone().lerp(b, 0.5);
      const d = b.clone().sub(a); const len = d.length(); const n = V(-d.y, d.x, 0).normalize();
      const pts = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24; const p = a.clone().lerp(b, t);
        const sag = Math.sin(Math.PI * t) * len * 0.35;
        p.addScaledVector(n, sag * 0.6).add(V(0, 0, Math.sin(Math.PI * t) * len * 0.3));
        p.add(V(Math.sin(t * 20 + (o.time || 0)) * 0.05, Math.cos(t * 17) * 0.05, Math.sin(t * 13) * 0.05).multiplyScalar(len * 0.5));
        pts.push(p);
      }
      const cr = table([[6, 0.08], [10, 0.18], [16, 0.35], [24, 0.55], [40, 0.75]], w);
      setGeo(this.cord, makeTube(pts, () => cr, 80, 10));
    }
    this.cord.visible = f.outer.visible;
    // belly + body shell
    const ax = V(Math.sin(P.tilt), Math.cos(P.tilt), 0);
    const bellyKey = key + (o.lower || 0).toFixed(2) + (o.kickAmt || 0).toFixed(3);
    if (bellyKey !== this.lastBelly) {
      this.buildBody(P, prof, os, ax, o);
      this.lastBelly = bellyKey;
    }
  }

  buildBody(P, prof, os, ax, o) {
    const b = this.blob; b.begin(); const C = b.mc.position;
    const pts = [];
    const ball = (x, y, z, r) => b.ball(x - C.x, y - C.y, z - C.z, r);
    const chain = (list) => { for (let i = 0; i < list.length - 1; i++) { const [a, ra] = list[i], [c, rc] = list[i + 1]; const d = Math.hypot(c[0] - a[0], c[1] - a[1], c[2] - a[2]); const n = Math.max(1, Math.ceil(d / (Math.min(ra, rc) * 0.5))); for (let j = (i ? 1 : 0); j <= n; j++) { const t = j / n; ball(lerp(a[0], c[0], t), lerp(a[1], c[1], t), lerp(a[2], c[2], t), lerp(ra, rc, t)); } } };
    const sym = (list) => { chain(list); chain(list.map(([p, r]) => [[p[0], p[1], -p[2]], r])); };
    // head & neck
    chain([[[-1, 63, 0], 8.6], [[3.0, 58.5, 0], 6.6]]);
    ball(4.0, 53.6, 0, 3.6); ball(-8, 63.5, 0, 4.4); ball(9.4, 59.6, 0, 1.7);
    chain([[[0, 50, 0], 5.0], [[0.5, 44, 0], 5.6]]);
    // torso
    sym([[[-1, 40.5, 14.5], 5.6], [[-1, 41.5, 8], 6.4]]);
    sym([[[0, 35, 6], 10.2], [[1.2, 28.5, 6], 10.2], [[0.5, 22, 6], 9.4], [[0.5, 15.5, 6.5], 9.4], [[-1, 6, 8.5], 9.8], [[-2, -2, 9], 10.2]]);
    sym([[[5.6, 29.8, 6.5], 5.2]]);
    chain([[[-5, 26, 0], 8], [[-5, 12, 0], 8.4]]);
    chain([[[3.8, 11, 0], 8.8], [[3.0, 3.5, 0], 9.3]]);
    sym([[[-6, -4, 5.5], 8.6]]);
    // legs
    sym([[[0, -12, 8.5], 8.6], [[0.5, -26, 8], 7.0], [[1, -40, 7.5], 5.2], [[-1.5, -52, 7.5], 5.5], [[-1, -65, 7.3], 4.4], [[-0.5, -77, 7], 3.2], [[-1, -82, 7], 3.0], [[5, -83, 7], 2.7], [[10, -83.5, 7], 2.3]]);
    // arms
    sym([[[-2, 37, 17.5], 4.8], [[-2, 24, 19.5], 4.2], [[-2.5, 14, 19.5], 3.6], [[-0.5, 5, 19.5], 3.3], [[1, -4, 19.5], 2.6], [[2, -10, 19.5], 3.0]]);
    // belly following the uterus
    for (const u of [0.3, 0.5, 0.7, 0.86]) {
      const y = prof.cle + u * (P.L - prof.cle); const r = prof.outer[Math.round(y / P.L * 72)].x;
      const p = os.clone().addScaledVector(ax, y);
      const rr = r + 1.5; if (rr < 7) continue;
      ball(p.x + 1.2, p.y, p.z, rr);
    }
    if (o.kickAmt) { const k = o.kickPos; ball(k.x, k.y, k.z, 3.2 * o.kickAmt); }
    b.end();
  }

  // place blood particles; circulation loop from heart to placenta and back
  updateVessels(time, density, speed, dilate = 1) {
    const plW = this.ut.localToWorld(this.placenta.position.clone());
    const art = [V(4, 31, -1), V(1, 37.5, -1), V(-3.5, 37, -1), V(-5.6, 30, -1), V(-4.8, 18, -1.2), V(-4.0, 6, -1.5), V(-2.5, -1, -4.5), V(0.5, -3, -5.5), plW.clone().add(V(0, -2, -3))];
    const ven = [plW.clone().add(V(0, -1.5, 3)), V(0.5, -3, 5), V(-2.5, 0, 3.2), V(-2.8, 8, 1.8), V(-2.6, 18, 1.6), V(-1.5, 24, 1.4), V(1.5, 28, 0.6), V(3.5, 30, -0.5)];
    const ra = 0.85 * dilate, rv = 1.0 * dilate;
    setGeo(this.aorta, makeTube(art, () => ra, 120, 10));
    setGeo(this.vena, makeTube(ven, () => rv, 100, 10));
    const ca = this.aorta.geometry.curve, cv = this.vena.geometry.curve;
    const n = Math.floor(this.blood.n * density);
    const colA = new THREE.Color('#e2505f'), colV = new THREE.Color('#8f6fb5');
    for (let i = 0; i < n; i++) {
      const [s1, s2] = this.bloodSeeds[i];
      const u = (s1 + time * speed) % 1;
      const onArt = s2 < 0.55;
      const p = (onArt ? ca : cv).getPointAt(u);
      const j = (r => V((r() - .5), (r() - .5), (r() - .5)))(rng(i * 13 + 1)).multiplyScalar(onArt ? ra * 1.3 : rv * 1.3);
      this.blood.set(i, p.add(j), onArt ? colA : colV);
    }
    this.blood.commit(n);
  }
}
