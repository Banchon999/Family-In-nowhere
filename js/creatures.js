'use strict';
// ===== สัตว์ โจร และการต่อสู้ =====
function findCreature(id) {
  return G.pawns.find(p => p.id === id && !p.dead) || G.animals.find(a => a.id === id && !a.dead) || G.raiders.find(r => r.id === id && !r.dead);
}
function edgeTile(side) {
  let home = -1;
  for (const p of G.pawns) if (!p.dead && G.reach[pawnTile(p)] >= 0) { home = G.reach[pawnTile(p)]; break; }
  if (home < 0) { const [hx, hy] = homeCenter(); home = G.reach[ix(hx, hy)]; }
  for (let k = 0; k < 400; k++) {
    const s = side !== undefined ? side : U.ri(0, 3);
    let x, y;
    if (s === 0) { x = U.ri(0, MAP_W - 1); y = 0; }
    else if (s === 1) { x = MAP_W - 1; y = U.ri(0, MAP_H - 1); }
    else if (s === 2) { x = U.ri(0, MAP_W - 1); y = MAP_H - 1; }
    else { x = 0; y = U.ri(0, MAP_H - 1); }
    const i = ix(x, y);
    if (!solidAt(i) && G.terrain[i] !== T_SHALLOW && (k > 300 || home < 0 || G.reach[i] === home)) return i;
  }
  return ix(G.start[0], G.start[1]);
}
function spawnAnimal(type, i, opts = {}) {
  const d = ANIMALS[type];
  const a = Object.assign({
    id: G.nextId++, kind: 'animal', type, x: ixX(i), y: ixY(i), path: [], dir: 1,
    hp: d.hp, maxHp: d.hp, hunt: false, angry: false, manhunter: false, target: null, cd: 0, nextThink: 0, fleeUntil: 0,
  }, opts);
  G.animals.push(a);
  return a;
}
function spawnInitialAnimals() {
  for (let k = 0; k < 14; k++) {
    for (let t = 0; t < 50; t++) {
      const i = Math.floor(Math.random() * NT);
      if (solidAt(i) || G.terrain[i] === T_SHALLOW || U.dist(ixX(i), ixY(i), G.start[0], G.start[1]) < 12) continue;
      spawnAnimal(U.pick(['rabbit', 'rabbit', 'rabbit', 'deer', 'deer', 'boar', 'wolf']), i);
      break;
    }
  }
}
function maintainAnimals() {
  const wild = G.animals.filter(a => !a.manhunter).length;
  if (wild < 12 && seasonIdx() !== 3) {
    const n = U.ri(1, 3);
    for (let k = 0; k < n; k++) spawnAnimal(U.pick(['rabbit', 'rabbit', 'deer', 'deer', 'boar', 'wolf']), edgeTile());
  }
}
function stepC(c, sp) {
  if (!c.path.length) return true;
  const n = c.path[0];
  if (c.kind === 'raider' ? !enemyPass(n) : solidAt(n)) { c.path = []; return false; }
  const tx = ixX(n), ty = ixY(n);
  const dx = tx - c.x, dy = ty - c.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const s = sp / moveCost(n);
  if (dx) c.dir = dx > 0 ? 1 : -1;
  if (d <= s) { c.x = tx; c.y = ty; c.path.shift(); }
  else { c.x += dx / d * s; c.y += dy / d * s; }
  return !c.path.length;
}
function nearestPawnTo(c, maxD) {
  let best = null, bd = maxD;
  for (const p of G.pawns) {
    if (p.dead || p.downed) continue;
    const d = U.dist(c.x, c.y, p.x, p.y);
    if (d < bd) { bd = d; best = p; }
  }
  return best;
}
function animalTick(a) {
  if (a.cd > 0) a.cd--;
  const d = ANIMALS[a.type];
  if (a.leaving) {
    if (!a.path.length) a.path = findPath(Math.round(a.x), Math.round(a.y), ixX(a.leaving), ixY(a.leaving), false, false) || [];
    stepC(a, d.speed);
    const x = Math.round(a.x), y = Math.round(a.y);
    if (!a.path.length || x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) a.gone = true;
    return;
  }
  if (a.manhunter && G.tick > a.leaveAt) { a.leaving = edgeTile(); a.manhunter = false; a.angry = false; a.path = []; return; }
  if (a.manhunter || a.angry) {
    let t = a.target ? findCreature(a.target) : null;
    if (!t || t.dead || t.downed) {
      t = nearestPawnTo(a, a.manhunter ? 60 : 14);
      a.target = t ? t.id : null;
      if (!t) { a.angry = false; return; }
    }
    const dist = U.dist(a.x, a.y, t.x, t.y);
    if (dist <= 1.5) { a.path = []; if (a.cd <= 0) attack(a, t); return; }
    if (!a.path.length || (G.tick + a.id) % 30 === 0) a.path = findPath(Math.round(a.x), Math.round(a.y), Math.round(t.x), Math.round(t.y), true, false) || [];
    stepC(a, d.speed * 1.1);
    return;
  }
  if (a.fleeUntil > G.tick) { stepC(a, d.speed * 1.3); return; }
  if (!a.path.length && G.tick >= a.nextThink) {
    const x = Math.round(a.x), y = Math.round(a.y);
    const nx = U.clamp(x + U.ri(-6, 6), 0, MAP_W - 1), ny = U.clamp(y + U.ri(-6, 6), 0, MAP_H - 1);
    if (!solidAt(ix(nx, ny))) a.path = findPath(x, y, nx, ny, false, false) || [];
    a.nextThink = G.tick + U.ri(120, 420);
  }
  stepC(a, d.speed * 0.45);
}
function animalHurt(a, src) {
  const d = ANIMALS[a.type];
  if (!src) return;
  if (d.fight && !a.manhunter && U.chance(d.fight)) { a.angry = true; a.target = src.id; a.path = []; return; }
  if (a.manhunter || a.angry) return;
  // วิ่งหนี
  const vx = a.x - src.x, vy = a.y - src.y, vl = Math.hypot(vx, vy) || 1;
  const nx = U.clamp(Math.round(a.x + vx / vl * 9), 0, MAP_W - 1), ny = U.clamp(Math.round(a.y + vy / vl * 9), 0, MAP_H - 1);
  a.path = findPath(Math.round(a.x), Math.round(a.y), nx, ny, false, false) || [];
  a.fleeUntil = G.tick + 150;
}

// ----- โจร -----
function spawnRaid(n) {
  const side = U.ri(0, 3);
  const c = edgeTile(side);
  const id = G.nextId++;
  for (let k = 0; k < n; k++) {
    let i = c;
    for (let t = 0; t < 30; t++) {
      const x = U.clamp(ixX(c) + U.ri(-3, 3), 0, MAP_W - 1), y = U.clamp(ixY(c) + U.ri(-3, 3), 0, MAP_H - 1);
      if (!solidAt(ix(x, y))) { i = ix(x, y); break; }
    }
    const day = dayNum();
    const pool = day > 30 ? ['club', 'spear', 'bow', 'bow', 'sword', 'crossbow'] : day > 15 ? ['club', 'spear', 'bow', 'bow'] : ['club', 'club', 'spear', 'bow'];
    G.raiders.push({
      id: G.nextId++, kind: 'raider', x: ixX(i), y: ixY(i), path: [], dir: 1,
      hp: 75, maxHp: 75, weapon: U.pick(pool), skill: U.ri(2, 4 + Math.floor(day / 10)), cd: U.ri(0, 30), target: null,
      raid: id, flee: false, repath: 0, shirt: '#7a2420',
    });
  }
  G.story.raid = { id, total: n, start: G.tick };
}
function raiderTick(r) {
  if (r.cd > 0) r.cd--;
  if (r.flee) {
    if (!r.path.length) {
      const e = r.exit || (r.exit = edgeTile());
      r.path = findPath(Math.round(r.x), Math.round(r.y), ixX(e), ixY(e), false, true) || [];
      if (!r.path.length) { r.gone = true; return; }
    }
    stepC(r, 0.09);
    const x = Math.round(r.x), y = Math.round(r.y);
    if (!r.path.length || x === 0 || y === 0 || x === MAP_W - 1 || y === MAP_H - 1) r.gone = true;
    return;
  }
  if (!r.target || (G.tick + r.id) % 40 === 0) {
    const t = nearestPawnTo(r, 999);
    r.target = t ? t.id : null;
    if (!t) { r.flee = true; return; }
  }
  const t = findCreature(r.target);
  if (!t || t.downed) { r.target = null; return; }
  const w = WEAPONS[r.weapon];
  const d = U.dist(r.x, r.y, t.x, t.y);
  if (d <= w.range && (!w.ranged || lineClear(r.x, r.y, t.x, t.y))) { r.path = []; if (r.cd <= 0) attack(r, t); return; }
  if (!r.path.length || G.tick >= r.repath) {
    r.path = findPath(Math.round(r.x), Math.round(r.y), Math.round(t.x), Math.round(t.y), true, true) || [];
    r.repath = G.tick + 60;
  }
  if (r.path.length) {
    const b = enemyBlockAt(r.path[0]);
    if (b) {
      if (r.cd <= 0) {
        r.cd = w.cd;
        b.hp -= (w.ranged ? 4 : w.dmg) * 1.3;
        G.fx.push({ k: 'hit', x: b.x, y: b.y, t: G.tick });
        if (b.hp <= 0) { addLog(`💥 โจรทำลาย${BDEF[b.type].name}`, 'bad'); removeBuilding(b, 0); r.path = []; }
      }
      return;
    }
  }
  stepC(r, 0.075);
}
function raidCheck() {
  const rd = G.story.raid;
  if (!rd) return;
  const mine = G.raiders.filter(r => r.raid === rd.id && !r.dead && !r.gone);
  if (!mine.length) {
    G.story.raid = null;
    G.stats.raidsWon++;
    unlockAch('raid1');
    for (const p of livePawns()) addMem(p, 'victory');
    showLetter({ title: '🛡️ ขับไล่โจรสำเร็จ!', text: 'ครอบครัวปลอดภัยแล้ว อย่าลืมเก็บอาวุธที่โจรทิ้งไว้ และรักษาคนเจ็บ\n(กด "ปลดเกณฑ์" ให้ทุกคนกลับไปทำงาน)', kind: 'good' });
    for (const p of G.pawns) { p.drafted = false; p.order = null; }
    return;
  }
  if (!rd.fleeing && (mine.length <= Math.floor(rd.total / 2) || G.tick - rd.start > DAY * 1.2)) {
    rd.fleeing = true;
    for (const r of mine) { r.flee = true; r.path = []; }
    addLog('🏃 โจรเริ่มหนีแล้ว!', 'good');
  }
}

// ----- การโจมตี -----
function weaponOfC(c) {
  if (c.kind === 'pawn') return WEAPONS[c.weapon || 'fist'];
  if (c.kind === 'raider') return WEAPONS[c.weapon];
  const d = ANIMALS[c.type];
  return { dmg: d.dmg || 3, cd: d.cd || 40, range: 1.5 };
}
function hasCover(t, s) {
  const x = Math.round(t.x), y = Math.round(t.y);
  const dt = U.dist(t.x, t.y, s.x, s.y);
  for (const [dx, dy] of N8) {
    const nx = x + dx, ny = y + dy;
    if (!inb(nx, ny)) continue;
    const b = bAt(ix(nx, ny));
    if (b && b.built && (BDEF[b.type].cover || BDEF[b.type].wall) && U.dist(nx, ny, s.x, s.y) < dt - 0.4) return true;
  }
  return false;
}
function attack(a, t) {
  const w = weaponOfC(a);
  a.cd = w.cd;
  const d = U.dist(a.x, a.y, t.x, t.y);
  const sk = a.kind === 'pawn' ? skillLv(a, 'shooting') : a.kind === 'raider' ? a.skill : 5;
  let hit = w.ranged ? 0.5 + sk * 0.03 - d * 0.025 : 0.72 + sk * 0.02;
  if (w.ranged && hasCover(t, a)) hit *= 0.45;
  if (t.kind === 'animal' && t.type === 'rabbit') hit *= 0.8;
  hit = U.clamp(hit, 0.1, 0.95);
  if (a.x !== t.x) a.dir = t.x > a.x ? 1 : -1;
  G.fx.push({ k: w.ranged ? 'arrow' : 'swing', x0: a.x, y0: a.y, x1: t.x, y1: t.y, t: G.tick });
  if (a.kind === 'pawn') gainXp(a, 'shooting', 6);
  if (Math.random() < hit) damage(t, w.dmg * (0.75 + Math.random() * 0.5), a);
  else G.fx.push({ k: 'miss', x: t.x, y: t.y, t: G.tick });
}
function damage(t, dmg, src) {
  if (t.kind === 'pawn') {
    if (hasTrait(t, 'tough')) dmg *= 0.6;
    t.hp -= dmg;
    addMem(t, 'hurt');
    if (t.hp <= -40) killPawn(t, 'ถูกทำร้ายจนเสียชีวิต');
    else if (t.hp <= 0) downPawn(t);
  } else {
    t.hp -= dmg;
    if (t.hp <= 0) creatureDie(t, src);
    else if (t.kind === 'animal') animalHurt(t, src);
  }
  G.fx.push({ k: 'dmg', x: t.x, y: t.y, v: Math.round(dmg), t: G.tick, bad: t.kind === 'pawn' });
}
function creatureDie(c, src) {
  c.dead = true;
  const x = Math.round(c.x), y = Math.round(c.y);
  if (src && src.kind === 'pawn') src.kills++;
  if (c.kind === 'animal') {
    const d = ANIMALS[c.type];
    dropItem('meat', d.meat, x, y);
    dropItem('hide', d.hide, x, y);
    if (c.hunt) addLog(`🍖 ล่า${d.name}สำเร็จ ได้เนื้อ ${d.meat} หนัง ${d.hide}`, 'good');
  } else if (c.kind === 'raider') {
    if (U.chance(0.6)) dropItem(c.weapon, 1, x, y);
    dropItem('silver', U.ri(8, 30), x, y);
    addLog('⚔️ โจรถูกกำจัด', 'good');
  }
}
