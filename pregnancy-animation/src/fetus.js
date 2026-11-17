// Parametric embryo / fetus. Gestational age w is in weeks from the last menstrual period (LMP).
import * as THREE from 'three';
import { V, table, sstep, clamp, lerp, tissue, Blob, ell, ellBetween, sphereGeo, sphereLo, makeTube, setGeo, U } from './core.js';

// crown-rump length in cm by LMP week (approximate standard values)
export const CRL = w => table([[4.5, 0.1], [5.5, 0.25], [6, 0.4], [7, 1.0], [8, 1.6], [9, 2.3], [10, 3.1], [11, 4.1], [12, 5.4], [13, 6.8], [14, 8.5], [16, 11.6], [20, 16.4], [24, 21], [28, 25], [32, 28.5], [36, 32.5], [40, 36]], w);

const Z = V(0, 0, 1);
function v2(a) { return V(a[0], a[1], 0); }

// Build the body description in normalized units (crown-rump length = 1).
export function fetusRig(w, pose = {}) {
  const legExt = pose.legExt || 0, armLift = pose.armLift || 0, nod = pose.nod || 0, turn = pose.turn || 0;
  const theta = table([[5, 3.0], [7, 2.9], [8.5, 2.75], [10, 2.55], [12, 2.45], [20, 2.4], [40, 2.35]], w);
  const H = table([[5, 0.15], [6.5, 0.19], [8, 0.25], [10, 0.28], [12, 0.25], [16, 0.205], [20, 0.185], [28, 0.172], [40, 0.165]], w);
  const T = table([[5, 0.1], [7, 0.115], [9, 0.11], [12, 0.105], [20, 0.11], [26, 0.12], [32, 0.14], [40, 0.158]], w);
  const fat = sstep(26, 40, w);
  const early = 1 - sstep(8.5, 11, w);
  const tail = 1 - sstep(7.6, 9.6, w);
  const R = 1 / theta;
  const sp = s => { const ph = theta * s; return V(R * (1 - Math.cos(ph)), R * Math.sin(ph), 0); };
  const tg = s => { const ph = theta * s; return V(Math.sin(ph), Math.cos(ph), 0); };
  const nv = s => { const ph = theta * s; return V(Math.cos(ph), -Math.sin(ph), 0); };
  const balls = [];
  const B = (p, r) => balls.push([p.x, p.y, p.z, r]);
  // trunk
  for (let i = 0; i <= 12; i++) {
    const s = i / 12;
    let r = T * (0.9 + 0.14 * Math.sin(Math.PI * s));
    if (s > 0.88) r *= lerp(1, 0.66, (s - 0.88) / 0.12);
    if (s < 0.06) r *= 0.92;
    B(sp(s).addScaledVector(nv(s), T * 0.33), r);
  }
  B(sp(0.32).addScaledVector(nv(0.32), T * (0.6 + 0.12 * fat)), T * (0.95 + 0.1 * fat)); // abdomen
  B(sp(0.62).addScaledVector(nv(0.62), T * 0.95), T * 0.92 * early); // heart/liver prominence (embryo)
  if (fat > 0) { B(sp(0.05).addScaledVector(nv(0.05), T * 0.2).addScaledVector(Z, T * 0.45), T * 0.75 * fat); B(sp(0.05).addScaledVector(nv(0.05), T * 0.2).addScaledVector(Z, -T * 0.45), T * 0.75 * fat); }
  // head
  const alpha = table([[5, 1.25], [7, 1.05], [9, 0.8], [12, 0.6], [20, 0.5], [40, 0.45]], w) + nod;
  const t1 = tg(1), n1 = nv(1), Np = sp(1);
  const hd = t1.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(n1, Math.sin(alpha));
  const hn = n1.clone().multiplyScalar(Math.cos(alpha)).addScaledVector(t1, -Math.sin(alpha));
  const hz = Z.clone().applyAxisAngle(hd, turn); const hnT = hn.clone().applyAxisAngle(hd, turn);
  const hc = Np.clone().addScaledVector(hd, H * 0.8).addScaledVector(n1, H * 0.12);
  B(hc, H);
  B(hc.clone().addScaledVector(hn, -H * 0.22).addScaledVector(hd, H * 0.05), H * 0.9);
  const face = hc.clone().addScaledVector(hnT, H * 0.45).addScaledVector(hd, -H * 0.36);
  B(face, H * lerp(0.5, 0.64, 1 - early) * (1 + 0.08 * fat));
  if (w > 8.5) B(hc.clone().addScaledVector(hnT, H * 0.32).addScaledVector(hd, -H * 0.72), H * 0.36 * sstep(8.5, 11, w)); // chin/jaw
  if (w > 26) { for (const sg of [-1, 1]) B(face.clone().addScaledVector(hz, sg * H * 0.32).addScaledVector(hd, -H * 0.1), H * 0.32 * fat); } // cheeks
  // pharyngeal arches (early embryo)
  const arch = 1 - sstep(7, 8.6, w);
  if (arch > 0.01) for (let i = 0; i < 3; i++) B(hc.clone().addScaledVector(hd, -H * (0.75 + i * 0.18)).addScaledVector(hn, H * (0.55 - i * 0.05)), H * 0.2 * arch);
  // ears
  const ear = sstep(9, 12, w);
  const earP = s => hc.clone().addScaledVector(hnT, -H * 0.05).addScaledVector(hd, -H * 0.2).addScaledVector(hz, s * H * 0.93);
  if (ear > 0) { B(earP(1), H * 0.15 * ear); B(earP(-1), H * 0.15 * ear); }
  // tail (embryo)
  if (tail > 0.02) for (let s = -0.03; s > -0.3 * tail; s -= 0.025) B(sp(s).addScaledVector(nv(s), T * 0.3), T * 0.7 * (1 + s / (0.36 * tail)) + 0.01);

  // limbs
  const ga = sstep(5.9, 8.6, w), gl = sstep(6.3, 9.2, w);
  const armS = table([[8, 0.7], [12, 0.92], [20, 1.0], [40, 1.0]], w), legS = table([[8, 0.6], [12, 0.82], [20, 0.95], [40, 1.08]], w);
  const limbs = { arms: [], legs: [] };
  const chain = (P, Rr) => { for (let i = 0; i < P.length - 1; i++) { const d = P[i].distanceTo(P[i + 1]); const n = Math.max(1, Math.ceil(d / (Math.min(Rr[i], Rr[i + 1]) * 0.45))); for (let j = 0; j <= n; j++) { const t = j / n; B(P[i].clone().lerp(P[i + 1], t), lerp(Rr[i], Rr[i + 1], t)); } } };
  const tA = tg(0.84), nA = nv(0.84), tL = tg(0.1), nL = nv(0.1);
  for (const sg of [1, -1]) {
    const z = Z.clone().multiplyScalar(sg);
    // arm
    const S = sp(0.84).addScaledVector(nA, T * 0.4).addScaledVector(z, T * 0.82);
    const up = nA.clone().multiplyScalar(0.7).addScaledVector(tA, -0.5 + armLift * 0.5).addScaledVector(z, 0.4).normalize();
    const E = S.clone().addScaledVector(up, 0.23 * ga * armS);
    const fd = nA.clone().multiplyScalar(0.5).addScaledVector(tA, 0.82 + armLift * 0.2).addScaledVector(z, -0.28).normalize();
    const Wr = E.clone().addScaledVector(fd, 0.2 * ga * armS);
    const hdv = fd.clone().addScaledVector(nA, 0.25).addScaledVector(z, -0.25).normalize();
    const rA = T * lerp(0.55, 0.38, ga) * (1 + 0.25 * fat);
    chain([S, E, Wr], [rA * 1.05, rA * 0.82, rA * 0.68]);
    limbs.arms.push({ S, E, Wr, hdv, len: 0.12 * ga * armS, r: rA, z, n: nA });
    // leg
    const Hp = sp(0.1).addScaledVector(nL, T * 0.4).addScaledVector(z, T * 0.78);
    const thF = nL.clone().multiplyScalar(0.82).addScaledVector(tL, 0.36).addScaledVector(z, 0.3).normalize();
    const thE = nL.clone().multiplyScalar(0.25).addScaledVector(tL, -0.95).addScaledVector(z, 0.1).normalize();
    const th = thF.clone().lerp(thE, legExt).normalize();
    const K = Hp.clone().addScaledVector(th, 0.26 * gl * legS);
    const shF = tL.clone().multiplyScalar(-0.92).addScaledVector(nL, -0.1).addScaledVector(z, 0.04).normalize();
    const sh = shF.clone().lerp(th, legExt).normalize();
    const A = K.clone().addScaledVector(sh, 0.23 * gl * legS);
    const ft = nL.clone().multiplyScalar(0.85).addScaledVector(tL, -0.25 - legExt * 0.3).addScaledVector(z, -0.15).normalize();
    const rL = T * lerp(0.6, 0.48, gl) * (1 + 0.3 * fat);
    chain([Hp, K, A], [rL * 1.15, rL * 0.8, rL * 0.58]);
    limbs.legs.push({ Hp, K, A, ft, len: 0.19 * gl * legS, r: rL, z, n: nL });
  }
  // landmarks
  const L = {
    hc, H, hd, hn: hnT, hz, face, T, w,
    eye: s => hc.clone().addScaledVector(hnT, H * 0.74).addScaledVector(hd, -H * 0.12).addScaledVector(hz, s * H * lerp(0.36, 0.55, early)),
    earC: earP,
    heart: sp(0.68).addScaledVector(nv(0.68), T * lerp(0.4, 0.95, early)),
    lungs: s => sp(0.74).addScaledVector(nv(0.74), T * 0.3).addScaledVector(Z, s * T * 0.42),
    kidney: s => sp(0.3).addScaledVector(nv(0.3), T * 0.0).addScaledVector(Z, s * T * 0.42),
    bladder: sp(0.07).addScaledVector(nv(0.07), T * 0.55),
    cord: sp(0.36).addScaledVector(nv(0.36), T * (1.45 + 0.12 * fat)),
    spine: s => sp(s).addScaledVector(nv(s), -T * 0.3), spineN: nv, spineT: tg,
    limbs, theta,
  };
  // normalization: crown-rump (greatest) length = 1
  const rump = sp(0).addScaledVector(tg(0), -T * 0.85);
  let best = 0;
  for (const [x, y, z, r] of balls) { const d = Math.hypot(x - rump.x, y - rump.y, z - rump.z); }
  best = hc.distanceTo(rump) + H;
  const k = 1 / best;
  const center = hc.clone().add(rump).multiplyScalar(0.5);
  const axis = hc.clone().sub(rump).normalize();
  return { balls, L, k, center, axis, rump };
}

const fMat = () => tissue({ color: '#f2b6a0', sss: '#e0655a', rim: '#fff0e8', rimStr: 0.3, spec: 0.18, noise: 0.05, noiseScale: 18 });

export class Fetus {
  constructor(res = 72) {
    this.outer = new THREE.Group();   // world placement; scale = CRL (cm) or chosen units
    this.inner = new THREE.Group();   // aligns rig axis to +Y
    this.outer.add(this.inner);
    this.rig = new THREE.Group(); this.inner.add(this.rig); // rig coordinates (pre-normalization)
    this.mat = fMat();
    this.blob = new Blob(res, 1.9, this.mat, Math.round(res * res * 4));
    this.rig.add(this.blob.mc);
    this.extraMat = this.mat;
    // hands / fingers / feet / toes
    this.hands = []; this.feet = [];
    const mk = (m = this.mat, g = sphereLo) => { const o = new THREE.Mesh(g, m); this.rig.add(o); return o; };
    this.nailMat = tissue({ color: '#fff4ee', sss: '#ffffff', spec: 0.9, rimStr: 0.6, transparent: true, opacity: 0 });
    for (let i = 0; i < 2; i++) {
      this.hands.push({ palm: mk(), fingers: [0, 1, 2, 3, 4].map(() => mk()), nails: [0, 1, 2, 3, 4].map(() => mk(this.nailMat)) });
      this.feet.push({ sole: mk(), toes: [0, 1, 2, 3, 4].map(() => mk()) });
    }
    this.eyeMat = tissue({ color: '#5a3a44', sss: '#5a3a44', spec: 0.5 });
    this.eyes = [mk(this.eyeMat), mk(this.eyeMat)];
    // internal organs (glow)
    const glow = (c, op = 0.95) => tissue({ color: c, sss: c, emissive: c, emit: 0.35, opacity: op, transparent: true, depthWrite: false, rimStr: 0.4 });
    this.heartMat = glow('#e2505e');
    this.heart = mk(this.heartMat, sphereGeo);
    this.kidneyMat = glow('#e7b24a'); this.kidneys = [mk(this.kidneyMat), mk(this.kidneyMat)];
    this.bladder = mk(this.kidneyMat);
    this.lungMat = glow('#f08aa0'); this.lungs = [mk(this.lungMat, sphereGeo), mk(this.lungMat, sphereGeo)];
    this.brainMat = glow('#a77de0'); this.brain = [mk(this.brainMat, sphereGeo), mk(this.brainMat, sphereGeo), mk(this.brainMat, sphereGeo)];
    this.cordMesh = new THREE.Mesh(new THREE.BufferGeometry(), this.brainMat); this.rig.add(this.cordMesh); // spinal cord
    this.nerves = [];
    for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(new THREE.BufferGeometry(), this.brainMat); this.rig.add(m); this.nerves.push(m); }
    this.boneMat = tissue({ color: '#f6eedc', sss: '#d9cbb0', emissive: '#fff6e0', emit: 0, opacity: 0.95, transparent: true, depthWrite: false, rimStr: 0.4 });
    this.bones = [];
    for (let i = 0; i < 34; i++) this.bones.push(mk(this.boneMat));
    this.skull = mk(this.boneMat, sphereGeo);
    this.organs = { heart: 0, kidney: 0, lung: 0, brain: 0, bones: 0, nails: 0, nerves: 0 };
    this.lastKey = '';
    this.heartPhase = 0;
  }
  // w: LMP week; pose; opts: {xray, organs{...}, time}
  update(w, pose = {}, time = 0) {
    const R = fetusRig(w, pose);
    this.R = R;
    const k = R.k;
    // rig coordinates are scaled by k and centered
    this.rig.scale.setScalar(k);
    this.rig.position.copy(R.center).multiplyScalar(-k);
    // align axis (rump->crown) to +Y, ventral(+x) stays roughly +X
    const q = new THREE.Quaternion().setFromUnitVectors(R.axis, V(0, 1, 0));
    this.inner.quaternion.copy(q);
    // blob
    const key = JSON.stringify([w.toFixed(3), pose]);
    if (key !== this.lastKey) {
      this.blob.begin();
      const c = R.center;
      // blob box in rig coords: size 1.9/k ; ball coords relative to blob center (= rig center)
      this.blob.mc.position.copy(c);
      this.blob.mc.scale.setScalar(1.9 / k / 2);
      this.blob.size = 1.9 / k;
      for (const [x, y, z, r] of R.balls) this.blob.ball(x - c.x, y - c.y, z - c.z, r);
      this.blob.end();
      this.lastKey = key;
    }
    const L = R.L; const T = L.T;
    // hands
    const digit = sstep(7.9, 9.6, w), sep = sstep(8.6, 10.6, w), nails = sstep(10.5, 13, w);
    L.limbs.arms.forEach((a, i) => {
      const h = this.hands[i];
      const hl = a.len; const Hc = a.Wr.clone().addScaledVector(a.hdv, hl * 0.45);
      const side = V().crossVectors(a.hdv, a.n).normalize();
      h.palm.position.copy(Hc); h.palm.quaternion.setFromUnitVectors(V(0, 1, 0), a.hdv);
      const webW = lerp(1, 0.75, sep);
      h.palm.scale.set(Math.max(hl * 0.42 * webW, 1e-4) + a.r * 0.2, Math.max(hl * 0.55, 1e-4) + a.r * 0.3, a.r * 0.5);
      h.palm.visible = hl > 1e-3;
      h.fingers.forEach((f, j) => {
        const sp = (j - 2) * lerp(0.08, 0.32, sep);
        const thumb = j === 0;
        const dir = a.hdv.clone().applyAxisAngle(a.n.clone().cross(side).normalize(), 0).multiplyScalar(1);
        const d = a.hdv.clone().multiplyScalar(Math.cos(sp)).addScaledVector(side, Math.sin(sp) * (thumb ? 1.4 : 1)).normalize();
        const base = Hc.clone().addScaledVector(a.hdv, hl * 0.25).addScaledVector(side, (j - 2) * hl * 0.16);
        const fl = hl * (thumb ? 0.45 : 0.62 - Math.abs(j - 2.5) * 0.05) * digit;
        const tip = base.clone().addScaledVector(d, fl);
        ellBetween(f, base, tip, hl * 0.085 + 1e-4);
        f.visible = digit > 0.02;
        const n = h.nails[j]; n.position.copy(tip).addScaledVector(d, -fl * 0.12).addScaledVector(a.n, -hl * 0.06);
        n.scale.setScalar(hl * 0.06 + 1e-4); n.visible = nails > 0.01;
      });
    });
    U(this.nailMat, 'uOpacity', nails * (this.organs.nails ?? 0));
    U(this.nailMat, 'uEmit', 0.6 * (this.organs.nails ?? 0));
    L.limbs.legs.forEach((g, i) => {
      const f = this.feet[i]; const fl = g.len;
      const Fc = g.A.clone().addScaledVector(g.ft, fl * 0.45);
      f.sole.position.copy(Fc); f.sole.quaternion.setFromUnitVectors(V(0, 1, 0), g.ft);
      f.sole.scale.set(fl * 0.32 + g.r * 0.2, fl * 0.6 + g.r * 0.2, g.r * 0.55);
      f.sole.visible = fl > 1e-3;
      const side = V().crossVectors(g.ft, g.n).normalize();
      f.toes.forEach((t, j) => {
        const base = Fc.clone().addScaledVector(g.ft, fl * 0.42).addScaledVector(side, (j - 2) * fl * 0.13);
        const tip = base.clone().addScaledVector(g.ft, fl * 0.18 * digit);
        ellBetween(t, base, tip, fl * 0.07 + 1e-4); t.visible = digit > 0.05;
      });
    });
    // eyes
    const eyeV = sstep(6.6, 7.6, w);
    this.eyes.forEach((e, i) => { e.position.copy(L.eye(i ? -1 : 1)); e.scale.setScalar(L.H * lerp(0.07, 0.1, sstep(8, 12, w)) * eyeV + 1e-5); e.visible = eyeV > 0.01 && !(this.xr > 0.25); });
    // organs
    const o = this.organs;
    const beat = Math.pow(Math.max(0, Math.sin(time * Math.PI * 2 * 2.3)), 6);
    this.heart.position.copy(L.heart); this.heart.scale.setScalar(T * lerp(0.35, 0.3, sstep(9, 14, w)) * (1 + 0.18 * beat * o.heart));
    this.heart.visible = o.heart > 0.01; U(this.heartMat, 'uOpacity', o.heart); U(this.heartMat, 'uEmit', 0.25 + 0.9 * beat * o.heart);
    this.kidneys.forEach((kd, i) => { kd.position.copy(L.kidney(i ? -1 : 1)); kd.scale.set(T * 0.14, T * 0.24, T * 0.12); kd.visible = o.kidney > 0.01; });
    this.bladder.position.copy(L.bladder); this.bladder.scale.setScalar(T * 0.14 * (0.8 + 0.2 * Math.sin(time * 1.5))); this.bladder.visible = o.kidney > 0.01;
    U(this.kidneyMat, 'uOpacity', o.kidney); U(this.kidneyMat, 'uEmit', 0.5 + 0.3 * Math.sin(time * 3));
    this.lungs.forEach((l, i) => { l.position.copy(L.lungs(i ? -1 : 1)); l.scale.set(T * 0.3, T * 0.46, T * 0.28); l.visible = o.lung > 0.01; });
    U(this.lungMat, 'uOpacity', o.lung); U(this.lungMat, 'uEmit', 0.4 + 0.4 * o.lung);
    // brain + spinal cord
    const bOn = o.brain > 0.01;
    [[0.05, -0.05, 0.74], [-0.45, -0.52, 0.3], [-0.75, -0.22, 0.2]].forEach(([dd, dn, r], i) => {
      const b = this.brain[i]; b.position.copy(L.hc).addScaledVector(L.hd, L.H * dd).addScaledVector(L.hn, L.H * dn);
      b.scale.setScalar(L.H * r); b.visible = bOn;
    });
    if (bOn) {
      const pts = []; for (let i = 0; i <= 14; i++) pts.push(L.spine(i / 14));
      pts.push(L.hc.clone().addScaledVector(L.hd, -L.H * 0.4));
      setGeo(this.cordMesh, makeTube(pts, u => T * 0.07 * (0.8 + 0.4 * u), 48, 8));
    }
    this.cordMesh.visible = bOn;
    U(this.brainMat, 'uOpacity', o.brain); U(this.brainMat, 'uEmit', 0.3 + 0.6 * o.brain * (0.75 + 0.25 * Math.sin(time * 4)));
    // nerves to limbs
    const nOn = o.nerves > 0.01;
    this.nerves.forEach((m, i) => {
      m.visible = nOn; if (!nOn) return;
      const a = i < 2 ? L.limbs.arms[i] : L.limbs.legs[i - 2];
      const root = L.spine(i < 2 ? 0.82 : 0.12);
      const pts = i < 2 ? [root, a.S, a.E, a.Wr] : [root, a.Hp, a.K, a.A];
      setGeo(m, makeTube(pts, u => T * 0.035 * (1 - 0.5 * u), 32, 6));
    });
    // bones
    const bOn2 = o.bones > 0.01;
    let bi = 0;
    const bone = (a, b, r) => { const m = this.bones[bi++]; m.visible = bOn2; ellBetween(m, a, b, r); };
    if (bOn2) {
      for (let i = 0; i < 18; i++) { const s = 0.02 + i * 0.055; const p = L.spine(s); const m = this.bones[bi++]; m.visible = true; m.position.copy(p); m.scale.setScalar(T * 0.11); }
      L.limbs.arms.forEach(a => { bone(a.S, a.E, a.r * 0.32); bone(a.E, a.Wr, a.r * 0.26); });
      L.limbs.legs.forEach(g => { bone(g.Hp, g.K, g.r * 0.34); bone(g.K, g.A, g.r * 0.28); });
      // ribs (as short arcs approximated by ellipsoids)
      for (let i = 0; i < 4; i++) { const s = 0.6 + i * 0.07; for (const sg of [1, -1]) { const a = L.spine(s), b = L.spine(s).addScaledVector(L.spineN(s), T * 0.8).addScaledVector(V(0, 0, sg), T * 0.55); bone(a, b, T * 0.05); } }
    }
    for (; bi < this.bones.length; bi++) this.bones[bi].visible = false;
    this.skull.visible = bOn2; this.skull.position.copy(L.hc); this.skull.scale.setScalar(L.H * 0.93);
    U(this.boneMat, 'uOpacity', o.bones * 0.85);
    return R;
  }
  setXray(x, opacity = 1) { this.xr = x; U(this.mat, 'uXray', x); U(this.mat, 'uOpacity', opacity); this.mat.transparent = x > 0 || opacity < 1; this.mat.depthWrite = !this.mat.transparent; }
  // world point of a rig landmark
  toWorld(p) { return this.rig.localToWorld(p.clone()); }
}
