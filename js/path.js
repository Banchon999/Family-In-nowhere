'use strict';
// A* บนกริด 8 ทิศ
const PF = {
  g: new Float32Array(NT), came: new Int32Array(NT),
  seen: new Uint32Array(NT), closed: new Uint32Array(NT), stamp: 0,
  hi: [], hf: [],
};
function heapPush(i, f) {
  const H = PF.hi, F = PF.hf;
  H.push(i); F.push(f);
  let n = H.length - 1;
  while (n > 0) {
    const p = (n - 1) >> 1;
    if (F[p] <= F[n]) break;
    [H[p], H[n]] = [H[n], H[p]]; [F[p], F[n]] = [F[n], F[p]]; n = p;
  }
}
function heapPop() {
  const H = PF.hi, F = PF.hf;
  const top = H[0];
  const li = H.pop(), lf = F.pop();
  if (H.length) {
    H[0] = li; F[0] = lf;
    let n = 0;
    for (;;) {
      const l = n * 2 + 1, r = l + 1;
      let m = n;
      if (l < H.length && F[l] < F[m]) m = l;
      if (r < H.length && F[r] < F[m]) m = r;
      if (m === n) break;
      [H[m], H[n]] = [H[n], H[m]]; [F[m], F[n]] = [F[n], F[m]]; n = m;
    }
  }
  return top;
}
function enemyPass(i) {
  const n = G.nat[i];
  if (n === N_ROCK || n === N_ORE) return false;
  return G.terrain[i] !== T_WATER;
}
function stepCost(i, enemy) {
  let c = moveCost(i);
  if (enemy && enemyBlockAt(i)) c += 14;
  return c;
}
// adj=true: ไปยืนช่องติดกับเป้าหมาย (ไม่ใช่ช่องเป้าหมาย)
function findPath(sx, sy, tx, ty, adj, enemy) {
  if (!inb(tx, ty) || !inb(sx, sy)) return null;
  const pass = enemy ? enemyPass : (i => !solidAt(i));
  const s = ix(sx, sy), t = ix(tx, ty);
  const isGoal = adj
    ? (i => { const x = ixX(i), y = ixY(i); return i !== t && Math.abs(x - tx) <= 1 && Math.abs(y - ty) <= 1; })
    : (i => i === t);
  if (isGoal(s)) return [];
  if (!adj && !pass(t)) return null;
  const st = ++PF.stamp;
  PF.hi.length = 0; PF.hf.length = 0;
  PF.g[s] = 0; PF.seen[s] = st; PF.came[s] = -1;
  const h = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return (dx + dy) + (1.414 - 2) * Math.min(dx, dy); };
  heapPush(s, h(sx, sy));
  let iter = 0, found = -1;
  while (PF.hi.length && iter++ < 9000) {
    const c = heapPop();
    if (PF.closed[c] === st) continue;
    PF.closed[c] = st;
    if (isGoal(c)) { found = c; break; }
    const cx = ixX(c), cy = ixY(c);
    for (let k = 0; k < 8; k++) {
      const dx = N8[k][0], dy = N8[k][1];
      const nx = cx + dx, ny = cy + dy;
      if (!inb(nx, ny)) continue;
      const j = ix(nx, ny);
      if (PF.closed[j] === st || !pass(j)) continue;
      if (dx && dy && (!pass(ix(cx + dx, cy)) || !pass(ix(cx, cy + dy)))) continue;
      const ng = PF.g[c] + stepCost(j, enemy) * (dx && dy ? 1.414 : 1);
      if (PF.seen[j] !== st || ng < PF.g[j]) {
        PF.seen[j] = st; PF.g[j] = ng; PF.came[j] = c;
        heapPush(j, ng + h(nx, ny));
      }
    }
  }
  if (found < 0) return null;
  const path = [];
  for (let c = found; c !== s; c = PF.came[c]) path.push(c);
  path.reverse();
  return path;
}
// ตรวจทางเดินถึงอย่างรวดเร็วด้วย component
function canReach(from, to, adj) {
  const rc = G.reach[from];
  if (rc < 0) return true; // ยืนอยู่ในที่แปลก ให้ลองหาเส้นทางจริง
  if (!adj) return G.reach[to] === rc;
  const x = ixX(to), y = ixY(to);
  for (const [dx, dy] of N8) {
    const nx = x + dx, ny = y + dy;
    if (inb(nx, ny) && G.reach[ix(nx, ny)] === rc) return true;
  }
  return false;
}
// มองเห็นกันหรือไม่ (กำแพงบัง)
function lineClear(x0, y0, x1, y1) {
  x0 = Math.round(x0); y0 = Math.round(y0); x1 = Math.round(x1); y1 = Math.round(y1);
  const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  for (;;) {
    if (x0 === x1 && y0 === y1) return true;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x0 += sx; }
    if (e2 <= dx) { err += dx; y0 += sy; }
    if (x0 === x1 && y0 === y1) return true;
    const i = ix(x0, y0);
    const n = G.nat[i];
    if (n === N_ROCK || n === N_ORE) return false;
    const b = bAt(i);
    if (b && b.built && BDEF[b.type].wall) return false;
  }
}
