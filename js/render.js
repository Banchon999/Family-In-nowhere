'use strict';
const R = { cv: null, ctx: null, terrain: null, light: null, W: 0, H: 0, dpr: 1, snow: [] };

function initRender() {
  R.cv = document.getElementById('game');
  R.ctx = R.cv.getContext('2d');
  R.terrain = mkCanvas(MAP_W * PX, MAP_H * PX);
  R.light = mkCanvas(4, 4);
  resize();
  window.addEventListener('resize', resize);
  for (let k = 0; k < 90; k++) R.snow.push([Math.random(), Math.random(), 0.3 + Math.random() * 0.7]);
}
function resize() {
  R.dpr = Math.min(window.devicePixelRatio || 1, 2);
  const r = R.cv.getBoundingClientRect();
  R.W = Math.max(1, r.width); R.H = Math.max(1, r.height);
  R.cv.width = Math.round(R.W * R.dpr); R.cv.height = Math.round(R.H * R.dpr);
  R.light.width = Math.round(R.W / 2); R.light.height = Math.round(R.H / 2);
}

// ----- พื้นผิว (cache) -----
function hash(i, k) { let h = (i * 374761393 + k * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
const TER_RGB = [[93, 138, 60], [104, 78, 50], [205, 183, 124], [79, 143, 176], [44, 92, 132], [112, 106, 100]];
function buildTerrain() {
  const ctx = R.terrain.getContext('2d');
  const img = ctx.createImageData(MAP_W * PX, MAP_H * PX);
  const d = img.data, W = MAP_W * PX;
  const winter = seasonIdx() === 3, fall = seasonIdx() === 2;
  for (let ty = 0; ty < MAP_H; ty++) for (let tx = 0; tx < MAP_W; tx++) {
    const i = ix(tx, ty), t = G.terrain[i], fl = G.floor[i];
    let base = TER_RGB[t];
    if (t === T_GRASS && winter) base = [214, 224, 228];
    else if (t === T_GRASS && fall) base = [130, 132, 62];
    for (let py = 0; py < PX; py++) for (let px = 0; px < PX; px++) {
      const o = ((ty * PX + py) * W + tx * PX + px) * 4;
      let r = base[0], g = base[1], b = base[2];
      const n = hash(i * 256 + py * 16 + px, 7);
      if (fl === 1) { // พื้นไม้
        const plank = Math.floor((py + (Math.floor(px / 8) % 2) * 2) / 4);
        r = 150 + (plank % 2) * 14; g = 104 + (plank % 2) * 10; b = 62;
        if ((py + (Math.floor(px / 8) % 2) * 2) % 4 === 0) { r -= 40; g -= 30; b -= 20; }
        r += n * 10 - 5;
      } else if (fl === 2) { // พื้นหิน
        r = 150; g = 146; b = 140;
        if (px % 8 === 0 || py % 8 === 0) { r = 110; g = 106; b = 100; }
        r += n * 14 - 7; g += n * 14 - 7; b += n * 14 - 7;
      } else {
        const v = (n - 0.5) * 18;
        r += v; g += v; b += v;
        if (t === T_GRASS && !winter && n > 0.86) { r -= 22; g -= 10; b -= 18; }
        if (t === T_GRASS && winter && n > 0.9) { r -= 30; g -= 26; b -= 20; }
        if (t === T_SOIL && n > 0.85) { r -= 18; g -= 14; b -= 10; }
        if ((t === T_WATER || t === T_SHALLOW) && py % 5 === 0 && n > 0.7) { r += 30; g += 30; b += 30; }
      }
      d[o] = r; d[o + 1] = g; d[o + 2] = b; d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  G.terrainDirty = false;
  R.terrainSeason = seasonIdx();
}

// ----- พิกัด -----
function camScale() { return TILE * G.cam.z; }
function w2s(x, y) { const ts = camScale(); return [R.W / 2 + (x - G.cam.x) * ts, R.H / 2 + (y - G.cam.y) * ts]; }
function s2w(sx, sy) { const ts = camScale(); return [(sx - R.W / 2) / ts + G.cam.x, (sy - R.H / 2) / ts + G.cam.y]; }
function clampCam() {
  G.cam.x = U.clamp(G.cam.x, 0, MAP_W - 1);
  G.cam.y = U.clamp(G.cam.y, 0, MAP_H - 1);
  G.cam.z = U.clamp(G.cam.z, 0.45, 3);
}

function darkness() {
  const h = hourNow();
  if (h >= 21 || h < 4.5) return 0.62;
  if (h >= 18) return (h - 18) / 3 * 0.62;
  if (h < 7) return (7 - h) / 2.5 * 0.62;
  return 0;
}

function render(now) {
  const ctx = R.ctx;
  ctx.setTransform(R.dpr, 0, 0, R.dpr, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.fillStyle = '#0d0b0a';
  ctx.fillRect(0, 0, R.W, R.H);
  if (G.terrainDirty || R.terrainSeason !== seasonIdx()) buildTerrain();
  const ts = camScale(), s = ts / PX;
  const [ox, oy] = w2s(-0.5, -0.5);
  ctx.drawImage(R.terrain, 0, 0, MAP_W * PX, MAP_H * PX, ox, oy, MAP_W * ts, MAP_H * ts);
  const [wx0, wy0] = s2w(0, 0), [wx1, wy1] = s2w(R.W, R.H);
  const x0 = Math.max(0, Math.floor(wx0)), y0 = Math.max(0, Math.floor(wy0) - 1);
  const x1 = Math.min(MAP_W - 1, Math.ceil(wx1)), y1 = Math.min(MAP_H - 1, Math.ceil(wy1) + 1);
  const T = now / 1000;
  const season = seasonIdx();
  const SX = x => ox + x * ts, SY = y => oy + y * ts;

  // น้ำระยิบระยับ
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = ix(x, y), t = G.terrain[i];
    if (t !== T_WATER && t !== T_SHALLOW) continue;
    const ph = (T * 0.8 + hash(i, 3) * 6) % 6;
    if (ph < 2) ctx.fillRect(SX(x) + (hash(i, 4) * 10 + ph * 2) * s, SY(y) + hash(i, 5) * 12 * s, 3 * s, s);
  }
  // โซน
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const z = G.zone[ix(x, y)];
    if (!z) continue;
    ctx.fillStyle = z === Z_STOCK ? 'rgba(120,170,255,0.16)' : 'rgba(150,220,90,0.14)';
    ctx.fillRect(SX(x), SY(y), ts, ts);
    ctx.strokeStyle = z === Z_STOCK ? 'rgba(140,180,255,0.35)' : 'rgba(170,230,110,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(SX(x) + 0.5, SY(y) + 0.5, ts - 1, ts - 1);
  }
  // ชั้นพื้น: พืชผล สิ่งของ
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    const i = ix(x, y);
    if (G.nat[i] === N_CROP) drawCrop(ctx, SX(x), SY(y), s, G.cropT[i], G.grow[i]);
    else if (G.zone[i] === Z_FARM && G.zoneCrop[i] && !G.nat[i]) {
      ctx.fillStyle = 'rgba(70,45,25,0.45)';
      ctx.fillRect(SX(x) + 2 * s, SY(y) + 2 * s, 12 * s, 12 * s);
    }
  }
  // แถวต่อแถว: หิน ต้นไม้ สิ่งก่อสร้าง สิ่งมีชีวิต
  const rows = {};
  const creatures = [];
  for (const p of G.pawns) if (!p.dead) creatures.push(p);
  for (const a of G.animals) if (!a.dead) creatures.push(a);
  for (const r of G.raiders) if (!r.dead) creatures.push(r);
  for (const c of creatures) { const ry = Math.round(c.y); (rows[ry] || (rows[ry] = [])).push(c); }
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const i = ix(x, y), n = G.nat[i], sx = SX(x), sy = SY(y);
      if (n === N_ROCK || n === N_ORE) drawRock(ctx, x, y, sx, sy, ts, s, n === N_ORE);
      else if (n === N_TREE) {
        const g = G.grow[i], sc = g < 0.5 ? 0.45 + g : 1;
        const spr = treeSpr(season);
        const w = ts * sc * 1.25;
        ctx.drawImage(spr, sx + ts / 2 - w / 2, sy + ts - w - ts * 0.05, w, w);
      } else if (n === N_BUSH) ctx.drawImage(bushSpr(season, G.grow[i] >= 1), sx, sy, ts, ts);
      const b = bAt(i);
      if (b) drawBuilding(ctx, b, sx, sy, ts, s, T);
      const it = G.items.get(i);
      if (it) drawItem(ctx, it, sx, sy, ts);
      const dg = G.desig[i];
      if (dg) drawDesig(ctx, dg, sx, sy, ts, i);
    }
    const rc = rows[y];
    if (rc) { rc.sort((a, b) => a.y - b.y); for (const c of rc) drawCreature(ctx, c, ts, T); }
  }
  drawFx(ctx, ts);
  // ping
  if (G.ping && G.ping.until > G.tick) {
    const [px, py] = w2s(G.ping.x, G.ping.y);
    ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2;
    const rr = ts * (0.6 + (T % 1) * 0.8);
    ctx.beginPath(); ctx.arc(px, py, rr, 0, Math.PI * 2); ctx.stroke();
  }
  // ความมืด + แสงไฟ
  const dk = darkness();
  if (dk > 0.01) {
    const L = R.light, lx = L.getContext('2d');
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, L.width, L.height);
    lx.fillStyle = `rgba(10,14,38,${dk})`;
    lx.fillRect(0, 0, L.width, L.height);
    lx.globalCompositeOperation = 'destination-out';
    for (const id in G.bld) {
      const b = G.bld[id];
      if (!b.built || !BDEF[b.type].light) continue;
      const [bx, by] = w2s(b.x, b.y);
      const rad = BDEF[b.type].light * ts * (0.95 + Math.sin(T * 7 + b.id) * 0.04);
      if (bx < -rad || by < -rad || bx > R.W + rad || by > R.H + rad) continue;
      const gr = lx.createRadialGradient(bx / 2, by / 2, 0, bx / 2, by / 2, rad / 2);
      gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0.75)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = gr;
      lx.fillRect(bx / 2 - rad / 2, by / 2 - rad / 2, rad, rad);
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(L, 0, 0, R.W, R.H);
    ctx.imageSmoothingEnabled = false;
    // แสงอุ่นรอบไฟ
    ctx.globalCompositeOperation = 'lighter';
    for (const id in G.bld) {
      const b = G.bld[id];
      if (!b.built || !BDEF[b.type].light) continue;
      const [bx, by] = w2s(b.x, b.y);
      const rad = BDEF[b.type].light * ts * 0.6;
      if (bx < -rad || by < -rad || bx > R.W + rad || by > R.H + rad) continue;
      const gr = ctx.createRadialGradient(bx, by, 0, bx, by, rad);
      gr.addColorStop(0, `rgba(255,150,60,${0.22 * dk})`); gr.addColorStop(1, 'rgba(255,120,40,0)');
      ctx.fillStyle = gr; ctx.fillRect(bx - rad, by - rad, rad * 2, rad * 2);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
  // หิมะ
  if (season === 3 || (G.story.tempMod < 0 && G.outT < 2)) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    for (const f of R.snow) {
      const fx = ((f[0] * R.W + Math.sin(T + f[1] * 9) * 20) % R.W + R.W) % R.W;
      const fy = ((f[1] * R.H + T * 30 * f[2]) % R.H);
      ctx.fillRect(fx, fy, 2 * f[2] + 1, 2 * f[2] + 1);
    }
  }
  drawToolPreview(ctx, ts);
  drawSelection(ctx, ts);
}

function drawRock(ctx, x, y, sx, sy, ts, s, ore) {
  ctx.fillStyle = '#6a635c'; ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
  const up = y > 0 && (G.nat[ix(x, y - 1)] === N_ROCK || G.nat[ix(x, y - 1)] === N_ORE);
  const dn = y < MAP_H - 1 && (G.nat[ix(x, y + 1)] === N_ROCK || G.nat[ix(x, y + 1)] === N_ORE);
  const lf = x > 0 && (G.nat[ix(x - 1, y)] === N_ROCK || G.nat[ix(x - 1, y)] === N_ORE);
  const rt = x < MAP_W - 1 && (G.nat[ix(x + 1, y)] === N_ROCK || G.nat[ix(x + 1, y)] === N_ORE);
  const i = ix(x, y);
  ctx.fillStyle = '#5a544e';
  ctx.fillRect(sx + hash(i, 1) * 10 * s, sy + hash(i, 2) * 10 * s, 4 * s, 3 * s);
  ctx.fillRect(sx + hash(i, 8) * 10 * s, sy + hash(i, 9) * 10 * s, 3 * s, 2 * s);
  if (!up) { ctx.fillStyle = '#8e867d'; ctx.fillRect(sx, sy, ts, 3 * s); }
  if (!dn) { ctx.fillStyle = '#3e3a35'; ctx.fillRect(sx, sy + ts - 4 * s, ts, 4 * s); }
  if (!lf) { ctx.fillStyle = '#7a736b'; ctx.fillRect(sx, sy, 2 * s, ts); }
  if (!rt) { ctx.fillStyle = '#4e4943'; ctx.fillRect(sx + ts - 2 * s, sy, 2 * s, ts); }
  if (ore) {
    ctx.fillStyle = '#c88a4a';
    for (let k = 0; k < 4; k++) ctx.fillRect(sx + (3 + hash(i, 20 + k) * 9) * s, sy + (3 + hash(i, 30 + k) * 8) * s, 2 * s, 2 * s);
    ctx.fillStyle = '#e8b070';
    ctx.fillRect(sx + (3 + hash(i, 20) * 9) * s, sy + (3 + hash(i, 30) * 8) * s, s, s);
  }
}
function drawCrop(ctx, sx, sy, s, ct, g) {
  const c = CROPS[ct];
  const h = Math.max(1, Math.round(2 + g * 9));
  for (let k = 0; k < 3; k++) {
    const px = sx + (3 + k * 4) * s;
    ctx.fillStyle = g >= 1 ? '#5f8f2f' : '#4f9a3c';
    ctx.fillRect(px, sy + (14 - h) * s, s * 1.2, h * s);
    if (g > 0.5) { ctx.fillStyle = '#6fb24c'; ctx.fillRect(px - s, sy + (14 - h + 2) * s, s, 2 * s); ctx.fillRect(px + s, sy + (14 - h + 4) * s, s, 2 * s); }
    if (g >= 1) { ctx.fillStyle = c.col; ctx.fillRect(px - s * 0.5, sy + (14 - h - 1) * s, s * 2.2, 3 * s); }
  }
}
function drawBuilding(ctx, b, sx, sy, ts, s, T) {
  const d = BDEF[b.type];
  if (!b.built) ctx.globalAlpha = 0.42;
  if (d.wall && !d.door) {
    const stone = b.type === 'wall_stone';
    const i = ix(b.x, b.y);
    const wallAt = (x, y) => { if (!inb(x, y)) return false; const o = bAt(ix(x, y)); return o && BDEF[o.type].wall && !BDEF[o.type].door; };
    ctx.fillStyle = stone ? '#6f6a63' : '#4e321c'; ctx.fillRect(sx, sy, ts + 0.5, ts + 0.5);
    ctx.fillStyle = stone ? '#8d877f' : '#6e4728'; ctx.fillRect(sx, sy + 5 * s, ts, 11 * s);
    ctx.fillStyle = stone ? '#5e5952' : '#3e2714';
    if (stone) { for (let k = 0; k < 3; k++) { ctx.fillRect(sx, sy + (5 + k * 4) * s, ts, s); ctx.fillRect(sx + ((k % 2) * 4 + 2) * s, sy + (5 + k * 4) * s, s, 4 * s); ctx.fillRect(sx + ((k % 2) * 4 + 10) * s, sy + (5 + k * 4) * s, s, 4 * s); } }
    else { for (let k = 0; k < 3; k++) ctx.fillRect(sx, sy + (8 + k * 3) * s, ts, s); ctx.fillRect(sx + 7 * s, sy + 5 * s, s, 11 * s); }
    // ด้านบนกำแพง
    ctx.fillStyle = stone ? '#b5aea4' : '#b0804a'; ctx.fillRect(sx, sy, ts + 0.5, 5 * s);
    ctx.fillStyle = stone ? '#cfc8bd' : '#c99a5e'; ctx.fillRect(sx, sy, ts + 0.5, s);
    if (!wallAt(b.x, b.y - 1)) { ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(sx, sy, ts, s); }
    if (!wallAt(b.x, b.y + 1)) { ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(sx, sy + ts - s, ts, s); }
    if (!wallAt(b.x - 1, b.y)) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(sx, sy, s, ts); }
    if (!wallAt(b.x + 1, b.y)) { ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(sx + ts - s, sy, s, ts); }
  } else if (d.door) {
    ctx.fillStyle = '#5a3a20'; ctx.fillRect(sx, sy, ts, ts);
    ctx.fillStyle = '#9a6a3c'; ctx.fillRect(sx + 2 * s, sy + 1 * s, 12 * s, 15 * s);
    ctx.fillStyle = '#7a5232'; ctx.fillRect(sx + 7.5 * s, sy + 1 * s, s, 15 * s);
    ctx.fillStyle = '#e8c85a'; ctx.fillRect(sx + 11 * s, sy + 8 * s, s, 2 * s);
  } else if (d.floor) {
    ctx.fillStyle = d.floor === 1 ? '#a8743f' : '#9a948c';
    ctx.fillRect(sx + s, sy + s, ts - 2 * s, ts - 2 * s);
  } else {
    const spr = bSpr(b.type);
    if (spr) ctx.drawImage(spr, sx, sy, ts, ts);
    if (b.built && (b.type === 'campfire' || b.type === 'torch' || b.type === 'fireplace' || b.type === 'stove')) drawFlame(ctx, b, sx, sy, s, T);
  }
  ctx.globalAlpha = 1;
  if (!b.built) {
    ctx.strokeStyle = 'rgba(140,200,255,0.9)'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 2]); ctx.strokeRect(sx + 1, sy + 1, ts - 2, ts - 2); ctx.setLineDash([]);
    const del = fullyDelivered(b);
    const pr = del ? b.prog / d.work : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 2, sy + ts - 5, ts - 4, 3);
    ctx.fillStyle = del ? '#7fd36a' : '#7aa8e0';
    if (!del) { let need = 0, got = 0; for (const k in d.cost) { need += d.cost[k]; got += b.del[k] || 0; } ctx.fillRect(sx + 2, sy + ts - 5, (ts - 4) * got / need, 3); }
    else ctx.fillRect(sx + 2, sy + ts - 5, (ts - 4) * pr, 3);
  } else if (b.hp < (d.hp || 30)) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 2, sy + 1, ts - 4, 3);
    ctx.fillStyle = '#e0574b'; ctx.fillRect(sx + 2, sy + 1, (ts - 4) * b.hp / d.hp, 3);
  }
  if (b.decon) { ctx.fillStyle = 'rgba(224,87,75,0.35)'; ctx.fillRect(sx, sy, ts, ts); }
  if (b.built && b.cur && d.station) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.fillRect(sx + 2, sy - 3, ts - 4, 3);
    ctx.fillStyle = '#f2c94c'; ctx.fillRect(sx + 2, sy - 3, (ts - 4) * b.cur.prog / RECIPES[b.cur.r].work, 3);
  }
}
function drawFlame(ctx, b, sx, sy, s, T) {
  const f = Math.sin(T * 13 + b.id) * 0.5 + 0.5, g = Math.sin(T * 9 + b.id * 3) * 0.5 + 0.5;
  let cx = 8, cy = 9, sz = 1;
  if (b.type === 'torch') { cy = 3; sz = 0.6; }
  if (b.type === 'fireplace') { cy = 11; sz = 0.8; }
  if (b.type === 'stove') { cy = 11; sz = 0.5; }
  const P = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(sx + (cx + x * sz) * s, sy + (cy + y * sz) * s, w * sz * s, h * sz * s); };
  P(-3, -1, 6, 3, '#d8501f');
  P(-2, -3 - f, 4, 3 + f, '#f08a24');
  P(-1, -5 - g * 2, 2, 3 + g, '#ffd35a');
}
function drawItem(ctx, it, sx, sy, ts) {
  const sc = 0.78;
  ctx.drawImage(iSpr(it.t), sx + ts * (1 - sc) / 2, sy + ts * (1 - sc) / 2, ts * sc, ts * sc);
  if (it.n > 1 && ts >= 22) {
    ctx.font = `bold ${Math.max(9, ts * 0.3)}px system-ui,sans-serif`;
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.8)';
    ctx.strokeText(it.n, sx + ts - 1, sy + ts);
    ctx.fillStyle = '#fff'; ctx.fillText(it.n, sx + ts - 1, sy + ts);
  }
}
function drawDesig(ctx, dg, sx, sy, ts, i) {
  ctx.strokeStyle = dg === D_CHOP ? 'rgba(255,210,90,0.95)' : dg === D_MINE ? 'rgba(255,150,90,0.95)' : 'rgba(150,255,140,0.9)';
  ctx.lineWidth = 2;
  const m = ts * 0.2;
  ctx.beginPath();
  ctx.moveTo(sx + m, sy + m); ctx.lineTo(sx + m * 2, sy + m); ctx.moveTo(sx + m, sy + m); ctx.lineTo(sx + m, sy + m * 2);
  ctx.moveTo(sx + ts - m, sy + ts - m); ctx.lineTo(sx + ts - m * 2, sy + ts - m); ctx.moveTo(sx + ts - m, sy + ts - m); ctx.lineTo(sx + ts - m, sy + ts - m * 2);
  ctx.stroke();
  if (ts >= 20) {
    ctx.font = `${ts * 0.32}px system-ui,sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(dg === D_CHOP ? '🪓' : dg === D_MINE ? '⛏️' : '🧺', sx + ts * 0.78, sy + ts * 0.22);
  }
}
function drawCreature(ctx, c, ts, T) {
  const [cx, cy] = w2s(c.x, c.y);
  let sc = 1;
  if (c.kind === 'pawn') { const st = lifeStage(c); sc = st === 'baby' ? 0.5 : st === 'child' ? 0.65 : st === 'kid' ? 0.78 : st === 'teen' ? 0.92 : 1; }
  else if (c.kind === 'animal') sc = c.type === 'rabbit' ? 0.7 : c.type === 'deer' ? 1.15 : 1;
  const sz = ts * sc;
  const spr = c.kind === 'animal' ? animalSpr(c.type) : pawnSpr(c);
  const lying = c.kind === 'pawn' && (c.downed || (c.job && c.job.type === 'sleep' && c.job.asleep));
  const moving = c.path && c.path.length;
  const bob = moving ? Math.abs(Math.sin(T * 12 + c.id)) * ts * 0.06 : 0;
  // เงา
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath(); ctx.ellipse(cx, cy + ts * 0.36, sz * 0.3, sz * 0.1, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.translate(cx, cy + ts * 0.42 - bob);
  if (lying) { ctx.rotate(-Math.PI / 2); ctx.translate(sz * 0.35, -sz * 0.1); }
  if (c.dir < 0 && !lying) ctx.scale(-1, 1);
  ctx.drawImage(spr, -sz / 2, -sz, sz, sz);
  if (c.kind === 'pawn' && c.weapon && !lying && canFight(c)) {
    ctx.drawImage(iSpr(c.weapon), sz * 0.05, -sz * 0.75, sz * 0.55, sz * 0.55);
  }
  if (c.kind === 'raider') ctx.drawImage(iSpr(c.weapon), sz * 0.05, -sz * 0.75, sz * 0.55, sz * 0.55);
  ctx.restore();
  const top = cy + ts * 0.42 - sz - bob;
  // ของที่ถือ
  if (c.carry) ctx.drawImage(iSpr(c.carry.t), cx - ts * 0.18, top - ts * 0.3, ts * 0.36, ts * 0.36);
  // ป้ายชื่อ
  const sel = G.sel && G.sel.obj === c;
  if (c.kind === 'pawn' && (G.cam.z >= 0.85 || sel)) {
    ctx.font = `600 ${U.clamp(ts * 0.34, 10, 14)}px Sarabun,system-ui,sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    const ny = cy + ts * 0.46;
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.75)'; ctx.strokeText(c.name, cx, ny);
    ctx.fillStyle = c.drafted ? '#ffb4a8' : c.brk ? '#ff8a6a' : '#fff6e6'; ctx.fillText(c.name, cx, ny);
  }
  // หลอดเลือด
  if (c.hp < c.maxHp - 0.5) {
    const bw = ts * 0.7;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(cx - bw / 2, top - 5, bw, 3);
    ctx.fillStyle = c.kind === 'pawn' ? '#7fd36a' : '#e0574b';
    ctx.fillRect(cx - bw / 2, top - 5, bw * U.clamp(c.hp / c.maxHp, 0, 1), 3);
  }
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const em = U.clamp(ts * 0.42, 11, 22);
  ctx.font = `${em}px system-ui,sans-serif`;
  if (c.kind === 'pawn') {
    if (c.drafted) ctx.fillText('⚔️', cx + ts * 0.38, top + ts * 0.1);
    if (c.downed) ctx.fillText('🆘', cx, top - ts * 0.2);
    else if (c.job && c.job.type === 'sleep' && c.job.asleep) { ctx.fillStyle = '#cfe0ff'; ctx.fillText('💤', cx + ts * 0.3, top - ((T * 8) % 10)); }
    else if (c.bubble) ctx.fillText(c.bubble.t, cx + ts * 0.32, top - ts * 0.12);
    else if (c.brk) ctx.fillText('😡', cx + ts * 0.32, top - ts * 0.12);
    if (c.pregnant && !c.downed) ctx.fillText('🤰', cx - ts * 0.38, top + ts * 0.1);
  } else if (c.kind === 'animal') {
    if (c.hunt) { ctx.strokeStyle = '#ff5a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, ts * 0.32, 0, Math.PI * 2); ctx.stroke(); }
    if (c.manhunter || c.angry) ctx.fillText('💢', cx + ts * 0.3, top);
  } else if (c.kind === 'raider' && c.flee) ctx.fillText('💨', cx + ts * 0.3, top);
}
function drawFx(ctx, ts) {
  G.fx = G.fx.filter(f => G.tick - f.t < 45 && G.tick >= f.t);
  for (const f of G.fx) {
    const age = G.tick - f.t;
    if (f.k === 'arrow') {
      if (age > 10) continue;
      const p = age / 10;
      const [ax, ay] = w2s(U.lerp(f.x0, f.x1, p), U.lerp(f.y0, f.y1, p) - 0.3);
      const [bx, by] = w2s(U.lerp(f.x0, f.x1, Math.max(0, p - 0.15)), U.lerp(f.y0, f.y1, Math.max(0, p - 0.15)) - 0.3);
      ctx.strokeStyle = '#f4e6c8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(ax, ay); ctx.stroke();
    } else if (f.k === 'swing') {
      if (age > 8) continue;
      const [ax, ay] = w2s(f.x1, f.y1 - 0.3);
      ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ax, ay, ts * 0.35, -1 + age * 0.3, 0.2 + age * 0.3); ctx.stroke();
    } else if (f.k === 'dmg' || f.k === 'miss') {
      const [ax, ay] = w2s(f.x, f.y - 0.8 - age * 0.02);
      ctx.font = `bold ${U.clamp(ts * 0.4, 11, 18)}px system-ui,sans-serif`;
      ctx.textAlign = 'center';
      ctx.globalAlpha = 1 - age / 45;
      ctx.lineWidth = 3; ctx.strokeStyle = '#000';
      const txt = f.k === 'miss' ? 'พลาด' : '-' + f.v;
      ctx.strokeText(txt, ax, ay);
      ctx.fillStyle = f.k === 'miss' ? '#ccc' : f.bad ? '#ff6a5a' : '#ffe08a';
      ctx.fillText(txt, ax, ay);
      ctx.globalAlpha = 1;
    } else if (f.k === 'hit') {
      if (age > 10) continue;
      const [ax, ay] = w2s(f.x, f.y);
      ctx.fillStyle = `rgba(255,220,150,${1 - age / 10})`;
      ctx.fillRect(ax - ts * 0.2, ay - ts * 0.2, ts * 0.4, ts * 0.4);
    }
  }
}
function drawSelection(ctx, ts) {
  const sel = G.sel;
  if (!sel) return;
  let x, y;
  if (sel.kind === 'tile') { x = sel.x; y = sel.y; }
  else if (sel.kind === 'building') { if (!G.bld[sel.obj.id]) { G.sel = null; return; } x = sel.obj.x; y = sel.obj.y; }
  else { if (sel.obj.dead || sel.obj.gone) { G.sel = null; return; } x = sel.obj.x; y = sel.obj.y; }
  const [cx, cy] = w2s(x, y);
  const h = ts / 2 + 2, m = ts * 0.25;
  ctx.strokeStyle = '#ffd36a'; ctx.lineWidth = 2;
  ctx.beginPath();
  for (const [sx, sy] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
    ctx.moveTo(cx + sx * h, cy + sy * h - sy * m); ctx.lineTo(cx + sx * h, cy + sy * h); ctx.lineTo(cx + sx * h - sx * m, cy + sy * h);
  }
  ctx.stroke();
}
function drawToolPreview(ctx, ts) {
  const t = UI.tool;
  if (!t || !UI.drag) return;
  const cells = toolCells(UI.drag.x0, UI.drag.y0, UI.drag.x1, UI.drag.y1, t);
  for (const [x, y] of cells) {
    const [sx, sy] = w2s(x - 0.5, y - 0.5);
    const ok = toolValid(t, x, y);
    ctx.fillStyle = ok ? 'rgba(120,230,120,0.3)' : 'rgba(230,90,80,0.25)';
    ctx.fillRect(sx, sy, ts, ts);
    if (ok && t.kind === 'build' && ts >= 16) {
      ctx.globalAlpha = 0.5;
      const spr = bSpr(t.type);
      if (spr) ctx.drawImage(spr, sx, sy, ts, ts);
      ctx.globalAlpha = 1;
    }
  }
}
