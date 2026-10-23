'use strict';
const LOOP = { running: false, last: 0, acc: 0, lastUi: 0 };

function newGame(ng, opts = {}) {
  const seed = Math.floor(Math.random() * 1e9);
  setDayLen(opts.dayLen || 6000);
  G = {
    dayLen: DAY,
    version: 1, seed, tick: Math.floor(6 * HOUR), speed: 1, paused: false,
    bld: {}, nextId: 1, pawns: [], animals: [], raiders: [], items: new Map(),
    research: { done: {}, cur: null, prog: {} },
    story: { last: {}, tempMod: 0, lastAny: 0 }, trader: null,
    log: [], ach: {}, quest: 0,
    stats: { born: 0, deaths: 0, raidsWon: 0, couples: 1 },
    settings: { peaceful: !!opts.peaceful, showQuest: true },
    surname: ng.surname, fx: [], sel: null, cam: { x: 32, y: 32, z: 1.4 },
  };
  genWorld(seed);
  initDerived();
  G.start = [MAP_W / 2, MAP_H / 2];
  const [sx, sy] = G.start;
  const P = LEGACY.perks;
  const boost = P.skilled ? Object.fromEntries(Object.keys(SKILLS).map(k => [k, 2])) : null;
  const made = [];
  ng.members.forEach((m, k) => {
    const sb = Object.assign({}, boost || {});
    if (k === 0 && P.hunter) sb.shooting = (sb.shooting || 0) + 3;
    const p = createPawn({
      name: m.name, gender: m.gender, age: m.age, traits: m.traits, shirt: m.shirt, skin: m.skin, hair: m.hair,
      x: sx + [-1, 1, 0, 1][k], y: sy + [0, 0, 1, 1][k], surname: ng.surname, skillBoost: sb,
    });
    made.push(p);
    G.pawns.push(p);
  });
  const [dad, mom] = made;
  dad.partner = mom.id; mom.partner = dad.id;
  dad.rel[mom.id] = mom.rel[dad.id] = 75;
  for (const kid of made.slice(2)) {
    kid.parents = [dad.id, mom.id];
    kid.gen = 2;
    for (const q of [dad, mom]) { q.rel[kid.id] = 80; kid.rel[q.id] = 80; }
  }
  if (made[3]) { made[2].rel[made[3].id] = made[3].rel[made[2].id] = 50; }
  dad.weapon = P.hunter ? 'bow' : 'spear';
  // เสบียงเริ่มต้น
  dropItem('wood', 70 + (P.wood ? 150 : 0), sx + 3, sy - 2);
  dropItem('meal', 10 + (P.food ? 25 : 0), sx - 3, sy - 2);
  dropItem('veg', 35, sx - 3, sy + 2);
  dropItem('medicine', 4, sx + 3, sy + 2);
  dropItem('silver', 80 + (P.silver ? 300 : 0), sx, sy + 3);
  dropItem('club', 1, sx - 1, sy + 3);
  if (P.scholar) {
    const opts2 = U.shuffle(Object.keys(RESEARCH).filter(k => !RESEARCH[k].req));
    for (const k of opts2.slice(0, 2)) G.research.done[k] = true;
  }
  rebuildZoneLists();
  recalcMap();
  recount();
  spawnInitialAnimals();
  LEGACY.games++; saveLegacy();
  addLog(`🌲 ครอบครัว${ng.surname}เดินทางมาถึงดินแดนไร้นาม`, '');
  setTimeout(() => showLetter({
    title: `🌲 ยินดีต้อนรับ ครอบครัว${ng.surname}`,
    text: `${dad.name}, ${mom.name} และ ${made.slice(2).map(p => p.name).join(', ')} หลงทางมาถึงผืนป่าแห่งนี้\nมีเสบียงติดตัวไม่มาก ต้องสร้างบ้านและหาอาหารก่อนฤดูหนาวจะมาถึงในวันที่ 19\n\nทำตาม "เป้าหมาย" (แถบด้านบน) เพื่อเรียนรู้การเล่น`,
    kind: 'good', choices: [{ label: '❓ วิธีเล่น', fn: () => showHelp() }, { label: 'เริ่มกันเลย!' }],
  }), 300);
}

function startLoop() {
  hideScreen(); closeSheet(); setTool(null);
  UI.famKey = ''; $('res').innerHTML = '';
  UI.letters = []; UI.letterOpen = false; $('modal').hidden = true;
  G.paused = false;
  renderInfo();
  resize();
  if (!LOOP.running) { LOOP.running = true; LOOP.last = performance.now(); requestAnimationFrame(frame); }
}
function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.25, (now - LOOP.last) / 1000);
  LOOP.last = now;
  if (!G || !$('menu').hidden) return;
  if (!G.paused && !G.over) {
    LOOP.acc += dt * TPS * G.speed;
    let n = 0;
    while (LOOP.acc >= 1 && n < 240) {
      try { gameTick(); } catch (e) { console.error(e); }
      LOOP.acc -= 1; n++;
      if (G.paused || G.over) break;
    }
    if (n >= 240) LOOP.acc = 0;
  }
  if (UI.follow) {
    if (UI.follow.dead) UI.follow = null;
    else { G.cam.x += (UI.follow.x - G.cam.x) * 0.12; G.cam.y += (UI.follow.y - G.cam.y) * 0.12; }
  }
  render(now);
  if (now - LOOP.lastUi > 200) { uiTick(); LOOP.lastUi = now; }
}
function gameTick() {
  G.tick++;
  if (G.mapDirty) recalcMap();
  const t = G.tick;
  if (t % 30 === 0) updateTemps();
  if (t % 20 === 0) recount();
  if (t % 60 === 0) { plantsTick(); checkQuest(); raidCheck(); cleanup(); }
  if (t % Math.round(DAY / 10) === 0) spoilTick();
  if (t % 120 === 0) assignBeds();
  if (t % Math.round(DAY / 8) === 0) storyTick();
  if (t % 600 === 0) babyAlerts();
  if (G.trader && t > G.trader.until) { G.trader = null; addLog('🐫 พ่อค้าออกเดินทางแล้ว', ''); if (UI.sheet === 'trade') closeSheet(); }
  const hr = t % DAY;
  if (hr === 0) newDay();
  if (hr === Math.floor(7 * HOUR)) dailyProduction();
  for (const p of G.pawns) if (!p.dead) pawnTick(p);
  for (const a of G.animals) if (!a.dead && !a.gone) animalTick(a);
  for (const r of G.raiders) if (!r.dead && !r.gone) raiderTick(r);
  if (t % 120 === 0) checkGameOver();
}
function cleanup() {
  G.animals = G.animals.filter(a => !a.dead && !a.gone);
  G.raiders = G.raiders.filter(r => !r.dead && !r.gone);
}
function babyAlerts() {
  for (const p of livePawns()) {
    if (lifeStage(p) === 'baby' && p.food < 20) { toast(`🍼 ${p.name} หิวมาก! ต้องมีคนทำงาน "ดูแลเด็ก"`, 'bad'); break; }
  }
  if (foodUnits() < livePawns().length * 4 && dayNum() > 2) toast('⚠️ อาหารใกล้หมด! เก็บผลไม้ป่า ปลูกผัก หรือล่าสัตว์', 'bad');
}
function newDay() {
  G.spoiledYesterday = G.spoiledToday || 0; G.spoiledToday = 0;
  if (G.spoiledYesterday >= 8) addLog(`🦠 อาหารเน่าเสีย ${G.spoiledYesterday} หน่วย (เก็บในห้องจะช้าลง)`, 'bad');
  spawnWildPlants();
  maintainAnimals();
  checkAchievements();
  const dy = Math.floor(G.tick / DAY) % YEAR_DAYS;
  if (dy % SEASON_DAYS === 0) {
    const s = SEASONS[seasonIdx()];
    toast(`${s.icon} เข้าสู่${s.name}`, '');
    addLog(`${s.icon} เข้าสู่${s.name} ปีที่ ${yearNum()}`, '');
    if (seasonIdx() === 3) showLetter({ title: '❄️ ฤดูหนาวมาแล้ว', kind: 'bad', text: 'พืชผลกลางแจ้งจะหยุดโตและตายเมื่อหนาวจัด\nให้ทุกคนสวมเสื้อกันหนาว อยู่ในห้องที่มีกองไฟหรือเตาผิง\nอาหารจะไม่เน่าเมื่ออุณหภูมิต่ำกว่า 0°C' });
  }
  if (dy === SEASON_DAYS * 3 - 2) showLetter({ title: '🍂 ฤดูหนาวใกล้มาถึง', kind: 'neutral', text: `อีก 2 วันจะเข้าฤดูหนาว\nตอนนี้มีอาหารประมาณ ${foodUnits()} หน่วย (ครอบครัวกินวันละ ~${livePawns().length * 5} หน่วย ถ้าปรุงสุก)\nเก็บเกี่ยวให้หมด เย็บเสื้อกันหนาว และเตรียมห้องอุ่นๆ` });
  saveGame();
}

window.addEventListener('load', () => {
  initRender();
  initInput();
  initUI();
  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) { try { hot.snapshot(() => (G && !G.over && $('menu').hidden ? { save: serialize() } : {})); } catch (e) { } }
  const boot = data => { if (data && data.save && loadGame(data.save)) startLoop(); else showMainMenu(); };
  if (hot && hot.ready) { try { hot.ready(boot); } catch (e) { boot(); } } else boot(hot && hot.data);
  document.addEventListener('visibilitychange', () => { if (document.hidden && G && $('menu').hidden) saveGame(); });
  window.addEventListener('pagehide', () => { if (G && $('menu').hidden) saveGame(); });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    try { navigator.serviceWorker.register('sw.js').catch(() => { }); } catch (e) { }
  }
});

// เปลี่ยนความยาววันกลางเกม: ปรับเวลาที่บันทึกเป็น tick ทั้งหมดให้ตรงกับมาตรฐานใหม่
function changeDayLen(ticks) {
  if (!G || ticks === DAY) return;
  const f = ticks / DAY, old = G.tick;
  const sc = v => (v ? Math.round(v * f) : v);
  G.tick = Math.round(old * f);
  const sh = v => (v ? v - old + G.tick : v);
  for (const p of G.pawns) {
    if (!p.dead) endJob(p);
    for (const m of p.mem) m.until = sc(m.until);
    p.inspired = sc(p.inspired); p.tended = sc(p.tended); p.learnCd = sc(p.learnCd);
    p.lastConceiveRoll = sc(p.lastConceiveRoll); p.joined = sc(p.joined);
    if (p.brk) p.brk.until = sc(p.brk.until);
    if (p.pregnant) p.pregnant.due = sc(p.pregnant.due);
    p.nextThink = G.tick; p.bubble = null;
  }
  for (const a of G.animals) { a.leaveAt = sc(a.leaveAt); a.fleeUntil = sh(a.fleeUntil); a.nextThink = sh(a.nextThink); }
  for (const r of G.raiders) r.repath = G.tick;
  if (G.story.tempUntil) G.story.tempUntil = sc(G.story.tempUntil);
  if (G.story.raid) G.story.raid.start = sc(G.story.raid.start);
  if (G.trader) G.trader.until = sc(G.trader.until);
  G.ping = null; G.fx = [];
  setDayLen(ticks);
  G.dayLen = ticks;
  updateTemps();
}
