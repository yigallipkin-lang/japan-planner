// Core helpers: renderer, tissue shader, metaball blob, variable-radius tubes, math.
import * as THREE from 'three';
import { MarchingCubes } from 'three/addons/objects/MarchingCubes.js';

export const W = 1920, H = 1080;
export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, t) => a + (b - a) * t;
export const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
export const ease = t => { t = clamp(t); return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
export const seg = (t, a, b) => clamp((t - a) / (b - a));
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
export function table(tab, x) {
  if (x <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (x <= tab[i][0]) {
    const [x0, y0] = tab[i - 1], [x1, y1] = tab[i];
    const t = (x - x0) / (x1 - x0); const s = t * t * (3 - 2 * t) * 0.35 + t * 0.65;
    return y0 + (y1 - y0) * s;
  }
  return tab[tab.length - 1][1];
}
// deterministic pseudo random
export function rng(seed) {
  // mulberry32 with a hashed seed (consecutive seeds give unrelated streams)
  let h = (seed * 2654435761) ^ 0x9E3779B9; h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); let a = (h ^ (h >>> 16)) >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// ---------- renderer ----------
export const canvas = document.getElementById('c');
export const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1); renderer.setSize(W, H, false);
renderer.localClippingEnabled = true;
renderer.outputColorSpace = THREE.SRGBColorSpace;
export const scene = new THREE.Scene();
export const camera = new THREE.PerspectiveCamera(35, W / H, 0.05, 3000);
{
  const c = document.createElement('canvas'); c.width = 960; c.height = 540;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(480, 250, 40, 480, 290, 640);
  gr.addColorStop(0, '#f6f4f0'); gr.addColorStop(0.55, '#e8e7e4'); gr.addColorStop(1, '#c9d0d7');
  g.fillStyle = gr; g.fillRect(0, 0, 960, 540);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  scene.background = tex;
}
export function lookCam(pos, target, fov = 35) {
  camera.position.copy(pos); camera.fov = fov; camera.updateProjectionMatrix(); camera.lookAt(target);
}
export function orbitCam(target, dist, az, el, fov = 35) {
  const p = V(target.x + dist * Math.cos(el) * Math.sin(az), target.y + dist * Math.sin(el), target.z + dist * Math.cos(el) * Math.cos(az));
  lookCam(p, target, fov);
}

// ---------- tissue shader ----------
const vert = /* glsl */`
#include <common>
#include <clipping_planes_pars_vertex>
uniform vec4 uBulge; uniform float uBulgeR;
uniform vec4 uBulge2; uniform float uBulgeR2;
uniform float uWave, uWaveAmp, uWaveFreq;
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec2 vUv;
void main(){
  vec3 p = position; vec3 nrm = normal;
  #ifdef USE_INSTANCING
  p = (instanceMatrix * vec4(p, 1.0)).xyz; nrm = normalize(mat3(instanceMatrix) * nrm);
  #endif
  float d = distance(p, uBulge.xyz);
  p += nrm * uBulge.w * exp(-d*d/(uBulgeR*uBulgeR));
  float d2 = distance(p, uBulge2.xyz);
  p += nrm * uBulge2.w * exp(-d2*d2/(uBulgeR2*uBulgeR2));
  vec2 tuv = vec2(0.0);
  #ifdef USE_TUV
  tuv = uv;
  if (uWaveAmp > 0.0) p += nrm * uWaveAmp * pow(max(0.0, sin(tuv.x*uWaveFreq - uWave)), 3.0);
  #endif
  vObj = position; vUv = tuv;
  vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
  vN = normalize(normalMatrix * nrm);
  vV = -mvPosition.xyz;
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`;
const frag = /* glsl */`
#include <common>
#include <clipping_planes_pars_fragment>
uniform vec3 uColor; uniform vec3 uSss; uniform vec3 uRim; uniform vec3 uEmissive; uniform vec3 uBandColor;
uniform float uRimStr, uOpacity, uXray, uEmit, uSpec, uNoise, uNoiseScale, uBandY, uBandW, uBandAmt, uSaturate;
varying vec3 vN; varying vec3 vV; varying vec3 vObj; varying vec2 vUv;
float h3(vec3 p){ p = fract(p*0.3183099 + 0.1); p *= 17.0; return fract(p.x*p.y*p.z*(p.x+p.y+p.z)); }
float vn(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(h3(i),h3(i+vec3(1,0,0)),f.x), mix(h3(i+vec3(0,1,0)),h3(i+vec3(1,1,0)),f.x), f.y),
             mix(mix(h3(i+vec3(0,0,1)),h3(i+vec3(1,0,1)),f.x), mix(h3(i+vec3(0,1,1)),h3(i+vec3(1,1,1)),f.x), f.y), f.z); }
void main(){
  #include <clipping_planes_fragment>
  vec3 N = normalize(vN); if(!gl_FrontFacing) N = -N;
  vec3 Vd = normalize(vV);
  vec3 L1 = normalize(vec3(0.5, 0.7, 0.55));
  vec3 L2 = normalize(vec3(-0.8, 0.1, 0.45));
  vec3 L3 = normalize(vec3(0.1, 0.4, -0.9));
  float n1 = dot(N, L1), n2 = dot(N, L2);
  float w1 = clamp((n1 + 0.6)/1.6, 0.0, 1.0);
  float h1 = clamp(n1, 0.0, 1.0);
  float w2 = clamp((n2 + 0.5)/1.5, 0.0, 1.0);
  float nz = vn(vObj*uNoiseScale)*0.6 + vn(vObj*uNoiseScale*2.9)*0.4;
  vec3 base = uColor * (1.0 + (nz - 0.5)*uNoise*2.0);
  float fres = pow(1.0 - clamp(dot(N, Vd), 0.0, 1.0), 2.2);
  vec3 col = base*(0.34 + 0.58*h1 + 0.20*w2) + uSss*(w1 - h1)*0.55;
  col += uSss * pow(clamp(dot(Vd, -L3)*0.5+0.5, 0.0, 1.0), 3.0) * fres * 0.35;
  vec3 Hh = normalize(L1 + Vd);
  col += vec3(1.0, 0.97, 0.94) * pow(clamp(dot(N, Hh), 0.0, 1.0), 40.0) * uSpec;
  col += uRim * fres * uRimStr;
  col += uEmissive * uEmit;
  float band = uBandAmt * exp(-pow((vObj.y - uBandY)/max(uBandW, 0.001), 2.0));
  col += uBandColor * band;
  float a = uOpacity * mix(1.0, clamp(0.04 + fres*1.3, 0.0, 1.0), uXray);
  a = clamp(a + uEmit*uXray*0.25 + band*uXray*0.3, 0.0, 1.0);
  gl_FragColor = vec4(col, a);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
export function tissue(o = {}) {
  const C = c => new THREE.Color(c);
  const m = new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: C(o.color || '#f0b8a0') }, uSss: { value: C(o.sss || o.color || '#d06060') },
      uRim: { value: C(o.rim || '#ffffff') }, uRimStr: { value: o.rimStr ?? 0.25 },
      uOpacity: { value: o.opacity ?? 1 }, uXray: { value: o.xray ?? 0 },
      uEmissive: { value: C(o.emissive || '#ffffff') }, uEmit: { value: o.emit ?? 0 },
      uSpec: { value: o.spec ?? 0.22 }, uNoise: { value: o.noise ?? 0.06 }, uNoiseScale: { value: o.noiseScale ?? 1 },
      uBulge: { value: new THREE.Vector4(0, 0, 0, 0) }, uBulgeR: { value: 1 },
      uBulge2: { value: new THREE.Vector4(0, 0, 0, 0) }, uBulgeR2: { value: 1 },
      uWave: { value: 0 }, uWaveAmp: { value: 0 }, uWaveFreq: { value: 10 },
      uBandY: { value: 0 }, uBandW: { value: 1 }, uBandAmt: { value: 0 }, uBandColor: { value: C(o.bandColor || '#ffd0c0') },
      uSaturate: { value: 1 },
    },
    vertexShader: vert, fragmentShader: frag, clipping: true, defines: o.uv ? { USE_TUV: '' } : {},
    transparent: !!(o.transparent || (o.opacity ?? 1) < 1 || o.xray),
    depthWrite: o.depthWrite ?? !(o.transparent || (o.opacity ?? 1) < 1 || o.xray),
    side: o.side ?? THREE.FrontSide,
  });
  return m;
}
export const U = (m, k, v) => { const u = m.uniforms[k]; if (u.value && u.value.isColor) u.value.set(v); else if (u.value && u.value.set && typeof v === 'object') u.value.copy(v); else u.value = v; };

// soft round sprite texture for particles
export const dotTex = (() => {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.45, 'rgba(255,255,255,0.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); const t = new THREE.CanvasTexture(c); return t;
})();
export class Particles {
  constructor(n, size, color, opacity = 0.9) {
    this.n = n; this.geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.mat = new THREE.PointsMaterial({ size, map: dotTex, vertexColors: true, transparent: true, depthWrite: false, opacity, sizeAttenuation: true });
    this.c = new THREE.Color(color);
    for (let i = 0; i < n; i++) { this.col[i * 3] = this.c.r; this.col[i * 3 + 1] = this.c.g; this.col[i * 3 + 2] = this.c.b; }
    this.obj = new THREE.Points(this.geo, this.mat); this.obj.frustumCulled = false;
  }
  set(i, p, color) {
    this.pos[i * 3] = p.x; this.pos[i * 3 + 1] = p.y; this.pos[i * 3 + 2] = p.z;
    if (color) { this.col[i * 3] = color.r; this.col[i * 3 + 1] = color.g; this.col[i * 3 + 2] = color.b; }
  }
  hide(i) { this.pos[i * 3] = 1e5; this.pos[i * 3 + 1] = 1e5; this.pos[i * 3 + 2] = 1e5; }
  commit(count = this.n) { for (let i = count; i < this.n; i++) this.hide(i); this.geo.attributes.position.needsUpdate = true; this.geo.attributes.color.needsUpdate = true; }
}

// ---------- metaball blob with compact kernel ----------
export class Blob {
  constructor(res, size, material, maxPoly = 60000) {
    this.res = res; this.size = size;
    this.mc = new MarchingCubes(res, material, false, false, maxPoly);
    this.mc.isolation = 0.09; // p-norm (p=3) blending: field = sum(v^3), v=(1-q)^3, iso=0.3^3 this.mc.frustumCulled = false;
    this.mc.scale.setScalar(size / 2);
    this.key = null;
  }
  begin() { this.mc.reset(); }
  ball(x, y, z, r, k = 1) {
    const res = this.res, f = this.mc.field, s2 = res * res;
    const R = r * 1.72 * (this.rs || 1); const Rc = R / this.size * res; // in cells
    const cx = (x / this.size + 0.5) * res, cy = (y / this.size + 0.5) * res, cz = (z / this.size + 0.5) * res;
    const x0 = Math.max(1, Math.floor(cx - Rc)), x1 = Math.min(res - 2, Math.ceil(cx + Rc));
    const y0 = Math.max(1, Math.floor(cy - Rc)), y1 = Math.min(res - 2, Math.ceil(cy + Rc));
    const z0 = Math.max(1, Math.floor(cz - Rc)), z1 = Math.min(res - 2, Math.ceil(cz + Rc));
    const inv = 1 / (Rc * Rc);
    for (let zz = z0; zz <= z1; zz++) {
      const dz = zz - cz, dz2 = dz * dz;
      for (let yy = y0; yy <= y1; yy++) {
        const dy = yy - cy, dzy = dz2 + dy * dy; if (dzy * inv >= 1) continue;
        const off = zz * s2 + yy * res;
        for (let xx = x0; xx <= x1; xx++) {
          const dx = xx - cx, q = (dzy + dx * dx) * inv;
          if (q < 1) { const a = 1 - q; const v = a * a * a; f[off + xx] += k * v * v; }
        }
      }
    }
  }
  end() { this.mc.update(); }
  // copy current surface into a static geometry (for ghosts)
  snapshot() {
    const g = new THREE.BufferGeometry(); const n = this.mc.count;
    g.setAttribute('position', new THREE.BufferAttribute(this.mc.positionArray.slice(0, n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.mc.normalArray.slice(0, n * 3), 3));
    return g;
  }
}

// ---------- variable radius tube ----------
export function makeTube(points, radiusFn, tubular = 64, radial = 16, closed = false, flatten = 1) {
  const curve = points.isCurve ? points : new THREE.CatmullRomCurve3(points, closed, 'centripetal');
  const frames = curve.computeFrenetFrames(tubular, closed);
  const pos = [], nor = [], uv = [], idx = [];
  for (let i = 0; i <= tubular; i++) {
    const u = i / tubular; const P = curve.getPointAt(u); const N = frames.normals[i], B = frames.binormals[i];
    const r = radiusFn(u);
    for (let j = 0; j <= radial; j++) {
      const v = j / radial * Math.PI * 2; const s = Math.sin(v), c = -Math.cos(v);
      const nx = c * N.x + s * B.x, ny = c * N.y + s * B.y, nz = c * N.z + s * B.z;
      pos.push(P.x + r * (c * N.x + s * B.x * flatten), P.y + r * (c * N.y + s * B.y * flatten), P.z + r * (c * N.z + s * B.z * flatten));
      nor.push(nx, ny, nz); uv.push(u, j / radial);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = i * (radial + 1) + j, b = (i + 1) * (radial + 1) + j;
    idx.push(a, b, a + 1, b, b + 1, a + 1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.curve = curve; return g;
}
export function setGeo(mesh, g) { if (mesh.geometry) mesh.geometry.dispose(); mesh.geometry = g; }

export const sphereGeo = new THREE.SphereGeometry(1, 40, 28);
export const sphereLo = new THREE.SphereGeometry(1, 20, 14);
export function ell(mat, rx, ry, rz, p) { const m = new THREE.Mesh(sphereGeo, mat); m.scale.set(rx, ry ?? rx, rz ?? rx); if (p) m.position.copy(p); return m; }

// orient object so its +Y points along dir
export function alignY(obj, dir) { obj.quaternion.setFromUnitVectors(V(0, 1, 0), dir.clone().normalize()); }
// cylinder segment between two points
export const cylGeo = new THREE.CylinderGeometry(1, 1, 1, 14, 1);
// elongated ellipsoid spanning a..b
export function ellBetween(mesh, a, b, r) {
  const d = b.clone().sub(a); const L = d.length();
  mesh.position.copy(a).addScaledVector(d, 0.5);
  if (L > 1e-6) alignY(mesh, d);
  mesh.scale.set(r, Math.max(L / 2 + r * 0.4, r), r);
}
