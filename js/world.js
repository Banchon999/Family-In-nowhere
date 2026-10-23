'use strict';
let G = null; // สถานะเกมทั้งหมด

function newMapArrays() {
  G.terrain = new Uint8Array(NT);
  G.nat = new Uint8Array(NT);
  G.grow = new Float32Array(NT);
  G.cropT = new Uint8Array(NT);
  G.floor = new Uint8Array(NT);
  G.zone = new Uint8Array(NT);
  G.zoneCrop = new Uint8Array(NT);
  G.desig = new Uint8Array(NT);
  G.bmap = new Int32Array(NT).fill(-1);
}
function initDerived() {
  G.reach = new Int32Array(NT);
  G.roomId = new Int32Array(NT);
  G.rooms = [null];
  G.heaters = [];
  G.itemRes = new Map();   // idx -> หน่วยที่ถูกจองไว้
  G.cellRes = new Set();   // ช่องคลังที่ถูกจองไว้
  G.tRes = new Map();      // เป้าหมายงานที่ถูกจองไว้ -> pawn id
  G.counts = {};
  G.mapDirty = true;
  G.terrainDirty = true;
}

function genWorld(seed) {
  newMapArrays();
  const nE = makeNoise(seed), nM = makeNoise(seed + 101), nS = makeNoise(seed + 202), nT = makeNoise(seed + 303);
  U.seed(seed * 7 + 3);
  const cx = MAP_W / 2, cy = MAP_H / 2;
  const E = new Float32Array(NT), M = new Float32Array(NT);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = ix(x, y), d = U.dist(x, y, cx, cy) / (MAP_W / 2);
    E[i] = nE(x / 13, y / 13) - (d < 0.3 ? (0.3 - d) * 1.5 : 0);
    M[i] = nM(x / 11 + 50, y / 11 + 50) + (d < 0.3 ? (0.3 - d) * 1.5 : 0);
  }
  const q = (A, p) => { const s = Array.from(A).sort((a, b) => a - b); return s[Math.floor(p * (s.length - 1))]; };
  const rockT = q(E, 0.8), waterT = q(M, 0.05), shallowT = q(M, 0.085), sandT = q(M, 0.12);
  for (let y = 0; y < MAP_H; y++) for (let x = 0; x < MAP_W; x++) {
    const i = ix(x, y), d = U.dist(x, y, cx, cy) / (MAP_W / 2);
    G.terrain[i] = T_GRASS;
    if (E[i] > rockT) {
      G.terrain[i] = T_RFLOOR;
      G.nat[i] = (nS(x / 4, y / 4) > 0.62 && U.srand() < 0.7) ? N_ORE : N_ROCK;
    } else if (M[i] < shallowT) {
      G.terrain[i] = M[i] < waterT ? T_WATER : T_SHALLOW;
    } else if (M[i] < sandT) {
      G.terrain[i] = T_SAND;
      if (U.srand() < 0.03) { G.nat[i] = N_BUSH; G.grow[i] = U.srand(); }
    } else {
      if (nS(x / 7 + 20, y / 7 + 20) > 0.58) G.terrain[i] = T_SOIL;
      const tr = nT(x / 6, y / 6);
      if (d > 0.13 && U.srand() < (tr > 0.55 ? 0.5 : 0.07)) { G.nat[i] = N_TREE; G.grow[i] = 0.55 + U.srand() * 0.45; }
      else if (d > 0.1 && U.srand() < 0.03) { G.nat[i] = N_BUSH; G.grow[i] = 0.5 + U.srand() * 0.5; }
    }
  }
  connectRegions();
}
// เชื่อมพื้นที่ที่ถูกหินล้อมให้เดินถึงกันหมด
function connectRegions() {
  const pass = i => !(G.nat[i] === N_ROCK || G.nat[i] === N_ORE || G.terrain[i] === T_WATER);
  for (let iter = 0; iter < 30; iter++) {
    const comp = new Int32Array(NT).fill(-1), sizes = [], st = [];
    let n = 0;
    for (let s = 0; s < NT; s++) {
      if (comp[s] >= 0 || !pass(s)) continue;
      let size = 0; st.push(s); comp[s] = n;
      while (st.length) {
        const i = st.pop(); size++;
        const x = ixX(i), y = ixY(i);
        for (const [dx, dy] of N4) {
          const nx = x + dx, ny = y + dy;
          if (!inb(nx, ny)) continue;
          const j = ix(nx, ny);
          if (comp[j] < 0 && pass(j)) { comp[j] = n; st.push(j); }
        }
      }
      sizes.push(size); n++;
    }
    const main = comp[ix(MAP_W / 2, MAP_H / 2)];
    let target = -1;
    for (let c = 0; c < n; c++) if (c !== main && sizes[c] >= 12) { target = c; break; }
    if (target < 0) {
      // ช่องเล็กๆ ที่แยกอยู่ ถมเป็นหิน
      for (let i = 0; i < NT; i++) if (comp[i] >= 0 && comp[i] !== main && pass(i)) { G.nat[i] = N_ROCK; G.terrain[i] = T_RFLOOR; }
      return;
    }
    // ขุดอุโมงค์จากพื้นที่นั้นไปหาพื้นที่หลักที่ใกล้ที่สุด
    let best = null, bd = 1e9;
    for (let i = 0; i < NT; i += 3) {
      if (comp[i] !== target) continue;
      for (let j = 0; j < NT; j += 5) {
        if (comp[j] !== main) continue;
        const d = Math.abs(ixX(i) - ixX(j)) + Math.abs(ixY(i) - ixY(j));
        if (d < bd) { bd = d; best = [i, j]; }
      }
    }
    if (!best) return;
    let x = ixX(best[0]), y = ixY(best[0]);
    const tx = ixX(best[1]), ty = ixY(best[1]);
    while (x !== tx || y !== ty) {
      if (x !== tx && (y === ty || U.srand() < 0.5)) x += Math.sign(tx - x); else y += Math.sign(ty - y);
      const i = ix(x, y);
      if (G.nat[i] === N_ROCK || G.nat[i] === N_ORE) G.nat[i] = N_NONE;
      if (G.terrain[i] === T_WATER) G.terrain[i] = T_SHALLOW;
    }
  }
}

// ===== การเดินผ่าน =====
function bAt(i) { const id = G.bmap[i]; return id >= 0 ? G.bld[id] : null; }
function solidAt(i) {
  const n = G.nat[i];
  if (n === N_ROCK || n === N_ORE) return true;
  if (G.terrain[i] === T_WATER) return true;
  const b = bAt(i);
  return !!(b && b.built && BDEF[b.type].solid);
}
// สิ่งที่ศัตรูต้องทำลายก่อนผ่าน
function enemyBlockAt(i) {
  const b = bAt(i);
  return (b && b.built && (BDEF[b.type].solid || BDEF[b.type].door)) ? b : null;
}
function moveCost(i) {
  let c = TER[G.terrain[i]].cost;
  const n = G.nat[i];
  if (n === N_TREE) c *= 1.6; else if (n === N_BUSH) c *= 1.2;
  if (G.floor[i]) c *= 0.8;
  return c;
}
function isBoundary(i) {
  const n = G.nat[i];
  if (n === N_ROCK || n === N_ORE) return true;
  const b = bAt(i);
  return !!(b && b.built && BDEF[b.type].wall);
}

function recalcMap() {
  const reach = G.reach; reach.fill(-1);
  const st = new Int32Array(NT);
  let comp = 0;
  for (let s = 0; s < NT; s++) {
    if (reach[s] >= 0 || solidAt(s)) continue;
    let sp = 0; st[sp++] = s; reach[s] = comp;
    while (sp) {
      const i = st[--sp], x = ixX(i), y = ixY(i);
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = ix(nx, ny);
        if (reach[j] < 0 && !solidAt(j)) { reach[j] = comp; st[sp++] = j; }
      }
    }
    comp++;
  }
  // ห้อง
  const rid = G.roomId; rid.fill(-2);
  G.rooms = [null];
  const tiles = [];
  for (let s = 0; s < NT; s++) {
    if (rid[s] !== -2) continue;
    if (isBoundary(s)) { rid[s] = -1; continue; }
    tiles.length = 0;
    let sp = 0; st[sp++] = s; rid[s] = -3;
    let edge = false;
    while (sp) {
      const i = st[--sp], x = ixX(i), y = ixY(i);
      tiles.push(i);
      if (x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) edge = true;
      for (const [dx, dy] of N4) {
        const nx = x + dx, ny = y + dy;
        if (!inb(nx, ny)) continue;
        const j = ix(nx, ny);
        if (rid[j] !== -2) continue;
        if (isBoundary(j)) { rid[j] = -1; continue; }
        rid[j] = -3; st[sp++] = j;
      }
    }
    if (edge || tiles.length > 400) { for (const i of tiles) rid[i] = 0; }
    else {
      const id = G.rooms.length;
      G.rooms.push({ id, size: tiles.length, heat: 0, cool: 0, beauty: 0, temp: 15, tiles: tiles.slice() });
      for (const i of tiles) rid[i] = id;
    }
  }
  G.heaters = [];
  for (const id in G.bld) {
    const b = G.bld[id]; if (!b.built) continue;
    const d = BDEF[b.type], i = ix(b.x, b.y), r = rid[i];
    if (r > 0) {
      const room = G.rooms[r];
      room.heat += d.heat || 0; room.cool += d.cool ? 1 : 0; room.beauty += d.beauty || 0;
    } else if (d.heat) G.heaters.push(b);
  }
  for (let r = 1; r < G.rooms.length; r++) {
    const room = G.rooms[r];
    for (const i of room.tiles) room.beauty += G.floor[i] * 0.5;
    room.beautyPer = room.beauty / room.size;
  }
  G.mapDirty = false;
  updateTemps();
}

// ===== อุณหภูมิ =====
function dayNum() { return Math.floor(G.tick / DAY) + 1; }
function seasonIdx() { return Math.floor(((G.tick / DAY) % YEAR_DAYS) / SEASON_DAYS); }
function yearNum() { return Math.floor(G.tick / DAY / YEAR_DAYS) + 1; }
function hourNow() { return (G.tick % DAY) / HOUR; }
function isNight() { const h = hourNow(); return h >= 21 || h < 5.5; }
function outdoorTemp() {
  const sF = ((G.tick / DAY) % YEAR_DAYS) / SEASON_DAYS;
  const si = Math.floor(sF), fr = sF - si;
  let base = SEASONS[si].temp;
  if (fr > 0.75) base = U.lerp(base, SEASONS[(si + 1) % 4].temp, (fr - 0.75) / 0.25 * 0.4);
  if (fr < 0.25) base = U.lerp(base, SEASONS[(si + 3) % 4].temp, (0.25 - fr) / 0.25 * 0.4);
  const daily = -Math.cos((hourNow() - 4) / 24 * Math.PI * 2) * 6;
  return base + daily + (G.story.tempMod || 0);
}
function updateTemps() {
  G.outT = outdoorTemp();
  const hf = U.clamp((22 - G.outT) / 10, 0, 1);
  for (let r = 1; r < G.rooms.length; r++) {
    const room = G.rooms[r];
    room.temp = G.outT * 0.55 + 8 + room.heat * hf * 20 / Math.max(16, room.size) - (room.cool ? 22 : 0);
  }
}
function tempAt(i) {
  const r = G.roomId[i];
  if (r > 0) return G.rooms[r].temp;
  let t = G.outT;
  if (G.heaters.length) {
    const hf = U.clamp((22 - G.outT) / 10, 0, 1);
    const x = ixX(i), y = ixY(i);
    for (const b of G.heaters) {
      const d = U.dist(x, y, b.x, b.y);
      if (d < 3.5) t += BDEF[b.type].heat * 0.9 * (1 - d / 3.5) * hf;
    }
  }
  return t;
}
function isIndoor(i) { return G.roomId[i] > 0; }

// ===== สิ่งของ =====
function canHold(i, type) {
  if (solidAt(i)) return false;
  const tr = G.terrain[i];
  if (tr === T_WATER || tr === T_SHALLOW) return false;
  const b = bAt(i);
  if (b && !b.built && BDEF[b.type].solid) return false;
  const s = G.items.get(i);
  return !s || (s.t === type && s.n < ITEMS[type].stack);
}
function dropItem(type, n, x, y) {
  n = Math.floor(n);
  if (n <= 0) return;
  for (let r = 0; r < 14 && n > 0; r++) {
    for (let dy = -r; dy <= r && n > 0; dy++) for (let dx = -r; dx <= r && n > 0; dx++) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
      const nx = x + dx, ny = y + dy;
      if (!inb(nx, ny)) continue;
      const i = ix(nx, ny);
      if (!canHold(i, type)) continue;
      let s = G.items.get(i);
      if (!s) { s = { t: type, n: 0 }; G.items.set(i, s); }
      const k = Math.min(n, ITEMS[type].stack - s.n);
      s.n += k; n -= k;
    }
  }
}
function itemAvail(i) {
  const s = G.items.get(i);
  return s ? s.n - (G.itemRes.get(i) || 0) : 0;
}
function takeItem(i, n) {
  const s = G.items.get(i);
  if (!s) return 0;
  const k = Math.min(n, s.n);
  s.n -= k;
  if (s.n <= 0) G.items.delete(i);
  return k;
}
function recount() {
  const c = {};
  for (const k in ITEMS) c[k] = 0;
  for (const s of G.items.values()) c[s.t] += s.n;
  G.counts = c;
  return c;
}
function foodUnits() {
  const c = G.counts;
  return c.veg + c.meat + c.meal * 5 + c.finemeal * 6;
}
function isStockpile(i) { return G.zone[i] === Z_STOCK; }

// ===== สิ่งก่อสร้าง =====
function resDone(r) { return !r || !!G.research.done[r]; }
function canPlace(type, x, y) {
  if (!inb(x, y)) return false;
  const i = ix(x, y), d = BDEF[type], tr = G.terrain[i];
  if (tr === T_WATER || tr === T_SHALLOW) return false;
  if (G.bmap[i] >= 0) return false;
  if (d.floor && G.floor[i] === d.floor) return false;
  return true;
}
function defaultBills(type) {
  const st = BDEF[type].station;
  if (st === 'cook' || st === 'craft') {
    return Object.keys(RECIPES).filter(r => RECIPES[r].st === st).map(r => ({ r, n: RECIPES[r].def }));
  }
  return null;
}
function placeBlueprint(type, x, y) {
  if (!canPlace(type, x, y)) return null;
  const id = G.nextId++;
  const d = BDEF[type];
  const b = { id, type, x, y, built: false, prog: 0, del: {}, inc: {}, hp: d.hp || 30 };
  if (d.station) { b.bills = defaultBills(type); b.cur = null; }
  G.bld[id] = b;
  const i = ix(x, y), n = G.nat[i];
  G.bmap[i] = id;
  if (n === N_TREE) G.desig[i] = D_CHOP;
  else if (n === N_ROCK || n === N_ORE) G.desig[i] = D_MINE;
  return b;
}
function needOf(target) { // วัตถุดิบที่ยังขาด {type: n}
  const out = {};
  let cost;
  if (target.cur !== undefined && target.built) {
    if (!target.cur) return out;
    cost = {};
    for (const [cls, n] of RECIPES[target.cur.r].ing) cost[cls] = n;
    target = target.cur;
  } else cost = BDEF[target.type].cost;
  for (const k in cost) {
    const rem = cost[k] - (target.del[k] || 0) - (target.inc[k] || 0);
    if (rem > 0) out[k] = rem;
  }
  return out;
}
function fullyDelivered(target) {
  let cost;
  if (target.cur !== undefined && target.built) {
    if (!target.cur) return false;
    cost = {};
    for (const [cls, n] of RECIPES[target.cur.r].ing) cost[cls] = n;
    target = target.cur;
  } else cost = BDEF[target.type].cost;
  for (const k in cost) if ((target.del[k] || 0) < cost[k]) return false;
  return true;
}
function completeBuilding(b) {
  const d = BDEF[b.type], i = ix(b.x, b.y);
  b.built = true; b.hp = d.hp || 30; b.del = {}; b.inc = {};
  if (d.floor) {
    G.floor[i] = d.floor;
    delete G.bld[b.id];
    G.bmap[i] = -1;
    G.terrainDirty = true;
  } else {
    if (G.nat[i] === N_BUSH || G.nat[i] === N_CROP) G.nat[i] = N_NONE;
    if (d.solid && G.items.has(i)) {
      const s = G.items.get(i); G.items.delete(i);
      dropItem(s.t, s.n, b.x, b.y);
    }
  }
  G.mapDirty = true;
  onBuilt(b);
}
function removeBuilding(b, refund) {
  const d = BDEF[b.type], i = ix(b.x, b.y);
  if (G.bld[b.id] !== b) return;
  delete G.bld[b.id];
  G.bmap[i] = -1;
  if (!b.built) { for (const k in b.del) dropItem(k, b.del[k], b.x, b.y); }
  else {
    if (refund) for (const k in d.cost) dropItem(k, Math.floor(d.cost[k] * refund), b.x, b.y);
    if (b.cur && b.cur.delT) for (const k in b.cur.delT) dropItem(k, b.cur.delT[k], b.x, b.y);
  }
  G.tRes.delete('b' + b.id);
  G.mapDirty = true;
}
function buildingsOf(pred) {
  const out = [];
  for (const id in G.bld) { const b = G.bld[id]; if (pred(b)) out.push(b); }
  return out;
}
function hasBuilt(type) { for (const id in G.bld) { const b = G.bld[id]; if (b.built && b.type === type) return true; } return false; }

// ===== พืช อาหารเน่า =====
function growthFactor(t) { return t < 3 ? 0 : t < 9 ? 0.5 : t > 40 ? 0.3 : t > 34 ? 0.7 : 1; }
function plantsTick() { // ทุก 60 tick
  let frozen = 0;
  for (let i = 0; i < NT; i++) {
    const n = G.nat[i];
    if (n !== N_TREE && n !== N_BUSH && n !== N_CROP) continue;
    if (G.grow[i] >= 1) continue;
    const t = tempAt(i);
    let days = n === N_TREE ? 14 : n === N_BUSH ? 4 : CROPS[G.cropT[i]].days;
    let fert = n === N_CROP ? TER[G.terrain[i]].fert : 1;
    if (n === N_CROP && t < -3) { G.nat[i] = N_NONE; frozen++; continue; }
    G.grow[i] = Math.min(1, G.grow[i] + 60 / (days * DAY) * fert * growthFactor(t));
  }
  if (frozen > 2) addLog(`❄️ พืชผล ${frozen} ต้นตายเพราะความหนาว`, 'bad');
}
function spawnWildPlants() {
  const s = seasonIdx();
  if (s === 3) return;
  for (let k = 0; k < 6; k++) {
    const i = Math.floor(Math.random() * NT);
    if (G.nat[i] || G.terrain[i] !== T_GRASS || G.zone[i] || G.bmap[i] >= 0 || G.floor[i] || G.items.has(i)) continue;
    if (Math.random() < 0.7) { G.nat[i] = N_TREE; G.grow[i] = 0.05; } else { G.nat[i] = N_BUSH; G.grow[i] = 0; }
  }
}
function spoilTick() { // ทุก 240 tick
  let lost = 0;
  for (const [i, s] of G.items) {
    const d = ITEMS[s.t];
    if (!d.perish) continue;
    const r = G.roomId[i];
    const t = tempAt(i);
    let rate = 0;
    if (!(r > 0 && G.rooms[r].cool) && t > 0) rate = (r > 0 ? 0.035 : 0.07) * d.perish * (t > 25 ? 1.4 : 1);
    if (!rate) continue;
    s.rot = (s.rot || 0) + s.n * rate / 10;
    if (s.rot >= 1) {
      const k = Math.floor(s.rot); s.rot -= k; s.n -= k; lost += k;
      if (s.n <= 0) G.items.delete(i);
    }
  }
  G.spoiledToday = (G.spoiledToday || 0) + lost;
}
function dailyProduction() {
  for (const id in G.bld) {
    const b = G.bld[id];
    if (b.built && BDEF[b.type].coop && tempAt(ix(b.x, b.y)) > -6) dropItem('meat', 5, b.x, b.y + 1);
  }
}
function wealth() {
  let w = 0;
  for (const s of G.items.values()) w += ITEMS[s.t].val * s.n;
  for (const id in G.bld) {
    const b = G.bld[id]; if (!b.built) continue;
    for (const k in BDEF[b.type].cost) w += BDEF[b.type].cost[k] * ITEMS[k].val * 1.5;
  }
  for (const p of G.pawns) if (!p.dead) { if (p.weapon) w += ITEMS[p.weapon].val; if (p.coat) w += 60; }
  return Math.floor(w);
}
function onBuilt(b) {
  const d = BDEF[b.type];
  if (d.bed || d.crib) assignBeds();
}
