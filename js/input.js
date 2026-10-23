'use strict';
// ===== การควบคุม สัมผัส/เมาส์ =====
const INP = { ptrs: new Map(), mode: null, start: null, pinch: null, moved: false };

function toolCells(x0, y0, x1, y1, t) {
  const out = [];
  const line = t.kind === 'build' && (BDEF[t.type].wall || BDEF[t.type].cover) && !BDEF[t.type].door;
  if (line) {
    if (Math.abs(x1 - x0) >= Math.abs(y1 - y0)) { const s = Math.sign(x1 - x0) || 1; for (let x = x0; x !== x1 + s; x += s) out.push([x, y0]); }
    else { const s = Math.sign(y1 - y0) || 1; for (let y = y0; y !== y1 + s; y += s) out.push([x0, y]); }
  } else {
    const ax = Math.min(x0, x1), bx = Math.max(x0, x1), ay = Math.min(y0, y1), by = Math.max(y0, y1);
    for (let y = ay; y <= by; y++) for (let x = ax; x <= bx; x++) out.push([x, y]);
  }
  return out.filter(([x, y]) => inb(x, y)).slice(0, 600);
}
function toolValid(t, x, y) {
  if (!inb(x, y)) return false;
  const i = ix(x, y), n = G.nat[i];
  if (t.kind === 'build') return resDone(BDEF[t.type].res) && canPlace(t.type, x, y);
  if (t.kind === 'desig') {
    if (t.d === D_CHOP) return n === N_TREE && G.desig[i] !== D_CHOP;
    if (t.d === D_MINE) return (n === N_ROCK || n === N_ORE) && G.desig[i] !== D_MINE;
    if (t.d === D_HARVEST) return n === N_BUSH && G.desig[i] !== D_HARVEST;
    if (t.d === 'cancel') return !!G.desig[i] || (G.bmap[i] >= 0 && (!bAt(i).built || bAt(i).decon));
    if (t.d === 'decon') return G.bmap[i] >= 0 && bAt(i).built;
    if (t.d === 'hunt') return G.animals.some(a => !a.dead && Math.round(a.x) === x && Math.round(a.y) === y);
  }
  if (t.kind === 'zone') {
    const tr = G.terrain[i];
    if (t.z === 0) return G.zone[i] > 0;
    if (tr === T_WATER || tr === T_SHALLOW || n === N_ROCK || n === N_ORE) return false;
    if (t.z === Z_STOCK) return true;
    if (t.z === Z_FARM) return TER[tr].fert > 0 && n !== N_TREE && G.bmap[i] < 0 && !G.floor[i];
  }
  return false;
}
function applyTool(t, cells) {
  let n = 0;
  if (t.kind === 'desig' && t.d === 'hunt') {
    const xs = cells.map(c => c[0]), ys = cells.map(c => c[1]);
    const ax = Math.min(...xs) - 0.5, bx = Math.max(...xs) + 0.5, ay = Math.min(...ys) - 0.5, by = Math.max(...ys) + 0.5;
    for (const a of G.animals) if (!a.dead && a.x >= ax && a.x <= bx && a.y >= ay && a.y <= by) { a.hunt = true; n++; }
    if (n) toast(`🎯 สั่งล่าสัตว์ ${n} ตัว`, ''); else toast('ไม่มีสัตว์ในบริเวณนี้', 'bad');
    return;
  }
  for (const [x, y] of cells) {
    if (!toolValid(t, x, y)) continue;
    const i = ix(x, y);
    if (t.kind === 'build') { if (placeBlueprint(t.type, x, y)) n++; }
    else if (t.kind === 'desig') {
      if (t.d === 'cancel') {
        G.desig[i] = 0;
        const b = bAt(i);
        if (b && !b.built) removeBuilding(b);
        else if (b && b.decon) b.decon = false;
        n++;
      } else if (t.d === 'decon') { bAt(i).decon = true; n++; }
      else { G.desig[i] = t.d; n++; }
    } else if (t.kind === 'zone') {
      if (t.z === 0) { G.zone[i] = 0; G.zoneCrop[i] = 0; }
      else { G.zone[i] = t.z; G.zoneCrop[i] = t.z === Z_FARM ? t.crop : 0; }
      n++;
    }
  }
  if (t.kind === 'zone') rebuildZoneLists();
  if (n && t.kind === 'build') {
    const d = BDEF[t.type];
    const cost = Object.keys(d.cost).map(k => `${ITEMS[k].icon}${d.cost[k] * n}`).join(' ');
    toast(`วางแปลน ${d.name} ×${n} (ใช้ ${cost})`, '');
  }
}
function rebuildZoneLists() {
  G.stockList = [];
  for (let i = 0; i < NT; i++) if (G.zone[i] === Z_STOCK) G.stockList.push(i);
  G.hasStock = G.stockList.length > 0;
}

function tileAtScreen(sx, sy) { const [wx, wy] = s2w(sx, sy); return [Math.round(wx), Math.round(wy)]; }
function initInput() {
  const cv = R.cv;
  cv.addEventListener('pointerdown', e => {
    cv.setPointerCapture(e.pointerId);
    INP.ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (INP.ptrs.size === 1) {
      INP.start = { x: e.offsetX, y: e.offsetY, t: performance.now(), cx: G.cam.x, cy: G.cam.y };
      INP.moved = false;
      INP.mode = UI.tool ? 'tool' : 'pan';
      if (UI.tool) { const [tx, ty] = tileAtScreen(e.offsetX, e.offsetY); UI.drag = { x0: tx, y0: ty, x1: tx, y1: ty }; }
    } else if (INP.ptrs.size === 2) {
      UI.drag = null;
      INP.mode = 'pinch';
      const [a, b] = [...INP.ptrs.values()];
      INP.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: G.cam.z, mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, cx: G.cam.x, cy: G.cam.y };
    }
  });
  cv.addEventListener('pointermove', e => {
    if (!INP.ptrs.has(e.pointerId)) return;
    INP.ptrs.set(e.pointerId, { x: e.offsetX, y: e.offsetY });
    if (INP.mode === 'pinch' && INP.ptrs.size >= 2) {
      const [a, b] = [...INP.ptrs.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      const P = INP.pinch;
      G.cam.z = U.clamp(P.z * d / P.d, 0.45, 3);
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const ts = camScale();
      // จุดกึ่งกลางนิ้วคงที่บนโลก
      const wx = (P.mx - R.W / 2) / (TILE * P.z) + P.cx, wy = (P.my - R.H / 2) / (TILE * P.z) + P.cy;
      G.cam.x = wx - (mx - R.W / 2) / ts; G.cam.y = wy - (my - R.H / 2) / ts;
      clampCam();
      return;
    }
    const s = INP.start;
    if (!s) return;
    const dx = e.offsetX - s.x, dy = e.offsetY - s.y;
    if (Math.hypot(dx, dy) > 8) INP.moved = true;
    if (INP.mode === 'pan' && INP.moved) {
      const ts = camScale();
      G.cam.x = s.cx - dx / ts; G.cam.y = s.cy - dy / ts;
      UI.follow = null;
      clampCam();
    } else if (INP.mode === 'tool' && UI.drag) {
      const [tx, ty] = tileAtScreen(e.offsetX, e.offsetY);
      UI.drag.x1 = tx; UI.drag.y1 = ty;
    }
  });
  const up = e => {
    if (!INP.ptrs.has(e.pointerId)) return;
    INP.ptrs.delete(e.pointerId);
    if (INP.mode === 'pinch') { if (INP.ptrs.size === 0) INP.mode = null; INP.start = null; return; }
    if (INP.ptrs.size) return;
    if (INP.mode === 'tool' && UI.drag && UI.tool) {
      const d = UI.drag;
      applyTool(UI.tool, toolCells(d.x0, d.y0, d.x1, d.y1, UI.tool));
      UI.drag = null;
    } else if (INP.mode === 'pan' && !INP.moved) {
      tapAt(e.offsetX, e.offsetY);
    }
    INP.mode = null; INP.start = null;
  };
  cv.addEventListener('pointerup', up);
  cv.addEventListener('pointercancel', e => { INP.ptrs.delete(e.pointerId); UI.drag = null; INP.mode = null; });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const [wx, wy] = s2w(e.offsetX, e.offsetY);
    G.cam.z = U.clamp(G.cam.z * (e.deltaY < 0 ? 1.12 : 0.89), 0.45, 3);
    const ts = camScale();
    G.cam.x = wx - (e.offsetX - R.W / 2) / ts; G.cam.y = wy - (e.offsetY - R.H / 2) / ts;
    clampCam();
  }, { passive: false });
  window.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || !G) return;
    if (e.key === ' ') { e.preventDefault(); togglePause(); }
    else if (e.key === '1') setSpeed(1); else if (e.key === '2') setSpeed(2); else if (e.key === '3') setSpeed(4);
    else if (e.key === 'Escape') { setTool(null); closeSheet(); }
    else if (e.key === 'w' || e.key === 'ArrowUp') G.cam.y -= 2;
    else if (e.key === 's' || e.key === 'ArrowDown') G.cam.y += 2;
    else if (e.key === 'a' || e.key === 'ArrowLeft') G.cam.x -= 2;
    else if (e.key === 'd' || e.key === 'ArrowRight') G.cam.x += 2;
    clampCam();
  });
}
function tapAt(sx, sy) {
  const [wx, wy] = s2w(sx, sy);
  // หาสิ่งมีชีวิตใกล้จุดแตะ
  let best = null, bd = 0.75;
  const all = [].concat(G.pawns.filter(p => !p.dead), G.raiders.filter(r => !r.dead), G.animals.filter(a => !a.dead));
  for (const c of all) {
    const d = U.dist(wx, wy, c.x, c.y - 0.25);
    if (d < bd) { bd = d; best = c; }
  }
  const tx = Math.round(wx), ty = Math.round(wy);
  const cur = G.sel && G.sel.kind === 'pawn' ? G.sel.obj : null;
  // สั่งตัวละครที่เกณฑ์
  if (cur && cur.drafted && !cur.dead) {
    if (best && (best.kind === 'raider' || (best.kind === 'animal'))) { cur.order = { type: 'attack', id: best.id }; cur.path = []; toast(`⚔️ ${cur.name} โจมตี!`, ''); return; }
    if (!best && inb(tx, ty) && !solidAt(ix(tx, ty))) { cur.order = { type: 'move', t: ix(tx, ty) }; cur.path = []; G.fx.push({ k: 'hit', x: tx, y: ty, t: G.tick }); return; }
  }
  if (best) { select(best.kind === 'pawn' ? 'pawn' : best.kind, best); return; }
  if (!inb(tx, ty)) { select(null); return; }
  const b = bAt(ix(tx, ty));
  if (b) { select('building', b); return; }
  select('tile', null, tx, ty);
}
