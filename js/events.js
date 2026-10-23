'use strict';
// ===== บันทึก ความสำเร็จ มรดก =====
function addLog(msg, kind) {
  G.log.unshift({ d: dayNum(), h: Math.floor(hourNow()), msg, kind: kind || '' });
  if (G.log.length > 120) G.log.length = 120;
  uiDirty('log');
}
function loadLegacy() {
  try { const s = localStorage.getItem(LEGACY_KEY); if (s) return Object.assign({ points: 0, perks: {}, best: 0, games: 0, ach: {} }, JSON.parse(s)); } catch (e) { }
  return { points: 0, perks: {}, best: 0, games: 0, ach: {} };
}
let LEGACY = loadLegacy();
function saveLegacy() { try { localStorage.setItem(LEGACY_KEY, JSON.stringify(LEGACY)); } catch (e) { } }
function unlockAch(id) {
  if (!G || G.ach[id]) return;
  const a = ACHIEVEMENTS[id];
  G.ach[id] = dayNum();
  LEGACY.points += a.pts;
  LEGACY.ach[id] = (LEGACY.ach[id] || 0) + 1;
  saveLegacy();
  toast(`🏆 ${a.name} (+${a.pts} แต้มมรดก)`, 'gold');
  addLog(`🏆 ความสำเร็จ: ${a.name} — ${a.desc}`, 'good');
}
function checkAchievements() {
  const alive = livePawns();
  if (dayNum() >= 2) unlockAch('night1');
  if (yearNum() >= 2) unlockAch('winter1');
  if (yearNum() >= 4) unlockAch('year3');
  if (alive.length >= 5) unlockAch('fam5');
  if (alive.length >= 8) unlockAch('fam8');
  if ((G.counts.meal || 0) + (G.counts.finemeal || 0) >= 40) unlockAch('feast');
  if (wealth() >= 15000) unlockAch('rich');
  if (buildingsOf(b => b.built && BDEF[b.type].bed && isIndoor(ix(b.x, b.y))).length) unlockAch('shelter');
}

// ===== เป้าหมายสอนเล่น =====
function questDone(id) {
  const alive = livePawns();
  switch (id) {
    case 'stock': return G.hasStock;
    case 'fire': return hasBuilt('campfire') || hasBuilt('stove');
    case 'beds': {
      let n = 0;
      for (const b of buildingsOf(b => b.built)) { const d = BDEF[b.type]; n += (d.bed || 0) + (d.crib ? 1 : 0); }
      return n >= alive.length;
    }
    case 'room': return buildingsOf(b => b.built && BDEF[b.type].bed && isIndoor(ix(b.x, b.y))).length > 0;
    case 'farm': { let n = 0; for (let i = 0; i < NT; i++) if (G.zone[i] === Z_FARM) n++; return n >= 12; }
    case 'research': return hasBuilt('research') && (!!G.research.cur || Object.keys(G.research.done).length > 0);
    case 'food': return foodUnits() >= 120;
    case 'coats': return alive.filter(p => lifeStage(p) !== 'baby').every(p => p.coat);
  }
  return false;
}
function checkQuest() {
  const q = QUESTS[G.quest];
  if (!q || !questDone(q.id)) return;
  const [hx, hy] = homeCenter();
  const parts = [];
  for (const k in q.reward) { dropItem(k, q.reward[k], hx, hy); parts.push(`${ITEMS[k].icon}${q.reward[k]}`); }
  toast(`✅ เป้าหมายสำเร็จ! รางวัล ${parts.join(' ')}`, 'good');
  addLog(`✅ ${q.text} — รางวัล ${parts.join(' ')}`, 'good');
  G.quest++;
  uiDirty('quest');
}

// ===== ผู้เล่าเรื่อง (สุ่มเหตุการณ์) =====
function lastEv(id) { return G.story.last[id] !== undefined ? G.story.last[id] : -999; }
function singleAdults() {
  return livePawns().filter(p => lifeStage(p) === 'adult' && !p.partner && ageYears(p) < 50);
}
const EVENTS = {
  raid: {
    threat: 1, min: 12, cd: 6, w: () => 0.9 + dayNum() / 30,
    run() {
      const adults = livePawns().filter(canFight).length;
      const pts = 25 + dayNum() * 2.2 + wealth() / 350;
      const first = !G.stats.raidsSeen;
      const n = first ? 1 : U.clamp(Math.round(pts / 45), 1, 2 + adults * 2);
      G.stats.raidsSeen = (G.stats.raidsSeen || 0) + 1;
      spawnRaid(n);
      showLetter({
        title: `⚔️ โจรบุก! (${n} คน)`, kind: 'bad',
        text: `กลุ่มโจรป่ากำลังมาปล้นบ้านของคุณ!\n\nเลือกตัวละครแล้วกด "เกณฑ์" เพื่อสั่งต่อสู้ แตะที่โจรเพื่อโจมตี\nเด็กๆ จะวิ่งหนีเอง หลบเข้าบ้านจะปลอดภัยกว่า`,
        choices: [{ label: '⚔️ เกณฑ์ผู้ใหญ่ทั้งหมด', fn: draftAll }, { label: 'รับทราบ' }],
      });
    },
  },
  wolves: {
    threat: 1, min: 10, cd: 7, w: () => 0.8,
    run() {
      const type = U.chance(0.6) ? 'wolf' : 'boar';
      const n = U.clamp(U.ri(1, 1 + Math.floor(dayNum() / 12)), 1, 7);
      const e = edgeTile();
      for (let k = 0; k < n; k++) spawnAnimal(type, e, { manhunter: true, leaveAt: G.tick + DAY * 1.2 });
      showLetter({
        title: `🐺 ${ANIMALS[type].name}คลั่ง ${n} ตัว!`, kind: 'bad',
        text: `ฝูง${ANIMALS[type].name}หิวโหยกำลังมาทำร้ายคนในบ้าน\nพวกมันพังกำแพงไม่ได้ หลบเข้าบ้านแล้วปิดประตู หรือเกณฑ์คนไปสู้`,
        choices: [{ label: '⚔️ เกณฑ์ผู้ใหญ่ทั้งหมด', fn: draftAll }, { label: 'รับทราบ' }],
      });
    },
  },
  trader: { min: 3, cd: 4, w: () => 2, run() { openTraderEvent(); } },
  wanderer: {
    min: 5, cd: 8, w: () => livePawns().length < 10 ? 1.2 : 0.3,
    run() {
      const singles = singleAdults();
      let gender;
      if (singles.length && U.chance(0.6)) gender = singles[0].gender === 'm' ? 'f' : 'm';
      const age = U.chance(0.2) ? U.ri(14, 17) : U.ri(19, 40);
      offerJoin(createPawnAtEdge({ age, gender }), `ผู้เดินทางชื่อ "{n}" อายุ {a} ปี หลงทางมาขอเข้าร่วมครอบครัว`);
    },
  },
  orphan: {
    min: 10, cd: 14, w: () => 0.6,
    run() { offerJoin(createPawnAtEdge({ age: U.ri(4, 11) }), `เด็กกำพร้าชื่อ "{n}" อายุ {a} ปี เดินร้องไห้มาหน้าบ้าน ขอให้รับเลี้ยงด้วย`); },
  },
  suitor: {
    min: 4, cd: 5, w: () => singleAdults().some(p => p.gen > 1 || G.tick - p.joined > DAY * 4) ? 3 : 0,
    run() {
      const cands = singleAdults().filter(p => p.gen > 1 || G.tick - p.joined > DAY * 4);
      if (!cands.length) return;
      const who = U.pick(cands);
      const age = U.clamp(Math.round(ageYears(who)) + U.ri(-4, 4), 18, 55);
      const s = createPawnAtEdge({ age, gender: who.gender === 'm' ? 'f' : 'm' });
      showLetter({
        title: '💌 มีคนมาสู่ขอ!', kind: 'good',
        text: `"${s.name}" (${age} ปี, ${s.traits.map(t => TRAITS[t].name).join(', ')}) จากหมู่บ้านใกล้เคียง\nมาขอแต่งงานกับ ${who.name} และจะย้ายมาอยู่ด้วย`,
        choices: [
          { label: '💍 ตกลง', fn() { joinColony(s); s.partner = who.id; who.partner = s.id; s.rel[who.id] = 70; who.rel[s.id] = 70; addMem(s, 'married'); addMem(who, 'married'); if (G.stats.couples++ >= 1) unlockAch('wedding'); addLog(`💒 ${who.name} แต่งงานกับ ${s.name}`, 'good'); } },
          { label: 'ปฏิเสธ' },
        ],
      });
    },
  },
  sick: {
    min: 5, cd: 7, w: () => 0.9,
    run() {
      const c = livePawns().filter(p => !p.sick);
      if (!c.length) return;
      const p = c.find(x => hasTrait(x, 'sickly') && U.chance(0.6)) || U.pick(c);
      p.sick = { sev: 0.2, imm: 0 };
      showLetter({ title: `🤒 ${p.name} ป่วยเป็นไข้`, kind: 'bad', text: `${p.name} ติดไข้ป่า ต้องนอนพักและให้คนที่ทำงาน "รักษา" ดูแล\nถ้ามียาสมุนไพรจะหายเร็วขึ้นมาก ถ้าปล่อยไว้อาจเสียชีวิตได้` });
    },
  },
  coldsnap: {
    min: 4, cd: 8, w: () => (seasonIdx() === 2 || seasonIdx() === 3) ? 1 : 0,
    run() {
      G.story.tempMod = -12; G.story.tempUntil = G.tick + DAY * 2;
      showLetter({ title: '🥶 อากาศหนาวจัด', kind: 'bad', text: 'อุณหภูมิจะลดลง 12°C ประมาณ 2 วัน\nให้ทุกคนสวมเสื้อกันหนาวและอยู่ในห้องที่มีกองไฟ/เตาผิง' });
    },
  },
  heatwave: {
    min: 4, cd: 8, w: () => seasonIdx() === 1 ? 1 : 0,
    run() {
      G.story.tempMod = 11; G.story.tempUntil = G.tick + DAY * 2;
      showLetter({ title: '🥵 คลื่นความร้อน', kind: 'bad', text: 'อากาศร้อนจัดประมาณ 2 วัน อาหารจะเน่าเร็วขึ้น\nอยู่ในร่มจะเย็นกว่า' });
    },
  },
  blight: {
    min: 8, cd: 10, w: () => { let n = 0; for (let i = 0; i < NT; i++) if (G.nat[i] === N_CROP) n++; return n > 10 ? 0.6 : 0; },
    run() {
      let k = 0;
      for (let i = 0; i < NT; i++) if (G.nat[i] === N_CROP && G.grow[i] < 1 && U.chance(0.5)) { G.nat[i] = N_NONE; k++; }
      showLetter({ title: '🦗 แมลงลงแปลงผัก', kind: 'bad', text: `ศัตรูพืชทำลายพืชผลไป ${k} ต้น ต้องเริ่มปลูกใหม่` });
    },
  },
  cart: {
    min: 2, cd: 6, w: () => 1,
    run() {
      const [hx, hy] = homeCenter();
      const loot = U.pick([{ wood: U.ri(60, 120) }, { stone: U.ri(50, 90), iron: U.ri(15, 30) }, { meal: U.ri(8, 15) }, { medicine: U.ri(3, 6) }, { silver: U.ri(60, 140) }, { hide: U.ri(15, 30), cotton: U.ri(15, 30) }]);
      const parts = [];
      const x = U.clamp(hx + U.ri(-6, 6), 2, MAP_W - 3), y = U.clamp(hy + U.ri(-6, 6), 2, MAP_H - 3);
      for (const k in loot) { dropItem(k, loot[k], x, y); parts.push(`${ITEMS[k].icon} ${ITEMS[k].name} ${loot[k]}`); }
      G.ping = { x, y, until: G.tick + 400 };
      showLetter({ title: '🛒 เกวียนร้าง', kind: 'good', text: `พบเกวียนพ่อค้าที่ถูกทิ้งไว้ใกล้บ้าน มีของ:\n${parts.join('\n')}`, choices: [{ label: '📍 ไปดู', fn() { G.cam.x = x; G.cam.y = y; } }, { label: 'เยี่ยม!' }] });
    },
  },
  herd: {
    min: 3, cd: 5, w: () => seasonIdx() === 3 ? 0.3 : 1,
    run() {
      const e = edgeTile();
      const n = U.ri(4, 6);
      for (let k = 0; k < n; k++) spawnAnimal('deer', e);
      addLog(`🦌 ฝูงกวาง ${n} ตัวอพยพเข้ามา โอกาสดีที่จะล่า (เมนู สั่งงาน > ล่า)`, 'good');
      toast('🦌 ฝูงกวางอพยพเข้ามา!', 'good');
    },
  },
};
function storyTick() {
  const day = G.tick / DAY;
  if (G.story.tempUntil && G.tick > G.story.tempUntil) { G.story.tempMod = 0; G.story.tempUntil = 0; }
  const since = day - (G.story.lastAny || 0);
  if (!(U.chance(0.1) || since > 2.2)) return;
  if (day < 1.2) return;
  const lastThreat = Math.max(lastEv('raid'), lastEv('wolves'));
  const opts = [];
  for (const id in EVENTS) {
    const e = EVENTS[id];
    if (day < e.min || day - lastEv(id) < e.cd) continue;
    if (e.threat && (day - lastThreat < 3.5 || G.story.raid)) continue;
    if (e.threat && G.settings.peaceful) continue;
    const w = e.w();
    if (w > 0) opts.push([id, w]);
  }
  if (!opts.length) return;
  let tot = opts.reduce((a, o) => a + o[1], 0), r = Math.random() * tot;
  for (const [id, w] of opts) {
    r -= w;
    if (r <= 0) { G.story.last[id] = day; G.story.lastAny = day; EVENTS[id].run(); return; }
  }
}
function createPawnAtEdge(o) {
  const i = edgeTile();
  return createPawn(Object.assign({ x: ixX(i), y: ixY(i), surname: U.pick(SURNAMES) }, o));
}
function joinColony(p) {
  G.pawns.push(p);
  addMem(p, 'rescued');
  for (const o of livePawns()) if (o !== p) { o.rel[p.id] = 10; p.rel[o.id] = 10; }
  p.joined = G.tick;
  addLog(`🤝 ${p.name} เข้าร่วมครอบครัว`, 'good');
  uiDirty('family');
}
function offerJoin(p, text) {
  showLetter({
    title: '🚶 มีคนขอเข้าร่วม', kind: 'neutral',
    text: text.replace('{n}', p.name).replace('{a}', Math.floor(ageYears(p))) + `\n\nนิสัย: ${p.traits.map(t => TRAITS[t].name).join(', ')}\nเก่ง: ${Object.keys(SKILLS).sort((a, b) => p.skills[b].lv - p.skills[a].lv).slice(0, 2).map(s => SKILLS[s] + ' ' + p.skills[s].lv).join(', ')}`,
    choices: [{ label: '🤝 รับเข้าบ้าน', fn() { joinColony(p); } }, { label: 'ปฏิเสธ' }],
  });
}
function draftAll() {
  for (const p of livePawns()) if (canFight(p) && !p.downed && !p.brk) { p.drafted = true; p.order = null; endJob(p); }
}

// ===== พ่อค้า =====
function openTraderEvent() {
  const stock = {};
  const pool = ['meal', 'medicine', 'iron', 'wood', 'stone', 'veg', 'meat', 'hide', 'cotton', 'coat', 'bow', 'spear'];
  if (dayNum() > 15) pool.push('crossbow', 'sword', 'finemeal');
  U.shuffle(pool);
  for (const t of pool.slice(0, U.ri(6, 8))) {
    const d = ITEMS[t];
    stock[t] = d.stack <= 5 ? U.ri(1, 2) : t === 'medicine' ? U.ri(3, 8) : t === 'meal' || t === 'finemeal' ? U.ri(8, 20) : U.ri(40, 120);
  }
  G.trader = { until: G.tick + DAY * 1.2, stock };
  showLetter({
    title: '🐫 พ่อค้าเร่มาถึง', kind: 'good',
    text: 'กองคาราวานพ่อค้าแวะมาที่บ้าน จะอยู่ประมาณ 1 วัน\nซื้อขายได้ด้วยเงิน 🪙 (ปุ่ม 🐫 ด้านบนจอ)',
    choices: [{ label: '🛒 เปิดร้าน', fn: () => openSheet('trade') }, { label: 'ไว้ทีหลัง' }],
  });
}
function buyPrice(t) { return Math.max(1, Math.ceil(ITEMS[t].val * 1.5)); }
function sellPrice(t) { return Math.max(1, Math.floor(ITEMS[t].val * 0.6)); }
function takeFromStock(type, n) {
  let left = n;
  for (const [i, s] of G.items) {
    if (s.t !== type || left <= 0) continue;
    left -= takeItem(i, left);
  }
  recount();
  return n - left;
}
function tradeBuy(t, n) {
  if (!G.trader || !G.trader.stock[t]) return;
  n = Math.min(n, G.trader.stock[t]);
  const cost = buyPrice(t) * n;
  if ((G.counts.silver || 0) < cost) { toast('เงินไม่พอ', 'bad'); return; }
  takeFromStock('silver', cost);
  G.trader.stock[t] -= n;
  if (!G.trader.stock[t]) delete G.trader.stock[t];
  const [hx, hy] = homeCenter();
  dropItem(t, n, hx, hy);
  recount();
}
function tradeSell(t, n) {
  if (!G.trader) return;
  n = Math.min(n, G.counts[t] || 0);
  if (n <= 0) return;
  takeFromStock(t, n);
  const [hx, hy] = homeCenter();
  dropItem('silver', sellPrice(t) * n, hx, hy);
  recount();
}

// ===== จบเกม =====
function checkGameOver() {
  if (G.over) return;
  const alive = livePawns();
  if (alive.length && alive.some(p => lifeStage(p) !== 'baby')) return;
  G.over = true;
  const days = dayNum();
  const pts = Math.floor(days / 4) + G.stats.born;
  LEGACY.points += pts;
  LEGACY.best = Math.max(LEGACY.best || 0, days);
  saveLegacy();
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
  showGameOver(days, pts);
}
