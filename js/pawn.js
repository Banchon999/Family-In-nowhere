'use strict';
// ===== สร้างตัวละคร =====
function ageYears(p) { return p.ageDays / YEAR_DAYS; }
function lifeStage(p) {
  const a = ageYears(p);
  return a < 3 ? 'baby' : a < 7 ? 'child' : a < 13 ? 'kid' : a < 18 ? 'teen' : 'adult';
}
const STAGE_NAME = { baby: 'ทารก', child: 'เด็กเล็ก', kid: 'เด็ก', teen: 'วัยรุ่น', adult: 'ผู้ใหญ่' };
function canWork(p, w) {
  const st = lifeStage(p);
  if (st === 'baby' || st === 'child') return false;
  if (st === 'kid') return !!KID_WORKS[w];
  return true;
}
function canFight(p) { const st = lifeStage(p); return st === 'teen' || st === 'adult'; }

function uniqueName(list) {
  const used = new Set((G && G.pawns ? G.pawns : []).map(p => p.name));
  const free = list.filter(n => !used.has(n));
  return U.pick(free.length ? free : list);
}
function randTraits(n) {
  const keys = U.shuffle(Object.keys(TRAITS));
  const out = [];
  for (const k of keys) {
    if (out.length >= n) break;
    if (out.some(o => TRAITS[o].no === k || TRAITS[k].no === o)) continue;
    out.push(k);
  }
  return out;
}
function createPawn(o) {
  const gender = o.gender || (U.chance(0.5) ? 'm' : 'f');
  const age = o.age !== undefined ? o.age : 25;
  const p = {
    id: G.nextId++, kind: 'pawn',
    name: o.name || uniqueName(age < 13 ? NAMES_KID : gender === 'm' ? NAMES_M : NAMES_F),
    surname: o.surname || G.surname,
    gender, ageDays: age * YEAR_DAYS + U.r() * YEAR_DAYS * 0.9,
    x: o.x, y: o.y, path: [], dir: 1,
    food: 80 + U.r() * 20, rest: 75 + U.r() * 25, joy: 80, mood: 60,
    hp: 100, maxHp: 100, downed: false, tended: 0, tendQ: 0, sick: null,
    skills: {}, traits: o.traits || randTraits(age < 7 ? 1 : U.chance(0.5) ? 2 : 1),
    work: {}, weapon: o.weapon || null, coat: false, carry: null,
    job: null, drafted: false, order: null, brk: null, inspired: 0,
    rel: {}, partner: null, parents: o.parents || [], pregnant: null, planBaby: true,
    mem: [], thoughts: [], nextThink: 0, cd: 0, bubble: null,
    skin: o.skin || U.pick(SKIN), hair: o.hair || U.pick(HAIR), shirt: o.shirt || U.pick(SHIRT),
    gen: o.gen || 1, joined: G.tick, kills: 0,
  };
  for (const k in SKILLS) {
    let lv = age < 3 ? 0 : age < 13 ? U.ri(0, 2) : U.ri(1, Math.min(9, 2 + Math.floor(age / 6)));
    p.skills[k] = { lv, xp: 0 };
  }
  if (o.skillBoost) for (const k in o.skillBoost) p.skills[k].lv = Math.min(20, p.skills[k].lv + o.skillBoost[k]);
  setMaxHp(p); p.hp = p.maxHp;
  autoWork(p);
  return p;
}
function setMaxHp(p) {
  const st = lifeStage(p);
  const old = p.maxHp;
  p.maxHp = st === 'baby' ? 40 : st === 'child' ? 55 : st === 'kid' ? 70 : 100;
  if (old && old !== p.maxHp && !p.downed) p.hp = Math.min(p.maxHp, p.hp + (p.maxHp - old));
}
const WORK_DEFAULT = { doctor: 1, childcare: 1, cook: 1, hunt: 2, build: 2, grow: 2, mine: 3, chop: 2, craft: 2, haul: 3, research: 2 };
function autoWork(p) {
  Object.assign(p.work, WORK_DEFAULT);
  const ranked = WORKS.filter(w => w.skill && w.id !== 'hunt').sort((a, b) => p.skills[b.skill].lv - p.skills[a.skill].lv);
  for (const w of ranked.slice(0, 2)) p.work[w.id] = 1;
}
function fullName(p) { return p.name; }
function pawnById(id) { return G.pawns.find(p => p.id === id); }
function livePawns() { return G.pawns.filter(p => !p.dead); }
function related(a, b) {
  if (a.parents.includes(b.id) || b.parents.includes(a.id)) return true;
  if (a.parents.some(x => b.parents.includes(x))) return true;
  for (const pid of a.parents) { const pp = pawnById(pid); if (pp && pp.parents.includes(b.id)) return true; }
  for (const pid of b.parents) { const pp = pawnById(pid); if (pp && pp.parents.includes(a.id)) return true; }
  return false;
}
function relationName(a, b) { // b เป็นอะไรของ a
  if (a.partner === b.id) return b.gender === 'm' ? 'สามี' : 'ภรรยา';
  if (a.parents.includes(b.id)) return b.gender === 'm' ? 'พ่อ' : 'แม่';
  if (b.parents.includes(a.id)) return b.gender === 'm' ? 'ลูกชาย' : 'ลูกสาว';
  if (a.parents.some(x => b.parents.includes(x))) return b.gender === 'm' ? 'พี่น้อง(ชาย)' : 'พี่น้อง(หญิง)';
  for (const pid of b.parents) { const pp = pawnById(pid); if (pp && pp.parents.includes(a.id)) return 'หลาน'; }
  for (const pid of a.parents) { const pp = pawnById(pid); if (pp && pp.parents.includes(b.id)) return b.gender === 'm' ? 'ปู่/ตา' : 'ย่า/ยาย'; }
  const r = a.rel[b.id] || 0;
  return r > 40 ? 'เพื่อนสนิท' : r < -20 ? 'ไม่ถูกกัน' : 'คนในบ้าน';
}
function hasTrait(p, t) { return p.traits.includes(t); }

// ===== ทักษะ =====
function skillLv(p, s) { return s ? p.skills[s].lv : 5; }
function gainXp(p, s, amt) {
  if (!s) return;
  const sk = p.skills[s];
  let f = hasTrait(p, 'quick') ? 1.5 : 1;
  if (ageYears(p) < 18) f *= 1.4;
  sk.xp += amt * f;
  const need = 350 + sk.lv * 180;
  if (sk.xp >= need && sk.lv < 20) {
    sk.xp -= need; sk.lv++;
    if (sk.lv % 5 === 0) addLog(`⭐ ${p.name} ทักษะ${SKILLS[s]} ถึงระดับ ${sk.lv}`, 'good');
  }
}
function workSpeed(p, s) {
  let v = 0.6 + skillLv(p, s) * 0.08;
  if (hasTrait(p, 'industrious')) v *= 1.2;
  if (hasTrait(p, 'lazy')) v *= 0.85;
  if (s === 'plants' && hasTrait(p, 'greenthumb')) v *= 1.3;
  if (p.inspired > G.tick) v *= 1.5;
  if (lifeStage(p) === 'kid') v *= 0.6;
  if (p.sick) v *= 0.7;
  if (p.hp < p.maxHp * 0.5) v *= 0.75;
  if (p.pregnant && p.pregnant.due - G.tick < DAY * 2) v *= 0.8;
  const a = ageYears(p);
  if (a > 55) v *= Math.max(0.5, 1 - (a - 55) * 0.02);
  if (p.mood < 20) v *= 0.85;
  return v;
}
function moveSpeed(p) {
  const st = lifeStage(p);
  let v = st === 'baby' ? 0.025 : st === 'child' ? 0.06 : st === 'kid' ? 0.075 : 0.085;
  if (hasTrait(p, 'fast')) v *= 1.2;
  if (p.hp < p.maxHp * 0.5) v *= 0.7;
  if (p.sick) v *= 0.8;
  if (ageYears(p) > 60) v *= 0.8;
  return v;
}

// ===== ความคิด / อารมณ์ =====
function addMem(p, id, mult = 1) {
  const t = THOUGHTS[id];
  const ex = p.mem.find(m => m.id === id);
  const until = G.tick + t.days * DAY;
  if (ex) { ex.until = until; ex.val = Math.round(t.val * mult); }
  else p.mem.push({ id, until, val: Math.round(t.val * mult) });
}
function comfortMin(p) { return 10 - (p.coat ? 16 : 0) - (hasTrait(p, 'coldproof') ? 8 : 0); }
function computeThoughts(p) {
  const th = [];
  const st = lifeStage(p);
  p.mem = p.mem.filter(m => m.until > G.tick);
  for (const m of p.mem) th.push([THOUGHTS[m.id].label, m.val]);
  if (p.food < 5) th.push(['อดอยาก', -18]); else if (p.food < 25) th.push(['หิว', -6]);
  if (p.rest < 15) th.push(['เหนื่อยมาก', -8]); else if (p.rest < 30) th.push(['ง่วงนอน', -3]);
  const t = p.temp;
  if (t < comfortMin(p) - 10) th.push(['หนาวจนตัวสั่น', -14]); else if (t < comfortMin(p)) th.push(['หนาว', -5]);
  if (t > 38) th.push(['ร้อนจนทนไม่ไหว', -12]); else if (t > 31) th.push(['ร้อน', -4]);
  if (p.sick) th.push(['ไม่สบาย', -6]);
  if (p.hp < p.maxHp * 0.6 && !p.downed) th.push(['เจ็บปวด', -6]);
  const fam = hasTrait(p, 'loving') ? 1.5 : 1;
  if (p.partner && pawnById(p.partner) && !pawnById(p.partner).dead) th.push(['มีคู่ชีวิตอยู่ข้างกาย', Math.round(5 * fam)]);
  const kids = G.pawns.filter(k => !k.dead && k.parents.includes(p.id)).length;
  if (kids) th.push(['ได้อยู่กับลูกๆ', Math.round(Math.min(8, 3 + kids) * fam)]);
  if (st === 'child' || st === 'kid' || st === 'baby') {
    if (p.joy < 25) th.push(['เบื่อ ไม่มีใครเล่นด้วย', -8]); else if (p.joy > 75) th.push(['สนุกสนาน', 5]);
    const ps = p.parents.map(pawnById).filter(x => x && !x.dead).length;
    if (ps) th.push(['มีพ่อแม่คอยดูแล', 4 * ps]);
  }
  if (hasTrait(p, 'optimist')) th.push(['มองโลกแง่ดี', 8]);
  if (hasTrait(p, 'pessimist')) th.push(['มองโลกแง่ร้าย', -8]);
  if (hasTrait(p, 'lazy')) th.push(['สบายๆ', 3]);
  if (p.pregnant) th.push(['ตั้งครรภ์', 4]);
  const r = G.roomId[ix(Math.round(p.x), Math.round(p.y))];
  if (r > 0 && G.rooms[r].beautyPer > 0.9) th.push(['อยู่ในห้องสวย', 3]);
  p.thoughts = th;
  let target = 50;
  for (const x of th) target += x[1];
  p.moodTarget = U.clamp(target, 0, 100);
}

// ===== tick หลักของตัวละคร =====
function pawnTile(p) { return ix(Math.round(p.x), Math.round(p.y)); }
function pawnTick(p) {
  const st = lifeStage(p);
  const sleeping = p.job && p.job.type === 'sleep' && p.job.asleep;
  // ความต้องการ
  let fr = 0.025 * (st === 'baby' ? 0.65 : st === 'child' ? 0.75 : st === 'kid' ? 0.85 : 1);
  if (hasTrait(p, 'glutton')) fr *= 1.4;
  if (p.pregnant) fr *= 1.2;
  if (sleeping || p.downed) fr *= 0.6;
  p.food = Math.max(0, p.food - fr);
  if (!sleeping && !p.downed) p.rest = Math.max(0, p.rest - (st === 'baby' ? 0.05 : 0.035));
  if (st !== 'adult' && st !== 'teen') p.joy = Math.max(0, p.joy - 0.022);
  // อารมณ์ค่อยๆ เข้าหาเป้า
  if (p.moodTarget !== undefined) p.mood += (p.moodTarget - p.mood) * 0.004;
  if (p.cd > 0) p.cd--;
  // สุขภาพ
  healthTick(p, sleeping);
  if (p.dead) return;
  if ((G.tick + p.id) % 30 === 0) periodic(p);
  if (p.downed) return;
  // ยืนอยู่ในกำแพง -> ออก
  const ti = pawnTile(p);
  if (solidAt(ti)) unstick(p);
  if (p.drafted) { draftedTick(p); return; }
  if (threatReact(p)) return;
  if (p.job) runJob(p);
  else if (G.tick >= p.nextThink) think(p);
}
function unstick(p) {
  const x = Math.round(p.x), y = Math.round(p.y);
  for (let r = 1; r < 6; r++) for (const [dx, dy] of N8) {
    const nx = x + dx * r, ny = y + dy * r;
    if (inb(nx, ny) && !solidAt(ix(nx, ny))) { p.x = nx; p.y = ny; p.path = []; return; }
  }
}
function healthTick(p, sleeping) {
  if (p.downed) {
    if (p.tended < G.tick && p.hp < 0) {
      p.hp -= 0.012; // เลือดออก
      if (p.hp <= -40) return killPawn(p, 'เสียเลือดมากเกินไป');
    }
  }
  if (p.food <= 0) {
    p.hp -= 0.005;
    if (p.hp <= -40) return killPawn(p, 'อดอาหาร');
  }
  if (p.sick) {
    const s = p.sick, tended = p.tended > G.tick;
    s.sev += tended ? -0.00006 * (1 + p.tendQ) : 0.00012;
    s.imm += 0.00016 * (sleeping ? 1.6 : 1) * (tended ? 1.4 : 1) * (hasTrait(p, 'sickly') ? 0.7 : 1);
    if (s.imm >= 1 || s.sev <= 0) { p.sick = null; addLog(`💪 ${p.name} หายป่วยแล้ว`, 'good'); }
    else if (s.sev >= 1) return killPawn(p, 'ป่วยหนัก');
  }
  // หนาว/ร้อนจัด
  if (p.temp !== undefined) {
    if (p.temp < comfortMin(p) - 12) p.hp -= 0.006;
    else if (p.temp > 42) p.hp -= 0.005;
  }
  // ฟื้นฟู
  if (p.food > 5 && (!p.sick || p.sick.sev < 0.5)) {
    let h = 0.004 * (sleeping || p.downed ? 3 : 1) * (p.tended > G.tick ? 1.5 + p.tendQ : 1);
    if (p.downed && p.hp < 0 && p.tended < G.tick) h = 0;
    p.hp = Math.min(p.maxHp, p.hp + h);
  }
  if (!p.downed && p.hp <= 0) downPawn(p);
  if (p.downed && p.hp >= p.maxHp * 0.25) { p.downed = false; addLog(`🩹 ${p.name} ลุกขึ้นได้แล้ว`, 'good'); }
  if (p.hp <= -40) killPawn(p, 'บาดเจ็บสาหัส');
}
function downPawn(p) {
  if (p.downed) return;
  p.downed = true; p.drafted = false;
  endJob(p);
  addLog(`🆘 ${p.name} หมดสติ! ต้องการการรักษา`, 'bad');
  toast(`🆘 ${p.name} หมดสติ!`, 'bad');
}
function killPawn(p, cause) {
  if (p.dead) return;
  endJob(p);
  p.dead = true; p.downed = false; p.deathCause = cause; p.deathDay = dayNum();
  G.stats.deaths++;
  if (p.weapon) dropItem(p.weapon, 1, Math.round(p.x), Math.round(p.y));
  if (p.coat) dropItem('coat', 1, Math.round(p.x), Math.round(p.y));
  p.weapon = null; p.coat = false;
  for (const o of livePawns()) {
    if (o.partner === p.id) { addMem(o, 'partnerDied'); }
    else if (p.parents.includes(o.id)) addMem(o, 'childDied');
    else if (related(o, p)) addMem(o, 'famDied');
    else if ((o.rel[p.id] || 0) > 20) addMem(o, 'famDied', 0.5);
  }
  showLetter({ title: `💔 ${p.name} จากไปแล้ว`, text: `${p.name} (${Math.floor(ageYears(p))} ปี) เสียชีวิตเพราะ${cause}\nครอบครัวเศร้าโศกอย่างมาก`, kind: 'bad' });
  addLog(`💔 ${p.name} เสียชีวิต (${cause})`, 'bad');
  if (G.sel && G.sel.obj === p) G.sel = null;
}

function periodic(p) {
  p.temp = tempAt(pawnTile(p));
  computeThoughts(p);
  const st = lifeStage(p);
  // อายุ
  const before = Math.floor(p.ageDays / YEAR_DAYS);
  p.ageDays += 30 / DAY;
  const after = Math.floor(p.ageDays / YEAR_DAYS);
  if (after !== before) birthday(p, after);
  // สติแตก / แรงบันดาลใจ
  if (!p.brk && p.mood < 22 && st !== 'baby' && U.chance(hasTrait(p, 'brave') ? 0.004 : 0.01)) startBreak(p);
  if (p.brk && G.tick > p.brk.until) { p.brk = null; addMem(p, 'catharsis'); addLog(`😌 ${p.name} อารมณ์ดีขึ้นแล้ว`, ''); }
  if (p.mood > 85 && p.inspired < G.tick && U.chance(0.002) && canWork(p, 'build')) {
    p.inspired = G.tick + DAY; addLog(`✨ ${p.name} มีแรงบันดาลใจ! ทำงานเร็วขึ้น 1 วัน`, 'good');
  }
  // คุยกัน
  if (U.chance(0.12) && st !== 'baby') socialize(p);
  if (p.bubble && p.bubble.until < G.tick) p.bubble = null;
  // ท้อง
  if (p.pregnant && G.tick >= p.pregnant.due) giveBirth(p);
}
function startBreak(p) {
  const st = lifeStage(p);
  const kid = st !== 'adult' && st !== 'teen';
  p.brk = { until: G.tick + DAY * (p.mood < 10 ? 0.6 : 0.35), label: kid ? 'งอแง' : p.mood < 10 ? 'สติแตก' : 'น้อยใจ' };
  p.drafted = false;
  endJob(p);
  addLog(`😡 ${p.name} ${p.brk.label} ไม่ยอมทำงานชั่วคราว (อารมณ์แย่)`, 'bad');
  toast(`😡 ${p.name} ${p.brk.label}!`, 'bad');
}
function birthday(p, age) {
  setMaxHp(p);
  if (age === 3) addLog(`🎂 ${p.name} อายุ 3 ขวบ เดินได้คล่องแล้ว`, 'good');
  if (age === 7) { addLog(`🎂 ${p.name} อายุ 7 ขวบ ช่วยขนของและปลูกผักได้แล้ว!`, 'good'); toast(`🎂 ${p.name} ช่วยงานบ้านได้แล้ว`, 'good'); }
  if (age === 13) { autoWork(p); addLog(`🎂 ${p.name} อายุ 13 ปี เป็นวัยรุ่น ทำงานได้ทุกอย่าง!`, 'good'); toast(`🎂 ${p.name} เป็นวัยรุ่นแล้ว`, 'good'); }
  if (age === 18) {
    addLog(`🎉 ${p.name} อายุ 18 ปี เป็นผู้ใหญ่แล้ว`, 'good');
    if (p.gen > 1) unlockAch('grown');
  }
  if (age >= 60 && U.chance((age - 58) * 0.035)) killPawn(p, 'อายุขัย (จากไปอย่างสงบ)');
}
function socialize(p) {
  let best = null, bd = 5;
  for (const o of G.pawns) {
    if (o === p || o.dead || o.downed || lifeStage(o) === 'baby') continue;
    if (o.job && o.job.type === 'sleep' && o.job.asleep) continue;
    const d = U.dist(p.x, p.y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  if (!best || (p.job && p.job.type === 'sleep' && p.job.asleep)) return;
  const fight = U.chance((p.mood < 30 ? 0.12 : 0.03));
  const d = fight ? -U.ri(3, 8) : U.ri(1, 3) + (p.partner === best.id ? 1 : 0);
  p.rel[best.id] = U.clamp((p.rel[best.id] || 0) + d, -100, 100);
  best.rel[p.id] = U.clamp((best.rel[p.id] || 0) + d, -100, 100);
  p.bubble = { t: fight ? '💢' : p.partner === best.id ? '❤️' : U.pick(['💬', '😄', '🗨️']), until: G.tick + 80 };
  gainXp(p, 'social', 4);
  // ความรัก
  if (!fight && !p.partner && !best.partner && lifeStage(p) === 'adult' && lifeStage(best) === 'adult' &&
    !related(p, best) && Math.abs(ageYears(p) - ageYears(best)) < 16 && (p.rel[best.id] || 0) > 55 && U.chance(0.25)) {
    p.partner = best.id; best.partner = p.id;
    addMem(p, 'married'); addMem(best, 'married');
    p.bubble = best.bubble = { t: '💕', until: G.tick + 300 };
    showLetter({ title: '💒 งานแต่งงาน!', text: `${p.name} และ ${best.name} ตกลงใช้ชีวิตคู่กัน\nสร้างเตียงคู่ให้ทั้งสองเพื่อให้มีลูกได้`, kind: 'good' });
    if (G.stats.couples++ >= 1) unlockAch('wedding');
  }
}
function giveBirth(m) {
  const f = pawnById(m.pregnant.father);
  m.pregnant = null;
  const gen = Math.max(m.gen, f ? f.gen : 1) + 1;
  const baby = createPawn({
    age: 0, x: Math.round(m.x), y: Math.round(m.y), parents: [m.id].concat(f ? [f.id] : []), gen,
    surname: m.surname, skin: U.chance(0.5) ? m.skin : (f ? f.skin : m.skin), hair: U.chance(0.5) ? m.hair : (f ? f.hair : m.hair),
  });
  baby.ageDays = 0; baby.food = 70;
  G.pawns.push(baby);
  G.stats.born++;
  for (const o of livePawns()) if (o !== baby) addMem(o, 'newBaby', related(o, baby) ? 1 : 0.6);
  unlockAch('baby1');
  if (gen >= 3) unlockAch('gen3');
  showLetter({
    title: `👶 ${baby.name} ลืมตาดูโลก!`,
    text: `${m.name}${f ? ' และ ' + f.name : ''} มี${baby.gender === 'm' ? 'ลูกชาย' : 'ลูกสาว'}ชื่อ "${baby.name}"\nทารกต้องการคนป้อนอาหาร (งาน: ดูแลเด็ก) และควรมีเปลเด็ก`,
    kind: 'good',
  });
}

// ===== ระบบจอง =====
function reserveT(p, key) {
  const o = G.tRes.get(key);
  if (o !== undefined && o !== p.id) return false;
  G.tRes.set(key, p.id);
  if (p.job) p.job.res.push(key);
  return true;
}
function isResT(key, p) { const o = G.tRes.get(key); return o !== undefined && (!p || o !== p.id); }
function reserveItem(p, i, n) {
  G.itemRes.set(i, (G.itemRes.get(i) || 0) + n);
  p.job.items.push([i, n]);
}
function releaseItem(p, i) {
  const j = p.job;
  for (let k = j.items.length - 1; k >= 0; k--) {
    const [ii, n] = j.items[k];
    if (ii !== i) continue;
    const v = (G.itemRes.get(ii) || 0) - n;
    if (v > 0) G.itemRes.set(ii, v); else G.itemRes.delete(ii);
    j.items.splice(k, 1);
  }
}
function newJob(p, type, data) {
  endJob(p);
  p.job = Object.assign({ type, stage: 0, walk: -1, prog: 0, res: [], items: [], cells: [] }, data);
  p.path = [];
  return p.job;
}
function endJob(p) {
  const j = p.job;
  if (j) {
    for (const k of j.res) if (G.tRes.get(k) === p.id) G.tRes.delete(k);
    for (const [i, n] of j.items) {
      const v = (G.itemRes.get(i) || 0) - n;
      if (v > 0) G.itemRes.set(i, v); else G.itemRes.delete(i);
    }
    for (const c of j.cells) G.cellRes.delete(c);
    if (j.drops) for (const d of j.drops) if (!d.done) d.tgt.inc[j.mat] = Math.max(0, (d.tgt.inc[j.mat] || 0) - d.n);
    if (j.student) { const s = pawnById(j.student); if (s && s.job && s.job.type === 'attend') { s.job = null; s.path = []; } }
  }
  if (p.carry) { dropItem(p.carry.t, p.carry.n, Math.round(p.x), Math.round(p.y)); p.carry = null; }
  p.job = null; p.path = [];
}
function failJob(p, delay = 40) { endJob(p); p.nextThink = G.tick + delay; }

// ===== การเดิน =====
function goTo(p, i, adj) {
  const path = findPath(Math.round(p.x), Math.round(p.y), ixX(i), ixY(i), adj, false);
  if (!path) return false;
  p.path = path;
  return true;
}
function stepMove(p, speedMul = 1) {
  if (!p.path.length) return true;
  const n = p.path[0];
  if (solidAt(n)) { p.path = []; if (p.job) p.job.walk = -1; return false; }
  const tx = ixX(n), ty = ixY(n);
  const dx = tx - p.x, dy = ty - p.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const sp = moveSpeed(p) * speedMul / moveCost(n);
  if (dx) p.dir = dx > 0 ? 1 : -1;
  if (d <= sp) { p.x = tx; p.y = ty; p.path.shift(); }
  else { p.x += dx / d * sp; p.y += dy / d * sp; }
  return !p.path.length;
}
// เดินไปยังจุดหมาย คืน true เมื่อถึงแล้ว
function arrive(p, i, adj) {
  const j = p.job;
  if (j.walk !== i) {
    j.walk = i;
    if (!goTo(p, i, adj)) { failJob(p, 120); return false; }
  }
  if (p.path.length) { stepMove(p); return false; }
  return true;
}
function setStage(j, s) { j.stage = s; j.walk = -1; }

// ===== ตอบสนองต่อภัย =====
function hostiles() {
  const out = [];
  for (const r of G.raiders) if (!r.dead) out.push(r);
  for (const a of G.animals) if (!a.dead && (a.manhunter || a.angry)) out.push(a);
  return out;
}
function nearestHostile(p, maxD) {
  let best = null, bd = maxD;
  for (const h of hostiles()) {
    const d = U.dist(p.x, p.y, h.x, h.y);
    if (d < bd) { bd = d; best = h; }
  }
  return best;
}
function threatReact(p) {
  if (!G.raiders.length && !G.animals.some(a => a.manhunter || a.angry)) return false;
  const st = lifeStage(p);
  const h = nearestHostile(p, canFight(p) ? 5 : 9);
  if (!h) return false;
  if (canFight(p) && (p.weapon || U.dist(p.x, p.y, h.x, h.y) < 2)) {
    // ป้องกันตัว
    const w = WEAPONS[p.weapon || 'fist'];
    const d = U.dist(p.x, p.y, h.x, h.y);
    if (d <= w.range && (!w.ranged || lineClear(p.x, p.y, h.x, h.y))) {
      if (p.job && p.job.type !== 'defend') endJob(p);
      if (p.cd <= 0) attack(p, h);
      return true;
    }
    if (h.target === p || d < 3) {
      if (!p.job || p.job.type !== 'defend') { newJob(p, 'defend', { tgt: h.id }); }
      runJob(p);
      return true;
    }
    return false;
  }
  // หนี
  if (!p.job || p.job.type !== 'flee') {
    const dest = fleeSpot(p, h);
    if (dest >= 0) { newJob(p, 'flee', { t: dest, until: G.tick + 200 }); }
  }
  if (p.job && p.job.type === 'flee') { runJob(p); return true; }
  return false;
}
function fleeSpot(p, h) {
  const x = Math.round(p.x), y = Math.round(p.y);
  const vx = p.x - h.x, vy = p.y - h.y, vl = Math.hypot(vx, vy) || 1;
  // หลบเข้าห้องถ้ามี
  let best = -1, bs = -1e9;
  for (let k = 0; k < 24; k++) {
    const nx = Math.round(x + vx / vl * U.ri(4, 9) + U.ri(-4, 4)), ny = Math.round(y + vy / vl * U.ri(4, 9) + U.ri(-4, 4));
    if (!inb(nx, ny)) continue;
    const i = ix(nx, ny);
    if (solidAt(i) || !canReach(pawnTile(p), i)) continue;
    const s = U.dist(nx, ny, h.x, h.y) + (isIndoor(i) ? 6 : 0);
    if (s > bs) { bs = s; best = i; }
  }
  return best;
}

function draftedTick(p) {
  if (p.food < 10 && !nearestHostile(p, 9)) {
    p.drafted = false; p.order = null;
    toast(`🍚 ${p.name} หิวมาก ขอไปหาอะไรกินก่อน`, 'bad');
    return;
  }
  const w = WEAPONS[p.weapon || 'fist'];
  const o = p.order;
  // โจมตีเป้าหมายที่สั่ง
  if (o && o.type === 'attack') {
    const t = findCreature(o.id);
    if (!t || t.dead) { p.order = null; return; }
    const d = U.dist(p.x, p.y, t.x, t.y);
    if (d <= w.range && (!w.ranged || lineClear(p.x, p.y, t.x, t.y))) { p.path = []; if (p.cd <= 0) attack(p, t); return; }
    if (!p.path.length || G.tick % 30 === 0) {
      const pth = findPath(Math.round(p.x), Math.round(p.y), Math.round(t.x), Math.round(t.y), true, false);
      p.path = pth || [];
    }
    stepMove(p);
    return;
  }
  if (o && o.type === 'move') {
    if (!p.path.length) {
      const pth = findPath(Math.round(p.x), Math.round(p.y), ixX(o.t), ixY(o.t), false, false);
      if (!pth) { p.order = null; return; }
      p.path = pth;
      if (!pth.length) { p.order = null; return; }
    }
    if (stepMove(p)) p.order = null;
    return;
  }
  // ยืนเฉยๆ ยิงศัตรูในระยะ
  if (p.cd <= 0) {
    let best = null, bd = w.range;
    for (const h of hostiles()) {
      const d = U.dist(p.x, p.y, h.x, h.y);
      if (d <= bd && (!w.ranged || lineClear(p.x, p.y, h.x, h.y))) { bd = d; best = h; }
    }
    if (best) attack(p, best);
  }
}

// ===== เลือกงาน =====
function think(p) {
  p.nextThink = G.tick + 20 + U.ri(0, 20);
  const st = lifeStage(p);
  if (p.brk) { if (p.food < 25 && eatJob(p)) return; wanderJob(p, 6); return; }
  if (st === 'baby') { babyThink(p); return; }
  // ความต้องการพื้นฐาน
  if (p.sick && p.sick.sev > 0.45 && p.rest < 95) { if (sleepJob(p, true)) return; }
  if (p.rest < 12) { if (sleepJob(p)) return; }
  if (p.food < 30 || (isNight() && p.food < 45)) { if (eatJob(p)) return; }
  if (p.rest < 22 || (isNight() && p.rest < 95)) { if (sleepJob(p)) return; }
  if (equipJob(p)) return;
  if (p.temp !== undefined && p.temp < comfortMin(p) - 4 && U.chance(0.6)) { if (warmJob(p)) return; }
  if ((st === 'child' || st === 'kid') && p.joy < 45) { if (playSelfJob(p)) return; }
  // งานตามลำดับความสำคัญ
  if (st !== 'child') {
    for (let pr = 1; pr <= 3; pr++) {
      for (const w of WORKS) {
        if (p.work[w.id] !== pr || !canWork(p, w.id)) continue;
        if (JOBFIND[w.id](p)) return;
      }
    }
  }
  if (p.food < 55 && eatJob(p)) return;
  if ((st === 'child' || st === 'kid') && p.joy < 85 && playSelfJob(p)) return;
  idleJob(p);
}

function nearestCandidates(p, list, adj) {
  const pt = pawnTile(p);
  const px = Math.round(p.x), py = Math.round(p.y);
  const arr = [];
  for (const i of list) {
    if (!canReach(pt, i, adj)) continue;
    arr.push([Math.abs(ixX(i) - px) + Math.abs(ixY(i) - py), i]);
  }
  arr.sort((a, b) => a[0] - b[0]);
  return arr.map(a => a[1]);
}
function homeCenter() {
  let sx = 0, sy = 0, n = 0;
  for (const id in G.bld) { const b = G.bld[id]; if (b.built) { sx += b.x; sy += b.y; n++; } }
  if (!n) return [G.start[0], G.start[1]];
  return [Math.round(sx / n), Math.round(sy / n)];
}
function wanderJob(p, r) {
  const [hx, hy] = p.brk ? [Math.round(p.x), Math.round(p.y)] : homeCenter();
  for (let k = 0; k < 10; k++) {
    const nx = hx + U.ri(-r, r), ny = hy + U.ri(-r, r);
    if (!inb(nx, ny)) continue;
    const i = ix(nx, ny);
    if (solidAt(i) || !canReach(pawnTile(p), i)) continue;
    newJob(p, 'wander', { t: i, wait: U.ri(40, 140) });
    return true;
  }
  p.nextThink = G.tick + 60;
  return false;
}
function idleJob(p) {
  // ผิงไฟถ้ามีกองไฟ
  const fires = buildingsOf(b => b.built && BDEF[b.type].heat >= 10);
  if (fires.length && U.chance(0.5)) {
    const f = fires[U.ri(0, fires.length - 1)];
    const i = ix(f.x, f.y);
    if (canReach(pawnTile(p), i, true) && U.dist(p.x, p.y, f.x, f.y) < 25) { newJob(p, 'idlefire', { t: i, b: f.id, wait: U.ri(150, 300) }); return; }
  }
  wanderJob(p, 7);
}

// ----- นอน -----
function findBed(p) {
  const st = lifeStage(p);
  // เตียงที่เป็นเจ้าของ
  let own = buildingsOf(b => b.built && b.owners && b.owners.includes(p.id))[0];
  if (own) return own;
  return null;
}
function assignBeds() {
  const beds = buildingsOf(b => b.built && (BDEF[b.type].bed || BDEF[b.type].crib));
  const alive = livePawns();
  for (const b of beds) b.owners = (b.owners || []).filter(id => { const q = pawnById(id); return q && !q.dead; });
  const owned = new Set(); beds.forEach(b => b.owners.forEach(o => owned.add(o)));
  // คู่รักใช้เตียงคู่
  for (const p of alive) {
    if (!p.partner || owned.has(p.id)) continue;
    const q = pawnById(p.partner);
    if (!q || q.dead) continue;
    const bed = beds.find(b => BDEF[b.type].bed === 2 && (b.owners.length === 0 || (b.owners.length === 1 && b.owners[0] === q.id)));
    if (bed) {
      if (owned.has(q.id) && !bed.owners.includes(q.id)) {
        for (const b of beds) b.owners = b.owners.filter(o => o !== q.id);
      }
      bed.owners = [p.id, q.id]; owned.add(p.id); owned.add(q.id);
    }
  }
  for (const p of alive) {
    if (owned.has(p.id)) continue;
    const baby = lifeStage(p) === 'baby';
    let bed = beds.find(b => (baby ? BDEF[b.type].crib : BDEF[b.type].bed === 1) && b.owners.length === 0);
    if (!bed && !baby) bed = beds.find(b => BDEF[b.type].bed === 2 && b.owners.length === 0);
    if (bed) { bed.owners.push(p.id); owned.add(p.id); }
  }
}
function sleepJob(p, sickRest) {
  const bed = findBed(p);
  if (bed) {
    const i = ix(bed.x, bed.y);
    if (canReach(pawnTile(p), i)) { newJob(p, 'sleep', { t: i, bed: bed.id, sickRest }); return true; }
  }
  // นอนพื้น หาที่ในห้องถ้าใกล้
  let spot = pawnTile(p);
  const rooms = G.rooms.slice(1).filter(r => r && r.tiles.length);
  if (rooms.length && !isIndoor(spot)) {
    const r = rooms[U.ri(0, rooms.length - 1)];
    const t = r.tiles[U.ri(0, r.tiles.length - 1)];
    if (!solidAt(t) && canReach(spot, t) && U.dist(p.x, p.y, ixX(t), ixY(t)) < 30) spot = t;
  }
  newJob(p, 'sleep', { t: spot, bed: -1, sickRest });
  return true;
}

// ----- กิน -----
function findFood(p, forBaby) {
  const px = p.x, py = p.y, pt = pawnTile(p);
  let best = -1, bs = 1e9;
  for (const [i, s] of G.items) {
    const d = ITEMS[s.t];
    if (!d.food || itemAvail(i) <= 0) continue;
    if (!canReach(pt, i)) continue;
    const pref = FOOD_PREF.indexOf(s.t);
    const score = U.dist(px, py, ixX(i), ixY(i)) + pref * 10 - (d.raw ? Math.min(itemAvail(i), 8) * 1.2 : 8);
    if (score < bs) { bs = score; best = i; }
  }
  return best;
}
function eatJob(p) {
  const i = findFood(p);
  if (i < 0) return false;
  const s = G.items.get(i);
  const d = ITEMS[s.t];
  const want = d.raw ? Math.min(itemAvail(i), Math.max(1, Math.ceil((100 - p.food) / d.food))) : 1;
  const j = newJob(p, 'eat', { from: i });
  reserveItem(p, i, want);
  j.want = want;
  return true;
}
function findTableSpot(p) {
  const tables = buildingsOf(b => b.built && BDEF[b.type].table);
  let best = -1, bd = 18;
  for (const t of tables) {
    for (const [dx, dy] of N4) {
      const x = t.x + dx, y = t.y + dy;
      if (!inb(x, y)) continue;
      const i = ix(x, y);
      if (solidAt(i) || isResT('seat' + i, p)) continue;
      const d = U.dist(p.x, p.y, x, y);
      if (d < bd && canReach(pawnTile(p), i)) { bd = d; best = i; }
    }
  }
  return best;
}

// ----- สวมใส่ -----
function weaponScore(t) { return t ? ITEMS[t].val : 0; }
function equipJob(p) {
  const st = lifeStage(p);
  if (st === 'baby') return false;
  const pt = pawnTile(p);
  for (const [i, s] of G.items) {
    const d = ITEMS[s.t];
    if (!d.equip || itemAvail(i) <= 0 || !canReach(pt, i)) continue;
    if (d.equip === 'coat' && !p.coat) {
      const j = newJob(p, 'equip', { from: i, it: s.t }); reserveItem(p, i, 1); return true;
    }
    if (d.equip === 'weapon' && canFight(p) && weaponScore(s.t) > weaponScore(p.weapon) * 1.2 && G.autoEquip !== false) {
      const j = newJob(p, 'equip', { from: i, it: s.t }); reserveItem(p, i, 1); return true;
    }
  }
  return false;
}
function warmJob(p) {
  let best = null, bt = p.temp + 4;
  for (let r = 1; r < G.rooms.length; r++) {
    const room = G.rooms[r];
    if (room.temp > bt) { bt = room.temp; best = room; }
  }
  if (!best) return false;
  for (let k = 0; k < 6; k++) {
    const t = best.tiles[U.ri(0, best.tiles.length - 1)];
    if (!solidAt(t) && canReach(pawnTile(p), t)) { newJob(p, 'wander', { t, wait: 200, warm: 1 }); return true; }
  }
  return false;
}
function playSelfJob(p) {
  const boxes = buildingsOf(b => b.built && BDEF[b.type].toy);
  for (const b of boxes) {
    const i = ix(b.x, b.y);
    if (canReach(pawnTile(p), i, true)) { newJob(p, 'toy', { t: i, b: b.id }); return true; }
  }
  if (p.joy < 60) { newJob(p, 'wander', { t: pawnTile(p), wait: 150, play: 1 }); return true; }
  return false;
}
function babyThink(p) {
  if (p.rest < 40 || isNight()) { sleepJob(p); return; }
  // คลานไปหาแม่/พ่อ
  const par = p.parents.map(pawnById).find(x => x && !x.dead && !x.downed);
  if (par && U.dist(p.x, p.y, par.x, par.y) > 4 && U.chance(0.5)) {
    const t = pawnTile(par);
    if (canReach(pawnTile(p), t)) { newJob(p, 'wander', { t, wait: 60 }); return; }
  }
  newJob(p, 'wander', { t: pawnTile(p), wait: 100 });
}

// ===== ค้นหางานแต่ละประเภท =====
const JOBFIND = {
  doctor(p) {
    // ป้อนอาหารคนที่หมดสติ
    for (const o of G.pawns) {
      if (o.dead || !o.downed || o.food > 45 || o === p || isResT('feed' + o.id, p)) continue;
      if (!canReach(pawnTile(p), pawnTile(o), true)) continue;
      const f = findFood(p);
      if (f < 0) break;
      const j = newJob(p, 'feed', { pid: o.id, from: f });
      reserveT(p, 'feed' + o.id);
      const s = G.items.get(f);
      j.want = ITEMS[s.t].raw ? Math.min(itemAvail(f), 8) : 1;
      reserveItem(p, f, j.want);
      return true;
    }
    const pats = G.pawns.filter(o => !o.dead && o !== p && o.tended < G.tick &&
      (o.downed || o.sick || o.hp < o.maxHp * 0.7) && !isResT('tend' + o.id, p));
    if (!pats.length) return false;
    pats.sort((a, b) => (b.downed - a.downed) || U.dist(p.x, p.y, a.x, a.y) - U.dist(p.x, p.y, b.x, b.y));
    for (const o of pats) {
      if (!canReach(pawnTile(p), pawnTile(o), true)) continue;
      const j = newJob(p, 'tend', { pid: o.id });
      reserveT(p, 'tend' + o.id);
      // หยิบยาถ้ามี
      const med = nearestItemOf(p, 'medicine');
      if (med >= 0) { j.med = med; reserveItem(p, med, 1); } else j.stage = 2;
      return true;
    }
    return false;
  },
  childcare(p) {
    const st = lifeStage(p);
    if (st !== 'adult' && st !== 'teen') return false;
    // ป้อนทารก
    for (const b of G.pawns) {
      if (b.dead || lifeStage(b) !== 'baby' || b.food > 50 || isResT('feed' + b.id, p)) continue;
      if (!canReach(pawnTile(p), pawnTile(b))) continue;
      const f = findFood(p);
      if (f < 0) return false;
      const j = newJob(p, 'feed', { pid: b.id, from: f });
      reserveT(p, 'feed' + b.id);
      const s = G.items.get(f);
      j.want = ITEMS[s.t].raw ? Math.min(itemAvail(f), 8) : 1;
      reserveItem(p, f, j.want);
      return true;
    }
    // สอนหนังสือ
    const board = buildingsOf(b => b.built && BDEF[b.type].teach)[0];
    if (board && st === 'adult') {
      for (const k of G.pawns) {
        const ks = lifeStage(k);
        if (k.dead || k.downed || k.brk || (ks !== 'kid' && ks !== 'teen' && ks !== 'child') || (k.learnCd || 0) > G.tick) continue;
        if (k.job && (k.job.type === 'sleep' || k.job.type === 'eat' || k.job.type === 'attend')) continue;
        if (isResT('kid' + k.id, p) || !canReach(pawnTile(k), ix(board.x, board.y), true)) continue;
        const j = newJob(p, 'teach', { pid: k.id, b: board.id, t: ix(board.x, board.y) });
        reserveT(p, 'kid' + k.id);
        return true;
      }
    }
    // เล่นกับเด็ก
    for (const k of G.pawns) {
      const ks = lifeStage(k);
      if (k.dead || k.downed || (ks !== 'baby' && ks !== 'child' && ks !== 'kid') || k.joy > 55) continue;
      if (k.job && k.job.type === 'sleep') continue;
      if (isResT('kid' + k.id, p) || !canReach(pawnTile(p), pawnTile(k), true)) continue;
      newJob(p, 'play', { pid: k.id });
      reserveT(p, 'kid' + k.id);
      return true;
    }
    return false;
  },
  cook(p) { return stationWork(p, 'cook'); },
  craft(p) { return stationWork(p, 'craft'); },
  research(p) {
    if (!G.research.cur) return false;
    const benches = buildingsOf(b => b.built && BDEF[b.type].station === 'research' && !isResT('b' + b.id, p));
    for (const b of benches) {
      const i = ix(b.x, b.y);
      if (!canReach(pawnTile(p), i, true)) continue;
      newJob(p, 'research', { b: b.id, t: i });
      reserveT(p, 'b' + b.id);
      return true;
    }
    return false;
  },
  hunt(p) {
    if (!p.weapon && skillLv(p, 'shooting') < 6) return false;
    let best = null, bd = 1e9;
    for (const a of G.animals) {
      if (a.dead || !a.hunt || isResT('a' + a.id, p)) continue;
      const d = U.dist(p.x, p.y, a.x, a.y);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) return false;
    newJob(p, 'hunt', { aid: best.id });
    reserveT(p, 'a' + best.id);
    return true;
  },
  build(p) {
    const bps = [];
    const decon = [];
    for (const id in G.bld) {
      const b = G.bld[id];
      if (b.decon) { if (!isResT('b' + b.id, p)) decon.push(b); continue; }
      if (!b.built) bps.push(b);
    }
    const pt = pawnTile(p);
    const px = p.x, py = p.y;
    const byDist = arr => arr.filter(b => canReach(pt, ix(b.x, b.y), true)).sort((a, b) => U.dist(px, py, a.x, a.y) - U.dist(px, py, b.x, b.y));
    for (const b of byDist(decon)) { newJob(p, 'decon', { b: b.id, t: ix(b.x, b.y) }); reserveT(p, 'b' + b.id); return true; }
    const sorted = byDist(bps);
    // ก่อสร้างที่ของครบแล้ว
    for (const b of sorted) {
      if (isResT('b' + b.id, p) || !fullyDelivered(b)) continue;
      if (natBlocks(b)) continue;
      newJob(p, 'build', { b: b.id, t: ix(b.x, b.y) });
      reserveT(p, 'b' + b.id);
      return true;
    }
    // ส่งวัสดุ
    for (const b of sorted.slice(0, 30)) {
      const need = needOf(b);
      for (const mat in need) {
        const src = nearestItemOf(p, mat);
        if (src < 0) continue;
        return startDeliver(p, b, mat, need[mat], src);
      }
    }
    return false;
  },
  grow(p) {
    const list = [];
    const t0 = G.outT;
    for (let i = 0; i < NT; i++) {
      if (G.zone[i] === Z_FARM) {
        const n = G.nat[i];
        if (n === N_CROP && G.grow[i] >= 1) list.push(i);
        else if (n === N_NONE && G.zoneCrop[i] && G.bmap[i] < 0 && !G.items.has(i) && tempAt(i) > 4) {
          const c = CROPS[G.zoneCrop[i]];
          if (resDone(c.res)) list.push(i);
        }
      } else if (G.desig[i] === D_HARVEST && G.nat[i] === N_BUSH && G.grow[i] >= 1) list.push(i);
    }
    if (!list.length) return false;
    for (const i of nearestCandidates(p, list, false).slice(0, 20)) {
      if (isResT('n' + i, p)) continue;
      const n = G.nat[i];
      newJob(p, n === N_NONE ? 'sow' : 'harvest', { t: i });
      reserveT(p, 'n' + i);
      return true;
    }
    return false;
  },
  mine(p) { return desigJob(p, D_MINE, 'mine'); },
  chop(p) { return desigJob(p, D_CHOP, 'chop'); },
  haul(p) {
    if (!G.hasStock) return false;
    const pt = pawnTile(p);
    const cand = [];
    for (const [i, s] of G.items) {
      if (isStockpile(i) || itemAvail(i) <= 0) continue;
      if (G.forbid && G.forbid.has(i)) continue;
      cand.push(i);
    }
    if (!cand.length) return false;
    for (const i of nearestCandidates(p, cand, false).slice(0, 12)) {
      const s = G.items.get(i);
      const dest = findStockCell(p, s.t, i);
      if (dest < 0) continue;
      const cap = carryCap(p);
      const n = Math.min(itemAvail(i), cap);
      const j = newJob(p, 'haul', { from: i, to: dest, it: s.t });
      reserveItem(p, i, n); j.want = n;
      G.cellRes.add(dest); j.cells.push(dest);
      return true;
    }
    return false;
  },
};
function carryCap(p) { const st = lifeStage(p); return st === 'kid' ? 25 : st === 'teen' ? 50 : 75; }
function nearestItemOf(p, cls) {
  const types = ingTypes(cls);
  const pt = pawnTile(p);
  let best = -1, bd = 1e9;
  for (const [i, s] of G.items) {
    if (!types.includes(s.t) || itemAvail(i) <= 0 || !canReach(pt, i)) continue;
    const d = U.dist(p.x, p.y, ixX(i), ixY(i)) - (isStockpile(i) ? 3 : 0);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function findStockCell(p, type, from) {
  const pt = pawnTile(p);
  const fx = ixX(from), fy = ixY(from);
  let best = -1, bd = 1e9;
  for (const i of G.stockList) {
    if (G.cellRes.has(i) || G.bmap[i] >= 0 || !canHold(i, type)) continue;
    if (!canReach(pt, i)) continue;
    const s = G.items.get(i);
    const d = U.dist(fx, fy, ixX(i), ixY(i)) - (s ? 4 : 0);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}
function natBlocks(b) {
  const n = G.nat[ix(b.x, b.y)];
  return n === N_TREE || n === N_ROCK || n === N_ORE;
}
function desigJob(p, kind, type) {
  const list = [];
  for (let i = 0; i < NT; i++) if (G.desig[i] === kind) list.push(i);
  if (!list.length) return false;
  for (const i of nearestCandidates(p, list, true).slice(0, 15)) {
    if (isResT('n' + i, p)) continue;
    newJob(p, type, { t: i });
    reserveT(p, 'n' + i);
    return true;
  }
  return false;
}
function startDeliver(p, target, mat, need, src) {
  let left = Math.min(itemAvail(src), carryCap(p));
  if (left <= 0) return false;
  const drops = [];
  const add = (b, want) => {
    const n = Math.min(want, left);
    if (n <= 0) return;
    const tgt = b.built && b.cur ? b.cur : b;
    tgt.inc[mat] = (tgt.inc[mat] || 0) + n;
    drops.push({ b: b.id, n, tgt });
    left -= n;
  };
  add(target, need);
  // แบกไปส่งแปลนข้างเคียงในรอบเดียว
  if (!target.built && left > 0) {
    const near = [];
    for (const id in G.bld) {
      const b = G.bld[id];
      if (b === target || b.built || U.dist(b.x, b.y, target.x, target.y) > 7) continue;
      const nd = needOf(b)[mat];
      if (nd) near.push([U.dist(b.x, b.y, target.x, target.y), b, nd]);
    }
    near.sort((a, c) => a[0] - c[0]);
    for (const [, b, nd] of near) { if (left <= 0 || drops.length >= 12) break; add(b, nd); }
  }
  const total = drops.reduce((a, d) => a + d.n, 0);
  const j = newJob(p, 'deliver', { from: src, b: target.id, mat, drops, k: 0 });
  reserveItem(p, src, total); j.want = total;
  return true;
}
function stationWork(p, st) {
  const stations = buildingsOf(b => b.built && BDEF[b.type].station === st);
  if (!stations.length) return false;
  const pt = pawnTile(p);
  for (const b of stations.sort((a, c) => U.dist(p.x, p.y, a.x, a.y) - U.dist(p.x, p.y, c.x, c.y))) {
    const i = ix(b.x, b.y);
    if (!canReach(pt, i, true)) continue;
    // เลือกสูตรใหม่
    if (!b.cur) {
      for (const bill of b.bills) {
        const r = RECIPES[bill.r];
        if (!resDone(r.res) || (r.only && r.only !== b.type)) continue;
        if ((G.counts[r.out] || 0) >= bill.n) continue;
        // มีวัตถุดิบพอไหม
        if (!r.ing.every(([cls, n]) => ingTypes(cls).reduce((a, t) => a + (G.counts[t] || 0), 0) >= n)) continue;
        b.cur = { r: bill.r, del: {}, inc: {}, delT: {}, prog: 0 };
        break;
      }
      if (!b.cur) continue;
    }
    if (fullyDelivered(b)) {
      if (isResT('b' + b.id, p)) continue;
      newJob(p, 'craft', { b: b.id, t: i });
      reserveT(p, 'b' + b.id);
      return true;
    }
    const need = needOf(b);
    for (const mat in need) {
      const src = nearestItemOf(p, mat);
      if (src < 0) continue;
      return startDeliver(p, b, mat, need[mat], src);
    }
    // ไม่มีวัตถุดิบแล้ว ยกเลิกถ้ายังไม่ได้ส่งอะไร
    const c = b.cur;
    if (!Object.keys(c.del).length && !Object.values(c.inc).some(v => v > 0)) b.cur = null;
  }
  return false;
}

// ===== ทำงาน =====
function runJob(p) {
  const j = p.job;
  const fn = JOBRUN[j.type];
  if (!fn) { endJob(p); return; }
  fn(p, j);
}
function pickUp(p, j, from) {
  const s = G.items.get(from);
  const want = j.want || 1;
  releaseItem(p, from);
  if (!s) return false;
  const type = s.t;
  const k = takeItem(from, want);
  if (k <= 0) return false;
  p.carry = { t: type, n: k };
  return true;
}
const JOBRUN = {
  wander(p, j) {
    if (j.stage === 0) { if (!arrive(p, j.t, false)) return; setStage(j, 1); }
    if (j.play) p.joy = Math.min(100, p.joy + 0.25);
    if (--j.wait <= 0) endJob(p);
  },
  idlefire(p, j) {
    if (j.stage === 0) { if (!arrive(p, j.t, true)) return; setStage(j, 1); }
    if (j.wait % 60 === 0 && p.temp < 22) addMem(p, 'fireWarm');
    if (--j.wait <= 0) endJob(p);
  },
  flee(p, j) {
    if (j.stage === 0) { if (!arrive(p, j.t, false)) return; setStage(j, 1); }
    if (G.tick > j.until) endJob(p);
  },
  defend(p, j) {
    const t = findCreature(j.tgt);
    if (!t || t.dead) return endJob(p);
    const w = WEAPONS[p.weapon || 'fist'];
    const d = U.dist(p.x, p.y, t.x, t.y);
    if (d <= w.range && (!w.ranged || lineClear(p.x, p.y, t.x, t.y))) { p.path = []; if (p.cd <= 0) attack(p, t); return; }
    if (d > 10) return endJob(p);
    if (!p.path.length || G.tick % 30 === 0) p.path = findPath(Math.round(p.x), Math.round(p.y), Math.round(t.x), Math.round(t.y), true, false) || [];
    stepMove(p);
  },
  sleep(p, j) {
    if (j.stage === 0) {
      if (j.bed >= 0 && !G.bld[j.bed]) return endJob(p);
      if (!arrive(p, j.t, false)) return;
      setStage(j, 1); j.asleep = true;
    }
    const bed = j.bed >= 0 ? G.bld[j.bed] : null;
    p.rest = Math.min(100, p.rest + (bed ? 0.13 : 0.09));
    const day = !isNight();
    const done = j.sickRest ? (!p.sick || p.rest >= 100) && day : (day && (p.rest > 85 || hourNow() > 9)) || (p.rest >= 100 && p.food < 20);
    if (done || (lifeStage(p) === 'baby' && p.food < 15 && U.chance(0.01))) {
      const i = pawnTile(p);
      if (!isIndoor(i)) addMem(p, 'sleptOut');
      else if (!bed) addMem(p, 'sleptFloor');
      if (bed && isIndoor(i) && G.rooms[G.roomId[i]].beautyPer > 0.8) addMem(p, 'niceRoom');
      if (bed && BDEF[bed.type].bed === 2 && p.partner && bed.owners.includes(p.partner)) {
        const q = pawnById(p.partner);
        if (q && !q.dead) { addMem(p, 'sleptPartner'); tryConceive(p, q); }
      }
      endJob(p);
    }
  },
  eat(p, j) {
    if (j.stage === 0) {
      if (!arrive(p, j.from, false)) return;
      if (!pickUp(p, j, j.from)) return failJob(p);
      const seat = findTableSpot(p);
      j.seat = seat;
      if (seat >= 0) reserveT(p, 'seat' + seat);
      setStage(j, 1);
    }
    if (j.stage === 1) {
      if (j.seat >= 0 && !arrive(p, j.seat, false)) return;
      setStage(j, 2);
    }
    if (++j.prog < 60) return;
    const c = p.carry;
    if (c) {
      const d = ITEMS[c.t];
      p.food = Math.min(100, p.food + d.food * c.n);
      if (d.raw) addMem(p, 'ateRaw');
      if (c.t === 'finemeal') addMem(p, 'ateFine');
      addMem(p, j.seat >= 0 ? 'ateTable' : 'ateFloor');
      p.carry = null;
    }
    endJob(p);
  },
  equip(p, j) {
    if (!arrive(p, j.from, false)) return;
    releaseItem(p, j.from);
    const s = G.items.get(j.from);
    if (!s || s.t !== j.it) return failJob(p);
    takeItem(j.from, 1);
    if (ITEMS[j.it].equip === 'coat') p.coat = true;
    else { if (p.weapon) dropItem(p.weapon, 1, Math.round(p.x), Math.round(p.y)); p.weapon = j.it; }
    endJob(p);
  },
  toy(p, j) {
    if (j.stage === 0) { if (!G.bld[j.b]) return endJob(p); if (!arrive(p, j.t, true)) return; setStage(j, 1); }
    p.joy = Math.min(100, p.joy + 0.35);
    if (++j.prog > 200 || p.joy >= 100) { addMem(p, 'toy'); endJob(p); }
  },
  haul(p, j) {
    if (j.stage === 0) {
      if (!arrive(p, j.from, false)) return;
      if (!pickUp(p, j, j.from)) return failJob(p);
      setStage(j, 1);
    }
    if (!arrive(p, j.to, false)) return;
    const c = p.carry;
    p.carry = null;
    if (c) {
      if (canHold(j.to, c.t)) {
        let s = G.items.get(j.to);
        if (!s) { s = { t: c.t, n: 0 }; G.items.set(j.to, s); }
        const k = Math.min(c.n, ITEMS[c.t].stack - s.n);
        s.n += k;
        if (c.n - k > 0) dropItem(c.t, c.n - k, ixX(j.to), ixY(j.to));
      } else dropItem(c.t, c.n, ixX(j.to), ixY(j.to));
    }
    endJob(p);
  },
  deliver(p, j) {
    if (j.stage === 0) {
      if (!arrive(p, j.from, false)) return;
      if (!pickUp(p, j, j.from)) return failJob(p);
      setStage(j, 1);
    }
    const d = j.drops[j.k];
    const c = p.carry;
    if (!d || !c) return endJob(p);
    const b = G.bld[d.b];
    const tgt = d.tgt;
    if (!b || (b.built && b.cur !== tgt) || (!b.built && b !== tgt)) {
      d.done = true; tgt.inc[j.mat] = Math.max(0, (tgt.inc[j.mat] || 0) - d.n);
      j.k++; j.walk = -1; return;
    }
    if (!arrive(p, ix(b.x, b.y), true)) return;
    const n = Math.min(c.n, d.n);
    tgt.del[j.mat] = (tgt.del[j.mat] || 0) + n;
    if (tgt.delT) tgt.delT[c.t] = (tgt.delT[c.t] || 0) + n;
    tgt.inc[j.mat] = Math.max(0, (tgt.inc[j.mat] || 0) - d.n);
    d.done = true;
    c.n -= n;
    if (c.n <= 0) p.carry = null;
    j.k++; j.walk = -1;
    if (!p.carry || j.k >= j.drops.length) endJob(p);
  },
  build(p, j) {
    const b = G.bld[j.b];
    if (!b || b.built || natBlocks(b)) return endJob(p);
    if (!arrive(p, j.t, true)) return;
    const d = BDEF[b.type];
    b.prog += workSpeed(p, 'construction');
    gainXp(p, 'construction', 1);
    if (b.prog >= d.work) { completeBuilding(b); endJob(p); }
  },
  decon(p, j) {
    const b = G.bld[j.b];
    if (!b) return endJob(p);
    if (!arrive(p, j.t, true)) return;
    j.prog += workSpeed(p, 'construction');
    if (j.prog >= Math.max(30, BDEF[b.type].work * 0.5)) { removeBuilding(b, b.built ? 0.75 : 0); endJob(p); }
  },
  craft(p, j) {
    const b = G.bld[j.b];
    if (!b || !b.cur) return endJob(p);
    if (!arrive(p, j.t, true)) return;
    const r = RECIPES[b.cur.r];
    const spd = workSpeed(p, r.skill) * (b.type === 'stove' ? 1.4 : 1);
    b.cur.prog += spd;
    gainXp(p, r.skill, 1);
    if (b.cur.prog >= r.work) {
      b.cur = null;
      dropItem(r.out, 1, b.x, b.y + 1);
      recount();
      endJob(p);
    }
  },
  research(p, j) {
    const b = G.bld[j.b];
    if (!b || !G.research.cur) return endJob(p);
    if (!arrive(p, j.t, true)) return;
    const id = G.research.cur;
    G.research.prog[id] = (G.research.prog[id] || 0) + workSpeed(p, 'research') * 0.1;
    gainXp(p, 'research', 1);
    if (G.research.prog[id] >= RESEARCH[id].cost) finishResearch(id);
    if (++j.prog > 600 || p.rest < 20 || p.food < 25) endJob(p);
  },
  chop(p, j) {
    if (G.nat[j.t] !== N_TREE || G.desig[j.t] !== D_CHOP) return endJob(p);
    if (!arrive(p, j.t, true)) return;
    j.prog += workSpeed(p, 'plants');
    gainXp(p, 'plants', 0.6);
    if (j.prog >= 140) {
      const amt = Math.round(25 * G.grow[j.t]);
      G.nat[j.t] = N_NONE; G.desig[j.t] = 0;
      dropItem('wood', Math.max(3, amt), ixX(j.t), ixY(j.t));
      endJob(p);
    }
  },
  mine(p, j) {
    const n = G.nat[j.t];
    if ((n !== N_ROCK && n !== N_ORE) || G.desig[j.t] !== D_MINE) return endJob(p);
    if (!arrive(p, j.t, true)) return;
    j.prog += workSpeed(p, 'mining');
    gainXp(p, 'mining', 1);
    if (j.prog >= 260) {
      G.nat[j.t] = N_NONE; G.desig[j.t] = 0;
      const x = ixX(j.t), y = ixY(j.t);
      if (n === N_ORE) dropItem('iron', U.ri(12, 20), x, y); else dropItem('stone', U.ri(12, 18), x, y);
      G.mapDirty = true; G.terrainDirty = true;
      endJob(p);
    }
  },
  sow(p, j) {
    if (G.zone[j.t] !== Z_FARM || G.nat[j.t] !== N_NONE || !G.zoneCrop[j.t]) return endJob(p);
    if (!arrive(p, j.t, false)) return;
    j.prog += workSpeed(p, 'plants');
    gainXp(p, 'plants', 1);
    if (j.prog >= 40) {
      G.nat[j.t] = N_CROP; G.cropT[j.t] = G.zoneCrop[j.t]; G.grow[j.t] = 0;
      endJob(p);
    }
  },
  harvest(p, j) {
    const n = G.nat[j.t];
    if ((n !== N_CROP && n !== N_BUSH) || G.grow[j.t] < 1) return endJob(p);
    if (!arrive(p, j.t, false)) return;
    j.prog += workSpeed(p, 'plants');
    gainXp(p, 'plants', 1);
    if (j.prog >= 50) {
      const x = ixX(j.t), y = ixY(j.t);
      const bonus = 0.8 + skillLv(p, 'plants') * 0.03;
      if (n === N_BUSH) { dropItem('veg', Math.round(8 * bonus), x, y); G.grow[j.t] = 0; }
      else {
        const c = CROPS[G.cropT[j.t]];
        dropItem(c.item, Math.max(1, Math.round(c.yield * bonus)), x, y);
        G.nat[j.t] = N_NONE;
      }
      endJob(p);
    }
  },
  hunt(p, j) {
    const a = findCreature(j.aid);
    if (!a || a.dead || !a.hunt) return endJob(p);
    const w = WEAPONS[p.weapon || 'fist'];
    const d = U.dist(p.x, p.y, a.x, a.y);
    if (d <= w.range * 0.9 && (!w.ranged || lineClear(p.x, p.y, a.x, a.y))) {
      p.path = [];
      if (p.cd <= 0) { attack(p, a); gainXp(p, 'shooting', 8); }
      return;
    }
    if (!p.path.length || (G.tick + p.id) % 40 === 0) {
      p.path = findPath(Math.round(p.x), Math.round(p.y), Math.round(a.x), Math.round(a.y), true, false) || [];
      if (!p.path.length && d > w.range) { if (++j.prog > 5) return failJob(p, 200); }
    }
    stepMove(p);
  },
  tend(p, j) {
    const o = pawnById(j.pid);
    if (!o || o.dead) return endJob(p);
    if (j.stage === 0) {
      if (!arrive(p, j.med, false)) return;
      j.want = 1;
      if (!pickUp(p, j, j.med)) { setStage(j, 2); return; }
      setStage(j, 2);
    }
    if (!arrive(p, pawnTile(o), true)) {
      if (j.walk >= 0 && p.path.length && pawnTile(o) !== j.walk && G.tick % 40 === 0) j.walk = -1;
      return;
    }
    if (U.dist(p.x, p.y, o.x, o.y) > 1.8) { j.walk = -1; return; }
    j.prog += workSpeed(p, 'medicine');
    gainXp(p, 'medicine', 1.5);
    if (j.prog >= 90) {
      const med = p.carry && p.carry.t === 'medicine';
      if (med) p.carry = null;
      o.tended = G.tick + DAY;
      o.tendQ = 0.2 + (med ? 0.5 : 0) + skillLv(p, 'medicine') * 0.03 + (G.research.done.medicine2 ? 0.3 : 0);
      if (o.downed && o.hp < 1) o.hp = 1;
      o.bubble = { t: '🩹', until: G.tick + 100 };
      endJob(p);
    }
  },
  feed(p, j) {
    const b = pawnById(j.pid);
    if (!b || b.dead) return endJob(p);
    if (j.stage === 0) {
      if (!arrive(p, j.from, false)) return;
      if (!pickUp(p, j, j.from)) return failJob(p);
      setStage(j, 1);
    }
    if (U.dist(p.x, p.y, b.x, b.y) > 2.1) {
      if (!p.path.length || G.tick % 50 === 0) { if (!goTo(p, pawnTile(b), true)) return failJob(p); }
      stepMove(p); if (++j.prog > 1500) failJob(p); return;
    }
    if (j.prog > 60) j.prog = 0;
    if (++j.prog < 60) return;
    const c = p.carry;
    if (c) { b.food = Math.min(100, b.food + ITEMS[c.t].food * c.n); p.carry = null; }
    b.joy = Math.min(100, b.joy + 15);
    b.bubble = { t: '🍼', until: G.tick + 100 };
    gainXp(p, 'social', 10);
    endJob(p);
  },
  play(p, j) {
    const k = pawnById(j.pid);
    if (!k || k.dead || k.downed) return endJob(p);
    if (U.dist(p.x, p.y, k.x, k.y) > 2.1) {
      if (!p.path.length || G.tick % 50 === 0) { if (!goTo(p, pawnTile(k), true)) return failJob(p); }
      stepMove(p);
      if (++j.prog > 900) endJob(p);
      return;
    }
    if (!j.started) {
      j.started = true; j.prog = 0;
      if (lifeStage(k) !== 'baby') { endJob(k); k.job = { type: 'wait', until: G.tick + 220, res: [], items: [], cells: [], walk: -1, stage: 0 }; }
    }
    k.joy = Math.min(100, k.joy + (G.research.done.childcare ? 0.3 : 0.2));
    if (j.prog % 40 === 0) { p.bubble = { t: '😄', until: G.tick + 40 }; k.bubble = { t: '🤣', until: G.tick + 40 }; }
    gainXp(p, 'social', 1);
    if (++j.prog >= 200 || k.joy >= 100) {
      addMem(p, 'played', hasTrait(p, 'loving') ? 1.5 : 1); addMem(k, 'wasPlayed');
      p.rel[k.id] = Math.min(100, (p.rel[k.id] || 0) + 4); k.rel[p.id] = Math.min(100, (k.rel[p.id] || 0) + 4);
      if (k.job && k.job.type === 'wait') k.job = null;
      endJob(p);
    }
  },
  wait(p, j) { if (G.tick > j.until) endJob(p); },
  teach(p, j) {
    const k = pawnById(j.pid), b = G.bld[j.b];
    if (!k || k.dead || !b) return endJob(p);
    if (j.stage === 0) {
      endJob(k);
      k.job = { type: 'attend', t: j.t, teacher: p.id, res: [], items: [], cells: [], walk: -1, stage: 0, prog: 0 };
      j.student = k.id;
      setStage(j, 1);
    }
    if (!arrive(p, j.t, true)) return;
    if (!k.job || k.job.type !== 'attend') return endJob(p);
    if (U.dist(k.x, k.y, b.x, b.y) > 1.8) { if (++j.prog > 600) endJob(p); return; }
    // สอนทักษะที่เก่งที่สุดของครู
    if (!j.skill) {
      j.skill = Object.keys(SKILLS).filter(s => p.skills[s].lv > k.skills[s].lv).sort((a, c) => (p.skills[c].lv - k.skills[c].lv) - (p.skills[a].lv - k.skills[a].lv))[0] || 'research';
      j.prog = 0;
    }
    gainXp(k, j.skill, 3.5);
    gainXp(p, 'social', 1);
    if (++j.prog >= 300) {
      addMem(k, 'learned'); addMem(p, 'played');
      k.learnCd = G.tick + DAY * 0.5;
      addLog(`📚 ${p.name} สอน${SKILLS[j.skill]}ให้ ${k.name}`, 'good');
      k.job = null;
      j.student = null;
      endJob(p);
    }
  },
  attend(p, j) {
    if (!pawnById(j.teacher) || !pawnById(j.teacher).job || pawnById(j.teacher).job.type !== 'teach') { p.job = null; return; }
    if (j.stage === 0) { if (!arrive(p, j.t, true)) return; setStage(j, 1); }
  },
};
function tryConceive(a, b) {
  const f = a.gender === 'f' ? a : b.gender === 'f' ? b : null;
  const m = a.gender === 'm' ? a : b.gender === 'm' ? b : null;
  if (!f || !m || f.pregnant || !f.planBaby || !m.planBaby) return;
  if (lifeStage(f) !== 'adult' || ageYears(f) > 45) return;
  if (f.mood < 35 || m.mood < 35) return;
  if ((f.lastConceiveRoll || 0) > G.tick - DAY * 0.5) return;
  f.lastConceiveRoll = G.tick;
  const babies = G.pawns.filter(x => !x.dead && lifeStage(x) === 'baby').length;
  if (U.chance(babies ? 0.04 : 0.12)) {
    f.pregnant = { father: m.id, due: G.tick + DAY * SEASON_DAYS };
    showLetter({ title: '🤰 ข่าวดี!', text: `${f.name} ตั้งครรภ์แล้ว!\nลูกจะเกิดในอีกประมาณ ${SEASON_DAYS} วัน\nเตรียมเปลเด็กและอาหารไว้ให้พร้อม`, kind: 'good' });
  }
}
function finishResearch(id) {
  G.research.done[id] = true;
  G.research.cur = null;
  const n = Object.keys(G.research.done).length;
  showLetter({ title: `🔬 วิจัยสำเร็จ: ${RESEARCH[id].name}`, text: RESEARCH[id].desc + '\n\nเลือกงานวิจัยถัดไปได้ที่เมนู วิจัย', kind: 'good' });
  unlockAch('research1');
  if (n >= 6) unlockAch('research6');
  if (n >= Object.keys(RESEARCH).length) unlockAch('researchAll');
  uiDirty('research');
}
