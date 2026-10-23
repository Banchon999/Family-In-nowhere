'use strict';
// ===== บันทึก / โหลด =====
const ARR_FIELDS = { terrain: Uint8Array, nat: Uint8Array, grow: Float32Array, cropT: Uint8Array, floor: Uint8Array, zone: Uint8Array, zoneCrop: Uint8Array, desig: Uint8Array, bmap: Int32Array };
const SAVE_SKIP = new Set(['reach', 'roomId', 'rooms', 'heaters', 'itemRes', 'cellRes', 'tRes', 'counts', 'mapDirty', 'terrainDirty', 'fx', 'sel', 'stockList', 'hasStock', 'outT']);
function rle(arr) { // บีบอัดข้อมูลซ้ำ
  const out = [];
  for (let i = 0; i < arr.length;) {
    let j = i; while (j < arr.length && arr[j] === arr[i]) j++;
    out.push(arr[i], j - i); i = j;
  }
  return out;
}
function unrle(a, T) {
  const out = new T(NT);
  let k = 0;
  for (let i = 0; i < a.length; i += 2) for (let n = 0; n < a[i + 1]; n++) out[k++] = a[i];
  return out;
}
function serialize() {
  const o = {};
  for (const k in G) {
    if (SAVE_SKIP.has(k)) continue;
    const v = G[k];
    if (ARR_FIELDS[k]) o[k] = rle(k === 'grow' ? Array.from(v, x => Math.round(x * 200) / 200) : Array.from(v));
    else if (k === 'items') o.items = [...v].map(([i, s]) => [i, s.t, s.n]);
    else if (k === 'pawns') o.pawns = v.map(p => Object.assign({}, p, { job: null, path: [], bubble: null }));
    else if (k === 'animals' || k === 'raiders') o[k] = v.filter(a => !a.dead && !a.gone).map(a => Object.assign({}, a, { path: [] }));
    else o[k] = v;
  }
  return JSON.stringify(o);
}
function saveGame() {
  if (!G || G.over) return;
  try { localStorage.setItem(SAVE_KEY, serialize()); }
  catch (e) { toast('บันทึกไม่สำเร็จ (พื้นที่เต็ม?)', 'bad'); }
}
function loadGame(str) {
  try {
    if (!str) str = localStorage.getItem(SAVE_KEY);
    if (!str) return false;
    const o = JSON.parse(str);
    if (!o.terrain || o.version !== 1) return false;
    G = {};
    for (const k in o) {
      if (ARR_FIELDS[k]) G[k] = unrle(o[k], ARR_FIELDS[k]);
      else if (k === 'items') G.items = new Map(o.items.map(([i, t, n]) => [i, { t, n }]));
      else G[k] = o[k];
    }
    setDayLen(G.dayLen || BASE_DAY);
    G.dayLen = DAY;
    initDerived();
    G.fx = []; G.sel = null; G.paused = false;
    for (const id in G.bld) { const b = G.bld[id]; b.inc = {}; if (b.cur) b.cur.inc = {}; }
    rebuildZoneLists();
    recalcMap();
    for (const p of G.pawns) {
      if (p.carry) { dropItem(p.carry.t, p.carry.n, Math.round(p.x), Math.round(p.y)); p.carry = null; }
      p.job = null; p.path = []; p.nextThink = 0;
    }
    recount();
    return true;
  } catch (e) { console.error(e); return false; }
}
