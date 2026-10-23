'use strict';
const U = {
  _s: 1,
  seed(s) { this._s = s >>> 0 || 1; },
  srand() { // seeded (ใช้ตอนสร้างแผนที่)
    let t = (this._s += 0x6D2B79F5) | 0;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },
  r() { return Math.random(); },
  ri(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
  pick(a) { return a[Math.floor(Math.random() * a.length)]; },
  chance(p) { return Math.random() < p; },
  clamp(v, a, b) { return v < a ? a : v > b ? b : v; },
  lerp(a, b, t) { return a + (b - a) * t; },
  dist(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); },
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  fmt(n) { return Math.floor(n).toLocaleString('th-TH'); },
};

// value noise สำหรับสร้างแผนที่
function makeNoise(seed) {
  const P = new Float32Array(256 * 256);
  U.seed(seed);
  for (let i = 0; i < P.length; i++) P[i] = U.srand();
  const at = (x, y) => P[((y & 255) << 8) | (x & 255)];
  const sm = t => t * t * (3 - 2 * t);
  function n(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = sm(x - xi), yf = sm(y - yi);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return U.lerp(U.lerp(a, b, xf), U.lerp(c, d, xf), yf);
  }
  return function fbm(x, y, oct = 4) {
    let v = 0, amp = 0.5, f = 1, tot = 0;
    for (let o = 0; o < oct; o++) { v += n(x * f, y * f) * amp; tot += amp; amp *= 0.5; f *= 2; }
    return v / tot;
  };
}

const ix = (x, y) => y * MAP_W + x;
const inb = (x, y) => x >= 0 && y >= 0 && x < MAP_W && y < MAP_H;
const ixX = i => i % MAP_W;
const ixY = i => (i / MAP_W) | 0;
const N8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, 1], [1, -1], [-1, -1]];
const N4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
