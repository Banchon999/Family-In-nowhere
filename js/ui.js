'use strict';
const UI = { tool: null, drag: null, sheet: null, sheetArg: null, dirty: {}, follow: null, letters: [], letterOpen: false, famKey: '' };
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function uiDirty(k) { UI.dirty[k] = true; }
function h(tag, attrs, ...kids) {
  const e = document.createElement(tag);
  if (attrs) for (const k in attrs) {
    if (k === 'onclick') e.addEventListener('click', attrs[k]);
    else if (k === 'class') e.className = attrs[k];
    else if (k === 'html') e.innerHTML = attrs[k];
    else if (attrs[k] !== false && attrs[k] !== null && attrs[k] !== undefined) e.setAttribute(k, attrs[k]);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
  return e;
}

// ===== แจ้งเตือน =====
function toast(msg, kind) {
  const box = $('toasts');
  if (!box) return;
  const t = h('div', { class: 'toast ' + (kind || '') }, msg);
  box.prepend(t);
  while (box.children.length > 3) box.lastChild.remove();
  setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 400); }, 3600);
}
function showLetter(l) {
  UI.letters.push(l);
  if (!UI.letterOpen) nextLetter();
}
function nextLetter() {
  const l = UI.letters.shift();
  const m = $('modal');
  if (!l) { m.hidden = true; UI.letterOpen = false; if (UI.pausedByLetter) { G.paused = false; UI.pausedByLetter = false; } return; }
  UI.letterOpen = true;
  if (!G.paused) { G.paused = true; UI.pausedByLetter = true; }
  const card = $('modalCard');
  card.className = 'card ' + (l.kind || '');
  card.innerHTML = '';
  card.append(h('h3', null, l.title));
  card.append(h('p', { class: 'letter-text' }, l.text));
  const row = h('div', { class: 'choices' });
  for (const c of (l.choices || [{ label: 'ตกลง' }])) {
    row.append(h('button', { class: 'btn' + (c.fn ? ' primary' : ''), onclick: () => { try { c.fn && c.fn(); } finally { nextLetter(); } } }, c.label));
  }
  card.append(row);
  m.hidden = false;
}

// ===== ความเร็ว / เครื่องมือ =====
function setSpeed(n) {
  if (n === 0) { G.paused = true; UI.pausedByLetter = false; }
  else { G.speed = n; G.paused = false; UI.pausedByLetter = false; }
  updateSpeedBtns();
}
function togglePause() { setSpeed(G.paused ? G.speed : 0); }
function updateSpeedBtns() {
  for (const b of document.querySelectorAll('#speed button[data-sp]')) {
    const sp = +b.dataset.sp;
    b.classList.toggle('on', sp === 0 ? G.paused : (!G.paused && G.speed === sp));
  }
}
const TOOL_NAMES = { [D_CHOP]: 'ตัดต้นไม้', [D_MINE]: 'ขุดหิน/แร่', [D_HARVEST]: 'เก็บผลไม้ป่า', cancel: 'ยกเลิกคำสั่ง/แปลน', decon: 'รื้อถอน', hunt: 'ล่าสัตว์' };
function setTool(t) {
  UI.tool = t; UI.drag = null;
  const hint = $('hint');
  if (!t) { hint.hidden = true; return; }
  closeSheet();
  let name = '';
  if (t.kind === 'build') name = `สร้าง ${BDEF[t.type].name} — ${Object.keys(BDEF[t.type].cost).map(k => ITEMS[k].icon + BDEF[t.type].cost[k]).join(' ')} /ช่อง`;
  else if (t.kind === 'desig') name = TOOL_NAMES[t.d];
  else if (t.kind === 'zone') name = t.z === Z_STOCK ? 'โซนคลังเก็บของ' : t.z === Z_FARM ? `แปลงปลูก${CROPS[t.crop].name}` : 'ลบโซน';
  $('hintText').innerHTML = `<b>${esc(name)}</b><small>ลากนิ้ว 1 นิ้วเพื่อวาง • 2 นิ้วเลื่อน/ซูม</small>`;
  hint.hidden = false;
  select(null);
}

// ===== เลือก =====
function select(kind, obj, x, y) {
  if (!kind) { G.sel = null; renderInfo(); return; }
  G.sel = { kind, obj, x, y };
  renderInfo();
}
function jobLabel(p) {
  if (p.dead) return 'เสียชีวิตแล้ว';
  if (p.downed) return '🆘 หมดสติ รอการรักษา';
  if (p.drafted) return p.order ? (p.order.type === 'attack' ? '⚔️ กำลังโจมตี' : '🚶 เคลื่อนที่') : '⚔️ พร้อมรบ (แตะพื้นเพื่อสั่งเดิน)';
  if (p.brk) return `😡 ${p.brk.label} (ไม่ยอมทำงาน)`;
  const j = p.job;
  if (!j) return 'ว่าง';
  const nm = id => { const q = pawnById(id); return q ? q.name : ''; };
  const b = j.b !== undefined ? G.bld[j.b] : null;
  switch (j.type) {
    case 'sleep': return j.asleep ? (j.sickRest ? 'นอนพักฟื้น' : 'นอนหลับ') : 'ไปนอน';
    case 'eat': return 'กินข้าว';
    case 'haul': return `ขน${ITEMS[j.it].name}ไปเก็บ`;
    case 'deliver': return `ขน${ITEMS[ingTypes(j.mat)[0]] ? ITEMS[ingTypes(j.mat)[0]].name : 'วัตถุดิบ'}ไป${b ? BDEF[b.type].name : ''}`;
    case 'build': return `ก่อสร้าง${b ? BDEF[b.type].name : ''}`;
    case 'decon': return 'รื้อถอน';
    case 'craft': return b && b.cur ? `ทำ${RECIPES[b.cur.r].name}` : 'ผลิต';
    case 'research': return `วิจัย ${G.research.cur ? RESEARCH[G.research.cur].name : ''}`;
    case 'chop': return 'ตัดไม้';
    case 'mine': return 'ขุดหิน';
    case 'sow': return 'หว่านเมล็ด';
    case 'harvest': return 'เก็บเกี่ยว';
    case 'hunt': return 'ล่าสัตว์';
    case 'tend': return `รักษา ${nm(j.pid)}`;
    case 'feed': return `ป้อนอาหาร ${nm(j.pid)}`;
    case 'play': return `เล่นกับ ${nm(j.pid)}`;
    case 'teach': return `สอนหนังสือ ${nm(j.pid)}`;
    case 'attend': return 'เรียนหนังสือ';
    case 'wander': return j.warm ? 'หาที่อุ่นๆ' : j.play ? 'วิ่งเล่น' : 'เดินเล่น';
    case 'idlefire': return 'นั่งผิงไฟ';
    case 'flee': return '🏃 วิ่งหนี!';
    case 'defend': return '⚔️ ป้องกันตัว';
    case 'equip': return `หยิบ${ITEMS[j.it].name}`;
    case 'toy': return 'เล่นของเล่น';
    case 'wait': return 'เล่นกับผู้ใหญ่';
  }
  return j.type;
}
function bar(label, v, cls) {
  return h('div', { class: 'bar' }, h('span', null, label), h('i', null, h('b', { class: cls || '', style: `width:${U.clamp(v, 0, 100)}%` })));
}
function moodCls(m) { return m < 25 ? 'bad' : m < 45 ? 'warn' : 'good'; }
function renderInfo() {
  const box = $('info');
  const sel = G.sel;
  box.innerHTML = '';
  if (!sel) { box.hidden = true; return; }
  box.hidden = false;
  const o = sel.obj;
  if (sel.kind === 'pawn') {
    const st = lifeStage(o);
    box.append(h('div', { class: 'info-head' },
      portrait(o, 40),
      h('div', { class: 'grow' }, h('b', null, o.name + ' ' + (o.gender === 'm' ? '♂' : '♀')), h('small', null, `${STAGE_NAME[st]} ${Math.floor(ageYears(o))} ปี • `, h('span', { 'data-k': 'job' }, jobLabel(o)))),
      h('button', { class: 'x', onclick: () => select(null) }, '✕')));
    const bars = h('div', { class: 'bars', 'data-k': 'bars' });
    box.append(bars);
    const row = h('div', { class: 'row' });
    if (canFight(o) && !o.dead) row.append(h('button', { class: 'btn' + (o.drafted ? ' danger' : ''), 'data-k': 'draft', onclick: () => { toggleDraft(o); renderInfo(); } }, o.drafted ? '🏳️ ปลดเกณฑ์' : '⚔️ เกณฑ์'));
    row.append(h('button', { class: 'btn', onclick: () => openSheet('pawn', o.id) }, '📋 ข้อมูล'));
    row.append(h('button', { class: 'btn', onclick: () => { UI.follow = UI.follow === o ? null : o; renderInfo(); } }, UI.follow === o ? '📍 เลิกติดตาม' : '📍 ติดตาม'));
    box.append(row);
  } else if (sel.kind === 'animal') {
    const d = ANIMALS[o.type];
    box.append(h('div', { class: 'info-head' }, h('div', { class: 'grow' }, h('b', null, d.name + (o.manhunter ? ' (คลั่ง)' : '')), h('small', null, `เนื้อ ${d.meat} • หนัง ${d.hide}`)), h('button', { class: 'x', onclick: () => select(null) }, '✕')));
    box.append(h('div', { class: 'bars', 'data-k': 'bars' }));
    if (!o.manhunter) box.append(h('div', { class: 'row' }, h('button', { class: 'btn' + (o.hunt ? ' danger' : ''), onclick: () => { o.hunt = !o.hunt; renderInfo(); } }, o.hunt ? 'ยกเลิกการล่า' : '🎯 สั่งล่า')));
  } else if (sel.kind === 'raider') {
    box.append(h('div', { class: 'info-head' }, h('div', { class: 'grow' }, h('b', null, 'โจรป่า'), h('small', null, `อาวุธ: ${WEAPONS[o.weapon].name}`)), h('button', { class: 'x', onclick: () => select(null) }, '✕')));
    box.append(h('div', { class: 'bars', 'data-k': 'bars' }));
  } else if (sel.kind === 'building') {
    const d = BDEF[o.type];
    box.append(h('div', { class: 'info-head' }, h('div', { class: 'grow' }, h('b', null, d.name + (o.built ? '' : ' (แปลน)')), h('small', { 'data-k': 'bstat' }, '')), h('button', { class: 'x', onclick: () => select(null) }, '✕')));
    box.append(h('p', { class: 'muted small' }, d.desc || ''));
    const row = h('div', { class: 'row' });
    if (o.built && (d.station === 'cook' || d.station === 'craft')) row.append(h('button', { class: 'btn primary', onclick: () => openSheet('station', o.id) }, '📜 สั่งผลิต'));
    if (o.built && d.station === 'research') row.append(h('button', { class: 'btn primary', onclick: () => openSheet('research') }, '🔬 เลือกงานวิจัย'));
    if (o.built) row.append(h('button', { class: 'btn' + (o.decon ? ' danger' : ''), onclick: () => { o.decon = !o.decon; renderInfo(); } }, o.decon ? 'ยกเลิกรื้อถอน' : '🗑️ รื้อถอน'));
    else row.append(h('button', { class: 'btn danger', onclick: () => { removeBuilding(o); select(null); } }, 'ยกเลิกแปลน'));
    box.append(row);
  } else if (sel.kind === 'tile') {
    box.append(h('div', { class: 'info-head' }, h('div', { class: 'grow' }, h('b', { 'data-k': 'tname' }, ''), h('small', { 'data-k': 'tinfo' }, '')), h('button', { class: 'x', onclick: () => select(null) }, '✕')));
    box.append(h('p', { class: 'small', 'data-k': 'tmore' }, ''));
  }
  updateInfo();
}
function updateInfo() {
  const sel = G.sel, box = $('info');
  if (!sel || box.hidden) return;
  const o = sel.obj;
  const q = k => box.querySelector(`[data-k="${k}"]`);
  if (sel.kind === 'pawn') {
    if (o.dead) { select(null); return; }
    q('job').textContent = jobLabel(o);
    const bars = q('bars'); bars.innerHTML = '';
    bars.append(bar('🍚 อิ่ม', o.food, o.food < 25 ? 'bad' : ''), bar('😴 พลัง', o.rest, o.rest < 25 ? 'bad' : ''),
      bar('😊 อารมณ์', o.mood, moodCls(o.mood)), bar('❤️ สุขภาพ', o.hp / o.maxHp * 100, o.hp < o.maxHp * 0.5 ? 'bad' : 'good'));
    if (lifeStage(o) !== 'adult' && lifeStage(o) !== 'teen') bars.append(bar('🎈 สนุก', o.joy, o.joy < 30 ? 'bad' : ''));
    const db = q('draft');
    if (db) { db.textContent = o.drafted ? '🏳️ ปลดเกณฑ์' : '⚔️ เกณฑ์'; db.classList.toggle('danger', o.drafted); }
  } else if (sel.kind === 'animal' || sel.kind === 'raider') {
    if (o.dead || o.gone) { select(null); return; }
    const bars = q('bars'); bars.innerHTML = '';
    bars.append(bar('❤️ พลังชีวิต', o.hp / o.maxHp * 100, 'bad'));
  } else if (sel.kind === 'building') {
    if (!G.bld[o.id]) { select(null); return; }
    const d = BDEF[o.type];
    let s = '';
    if (!o.built) {
      s = 'วัสดุ: ' + Object.keys(d.cost).map(k => `${ITEMS[k].icon}${o.del[k] || 0}/${d.cost[k]}`).join(' ');
      if (fullyDelivered(o)) s = `กำลังสร้าง ${Math.floor(o.prog / d.work * 100)}%`;
    } else {
      s = `ความทนทาน ${Math.ceil(o.hp)}/${d.hp}`;
      if (o.owners && o.owners.length) s += ' • เจ้าของ: ' + o.owners.map(id => (pawnById(id) || {}).name).join(', ');
      if (o.cur) s += ` • กำลังทำ ${RECIPES[o.cur.r].name}`;
      const r = G.roomId[ix(o.x, o.y)];
      if (d.heat || d.cool) s += r > 0 ? ` • ห้อง ${Math.round(G.rooms[r].temp)}°C` : ' • อยู่กลางแจ้ง';
    }
    q('bstat').textContent = s;
  } else if (sel.kind === 'tile') {
    const i = ix(sel.x, sel.y);
    const n = G.nat[i];
    let name = TER[G.terrain[i]].name;
    if (n === N_TREE) name = 'ต้นไม้'; else if (n === N_ROCK) name = 'หินภูเขา'; else if (n === N_ORE) name = 'แร่เหล็ก';
    else if (n === N_BUSH) name = 'พุ่มผลไม้ป่า'; else if (n === N_CROP) name = CROPS[G.cropT[i]].name;
    q('tname').textContent = name;
    const t = tempAt(i);
    let info = `${Math.round(t)}°C • ดิน x${TER[G.terrain[i]].fert}`;
    if (n === N_TREE || n === N_BUSH || n === N_CROP) info += ` • โต ${Math.floor(G.grow[i] * 100)}%`;
    q('tinfo').textContent = info;
    const parts = [];
    const r = G.roomId[i];
    if (r > 0) { const room = G.rooms[r]; parts.push(`🏠 ในห้อง (ขนาด ${room.size} ช่อง, ความสวย ${room.beautyPer.toFixed(1)})`); }
    else if (r === 0) parts.push('🌤️ กลางแจ้ง');
    const it = G.items.get(i);
    if (it) parts.push(`${ITEMS[it.t].icon} ${ITEMS[it.t].name} ×${it.n}`);
    if (G.zone[i]) parts.push(G.zone[i] === Z_STOCK ? '📦 คลังเก็บของ' : `🌾 แปลงปลูก${G.zoneCrop[i] ? CROPS[G.zoneCrop[i]].name : ''}`);
    if (n === N_TREE) parts.push('ใช้คำสั่ง "ตัดไม้" เพื่อได้ไม้');
    if (n === N_ROCK || n === N_ORE) parts.push('ใช้คำสั่ง "ขุด" เพื่อได้' + (n === N_ORE ? 'เหล็ก' : 'หิน'));
    q('tmore').textContent = parts.join(' • ');
  }
}
function toggleDraft(p) {
  p.drafted = !p.drafted;
  p.order = null;
  endJob(p);
}
function portrait(p, size) {
  const c = mkCanvas(size, size);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(pawnSpr(p), 2, 0, 12, 12, 0, size * 0.06, size, size);
  c.className = 'portrait';
  return c;
}

// ===== แถบบน แถบครอบครัว =====
const RES_SHOW = ['wood', 'stone', 'iron', 'food', 'meal', 'medicine', 'silver'];
function updateTop() {
  const hr = hourNow();
  $('tDay').textContent = `วัน ${dayNum()}`;
  const s = SEASONS[seasonIdx()];
  $('tSeason').textContent = `${s.icon} ${s.name} ปี ${yearNum()}`;
  $('tTime').textContent = `${String(Math.floor(hr)).padStart(2, '0')}:${String(Math.floor((hr % 1) * 60 / 10) * 10).padStart(2, '0')}`;
  $('tTemp').textContent = `${Math.round(G.outT)}°C`;
  $('tTemp').className = G.outT < 0 ? 'cold' : G.outT > 32 ? 'hot' : '';
  const c = G.counts;
  const vals = { wood: c.wood, stone: c.stone, iron: c.iron, food: c.veg + c.meat, meal: c.meal + c.finemeal, medicine: c.medicine, silver: c.silver };
  const icons = { food: '🥬', meal: '🍲' };
  const box = $('res');
  if (!box.children.length) {
    for (const k of RES_SHOW) box.append(h('span', { class: 'chip', 'data-r': k, title: k }, h('em', null, icons[k] || ITEMS[k].icon), h('b', null, '0')));
    box.addEventListener('click', () => openSheet('stock'));
  }
  for (const k of RES_SHOW) box.querySelector(`[data-r="${k}"] b`).textContent = U.fmt(vals[k] || 0);
  $('bTrader').hidden = !G.trader;
  // เป้าหมาย
  const q = QUESTS[G.quest];
  const qb = $('quest');
  if (q && G.settings.showQuest !== false) { qb.hidden = false; qb.querySelector('span').textContent = `${G.quest + 1}/${QUESTS.length} ${q.text}`; }
  else qb.hidden = true;
  updateSpeedBtns();
}
function updateFamily() {
  const box = $('fam');
  const ps = livePawns();
  const key = ps.map(p => p.id + lifeStage(p) + (p.coat ? 'c' : '') + p.shirt).join(',');
  if (key !== UI.famKey) {
    UI.famKey = key;
    box.innerHTML = '';
    for (const p of ps) {
      const el = h('button', { class: 'fp', 'data-id': p.id, onclick: () => { select('pawn', p); G.cam.x = p.x; G.cam.y = p.y; } },
        portrait(p, 34), h('span', { class: 'nm' }, p.name), h('i', { class: 'mood' }, h('b')));
      box.append(el);
    }
  }
  for (const p of ps) {
    const el = box.querySelector(`[data-id="${p.id}"]`);
    if (!el) continue;
    const b = el.querySelector('.mood b');
    b.style.width = p.mood + '%';
    b.className = moodCls(p.mood);
    el.classList.toggle('alert', p.downed || !!p.brk || p.food < 10 || (p.sick && p.sick.sev > 0.5));
    el.classList.toggle('drafted', p.drafted);
    el.classList.toggle('sel', !!(G.sel && G.sel.obj === p));
  }
}

// ===== แผ่นเมนูด้านล่าง =====
function openSheet(name, arg) {
  if (UI.sheet === name && UI.sheetArg === arg && name !== 'pawn' && name !== 'station') { closeSheet(); return; }
  UI.sheet = name; UI.sheetArg = arg;
  if (name !== 'pawn' && name !== 'station') setTool(null);
  const sh = $('sheet');
  sh.hidden = false;
  for (const b of document.querySelectorAll('#bar button')) b.classList.toggle('on', b.dataset.s === name);
  renderSheet();
}
function closeSheet() {
  UI.sheet = null;
  $('sheet').hidden = true;
  for (const b of document.querySelectorAll('#bar button')) b.classList.remove('on');
}
function renderSheet() {
  const name = UI.sheet;
  if (!name) return;
  const body = $('sheetBody');
  body.innerHTML = '';
  const title = $('sheetTitle');
  const fn = SHEETS[name];
  if (!fn) return;
  title.textContent = fn.title(UI.sheetArg);
  fn.render(body, UI.sheetArg);
}
function liveSheet() {
  const fn = UI.sheet && SHEETS[UI.sheet];
  if (fn && fn.live) fn.live($('sheetBody'), UI.sheetArg);
}
function toolBtn(icon, label, sub, onclick, locked) {
  return h('button', { class: 'tool' + (locked ? ' locked' : ''), onclick: locked ? () => toast(locked, 'bad') : onclick },
    h('span', { class: 'ti' }, icon), h('b', null, label), sub ? h('small', null, sub) : null);
}
let BUILD_TAB = 'struct';
const SHEETS = {
  orders: {
    title: () => '🪓 สั่งงาน',
    render(b) {
      const g = h('div', { class: 'grid' });
      g.append(
        toolBtn('🪓', 'ตัดไม้', 'ได้ไม้จากต้นไม้', () => setTool({ kind: 'desig', d: D_CHOP })),
        toolBtn('⛏️', 'ขุด', 'หิน และแร่เหล็ก', () => setTool({ kind: 'desig', d: D_MINE })),
        toolBtn('🧺', 'เก็บผลไม้ป่า', 'เก็บซ้ำได้เมื่อโต', () => setTool({ kind: 'desig', d: D_HARVEST })),
        toolBtn('🎯', 'ล่าสัตว์', 'ลากคลุมตัวสัตว์', () => setTool({ kind: 'desig', d: 'hunt' })),
        toolBtn('🗑️', 'รื้อถอน', 'ได้วัสดุคืน 75%', () => setTool({ kind: 'desig', d: 'decon' })),
        toolBtn('↩️', 'ยกเลิก', 'คำสั่ง/แปลน', () => setTool({ kind: 'desig', d: 'cancel' })),
      );
      b.append(g);
      b.append(h('p', { class: 'tip' }, '💡 คนที่เปิดงาน "ตัดไม้/ขุดหิน/ล่าสัตว์" ในเมนู งาน จะไปทำเอง'));
    },
  },
  build: {
    title: () => '🏗️ สร้าง',
    render(b) {
      const tabs = h('div', { class: 'tabs' });
      for (const c in BCATS) tabs.append(h('button', { class: BUILD_TAB === c ? 'on' : '', onclick: () => { BUILD_TAB = c; renderSheet(); } }, BCATS[c]));
      b.append(tabs);
      const g = h('div', { class: 'grid' });
      for (const k in BDEF) {
        const d = BDEF[k];
        if (d.cat !== BUILD_TAB) continue;
        const lock = d.res && !resDone(d.res) ? `ต้องวิจัย "${RESEARCH[d.res].name}" ก่อน` : null;
        const cost = Object.keys(d.cost).map(c => `${ITEMS[c].icon}${d.cost[c]}`).join(' ');
        const icon = bSpr(k) ? spriteImg(bSpr(k)) : h('span', { class: 'swatch ' + k });
        g.append(toolBtn(icon, d.name, lock ? '🔒 ' + RESEARCH[d.res].name : cost, () => setTool({ kind: 'build', type: k }), lock));
      }
      b.append(g);
      b.append(h('p', { class: 'tip' }, '💡 ล้อมกำแพงให้ครบทุกด้าน (มีประตู) จะกลายเป็นห้องมีหลังคา อุ่นกว่าข้างนอก กองไฟ/เตาผิงในห้องช่วยให้อุ่นในฤดูหนาว'));
    },
  },
  zone: {
    title: () => '🗺️ โซน',
    render(b) {
      const g = h('div', { class: 'grid' });
      g.append(toolBtn('📦', 'คลังเก็บของ', 'ทุกคนจะขนของมาเก็บ', () => setTool({ kind: 'zone', z: Z_STOCK })));
      for (let c = 1; c < CROPS.length; c++) {
        const cr = CROPS[c];
        const lock = cr.res && !resDone(cr.res) ? `ต้องวิจัย "${RESEARCH[cr.res].name}" ก่อน` : null;
        g.append(toolBtn('🌱', 'ปลูก' + cr.name, lock ? '🔒 ' + RESEARCH[cr.res].name : `${cr.days} วัน ได้${ITEMS[cr.item].icon}${cr.yield}`, () => setTool({ kind: 'zone', z: Z_FARM, crop: c }), lock));
      }
      g.append(toolBtn('🧽', 'ลบโซน', '', () => setTool({ kind: 'zone', z: 0 })));
      b.append(g);
      b.append(h('p', { class: 'tip' }, '💡 พืชโตเฉพาะตอนอุณหภูมิเกิน 3°C และจะตายถ้าหนาวต่ำกว่า -3°C ดินสีน้ำตาลเข้มโตเร็วกว่า 40% แปลงปลูกในห้องที่อุ่นจะปลูกได้แม้ฤดูหนาว'));
    },
  },
  work: {
    title: () => '👷 ตารางงาน',
    render(b) {
      b.append(h('p', { class: 'tip' }, 'แตะช่องเพื่อเปลี่ยน: 1 = ทำก่อน → 2 → 3 → ✕ ไม่ทำ  (ตัวเลข = ระดับทักษะ)'));
      const wrap = h('div', { class: 'tablewrap' });
      const t = h('table', { class: 'work' });
      const hr = h('tr', null, h('th', null, ''));
      for (const w of WORKS) hr.append(h('th', { title: w.name }, h('span', null, w.icon), h('small', null, w.name)));
      t.append(hr);
      for (const p of livePawns()) {
        const tr = h('tr', null, h('th', { class: 'pn' }, p.name, h('small', null, STAGE_NAME[lifeStage(p)])));
        for (const w of WORKS) {
          if (!canWork(p, w.id)) { tr.append(h('td', { class: 'na' }, '–')); continue; }
          const v = p.work[w.id];
          const lv = w.skill ? p.skills[w.skill].lv : '';
          const td = h('td', { class: 'p' + v, onclick: () => { p.work[w.id] = v === 0 ? 1 : v === 3 ? 0 : v + 1; renderSheet(); } },
            h('b', null, v ? v : '✕'), h('small', null, lv));
          tr.append(td);
        }
        t.append(tr);
      }
      wrap.append(t);
      b.append(wrap);
    },
  },
  research: {
    title: () => '🔬 วิจัย',
    render(b) {
      if (!hasBuilt('research')) b.append(h('p', { class: 'tip warn' }, '⚠️ ต้องสร้าง "โต๊ะวิจัย" (เมนู สร้าง > การผลิต) และมีคนเปิดงาน "วิจัย"'));
      const list = h('div', { class: 'rlist' });
      for (const id in RESEARCH) {
        const r = RESEARCH[id];
        const done = G.research.done[id];
        const reqOk = (r.req || []).every(x => G.research.done[x]);
        const cur = G.research.cur === id;
        const pr = (G.research.prog[id] || 0) / r.cost * 100;
        const el = h('button', {
          class: 'rcard' + (done ? ' done' : '') + (cur ? ' cur' : '') + (!reqOk ? ' locked' : ''), 'data-r': id,
          onclick: () => {
            if (done) return;
            if (!reqOk) { toast('ต้องวิจัย ' + r.req.map(x => RESEARCH[x].name).join(', ') + ' ก่อน', 'bad'); return; }
            G.research.cur = cur ? null : id; renderSheet();
          },
        },
          h('div', { class: 'rt' }, h('b', null, (done ? '✅ ' : cur ? '▶️ ' : !reqOk ? '🔒 ' : '') + r.name), h('small', null, done ? 'สำเร็จแล้ว' : `${Math.floor(G.research.prog[id] || 0)}/${r.cost}`)),
          h('p', null, r.desc + (r.req && !done ? ` (ต้องการ: ${r.req.map(x => RESEARCH[x].name).join(', ')})` : '')),
          done ? null : h('i', { class: 'pbar' }, h('b', { style: `width:${pr}%` })));
        list.append(el);
      }
      b.append(list);
    },
    live(b) {
      const id = G.research.cur;
      if (!id) return;
      const el = b.querySelector(`[data-r="${id}"]`);
      if (!el) return;
      el.querySelector('.pbar b').style.width = (G.research.prog[id] || 0) / RESEARCH[id].cost * 100 + '%';
      el.querySelector('.rt small').textContent = `${Math.floor(G.research.prog[id] || 0)}/${RESEARCH[id].cost}`;
    },
  },
  family: {
    title: () => `👪 ครอบครัว${G.surname} (${livePawns().length} คน)`,
    render(b) {
      const list = h('div', { class: 'flist' });
      for (const p of livePawns()) {
        list.append(h('button', { class: 'fcard', onclick: () => openSheet('pawn', p.id) },
          portrait(p, 44),
          h('div', { class: 'grow' }, h('b', null, `${p.name} ${p.gender === 'm' ? '♂' : '♀'}`),
            h('small', null, `${STAGE_NAME[lifeStage(p)]} ${Math.floor(ageYears(p))} ปี • รุ่นที่ ${p.gen}`),
            h('small', { class: 'muted' }, jobLabel(p))),
          h('span', { class: 'moodnum ' + moodCls(p.mood) }, Math.round(p.mood))));
      }
      b.append(list);
      const dead = G.pawns.filter(p => p.dead);
      if (dead.length) {
        b.append(h('h4', null, '🕯️ ผู้จากไป'));
        for (const p of dead) b.append(h('p', { class: 'small muted' }, `${p.name} — ${Math.floor(ageYears(p))} ปี, ${p.deathCause} (วันที่ ${p.deathDay})`));
      }
    },
  },
  pawn: {
    title: id => { const p = pawnById(id); return p ? `${p.name} ${p.surname}` : ''; },
    render(b, id) {
      const p = pawnById(id);
      if (!p || p.dead) { closeSheet(); return; }
      const st = lifeStage(p);
      b.append(h('div', { class: 'info-head' }, portrait(p, 56), h('div', { class: 'grow' },
        h('b', null, `${STAGE_NAME[st]} ${Math.floor(ageYears(p))} ปี ${p.gender === 'm' ? '(ชาย)' : '(หญิง)'} • รุ่นที่ ${p.gen}`),
        h('small', null, 'นิสัย: ' + p.traits.map(t => TRAITS[t].name).join(', ')),
        h('small', { class: 'muted' }, p.traits.map(t => TRAITS[t].desc).join(' • ')))));
      const eq = [];
      eq.push(`อาวุธ: ${p.weapon ? ITEMS[p.weapon].name : 'ไม่มี'}`, `เสื้อกันหนาว: ${p.coat ? 'มี' : 'ไม่มี'}`);
      const eqRow = h('div', { class: 'row' }, h('span', { class: 'small' }, eq.join(' • ')));
      if (p.weapon) eqRow.append(h('button', { class: 'btn sm', onclick: () => { dropItem(p.weapon, 1, Math.round(p.x), Math.round(p.y)); p.weapon = null; renderSheet(); } }, 'ถอดอาวุธ'));
      b.append(eqRow);
      const health = [];
      if (p.downed) health.push('🆘 หมดสติ');
      if (p.sick) health.push(`🤒 ป่วย (อาการ ${Math.round(p.sick.sev * 100)}% / ภูมิคุ้มกัน ${Math.round(p.sick.imm * 100)}%)`);
      if (p.tended > G.tick) health.push('🩹 ได้รับการรักษาแล้ว');
      if (p.pregnant) health.push(`🤰 ตั้งครรภ์ (คลอดใน ${Math.max(0, (p.pregnant.due - G.tick) / DAY).toFixed(1)} วัน)`);
      if (health.length) b.append(h('p', { class: 'small' }, health.join(' • ')));
      b.append(h('div', { class: 'bars', 'data-k': 'pbars' }));
      b.append(h('h4', null, 'ความรู้สึก'));
      b.append(h('div', { class: 'thoughts', 'data-k': 'th' }));
      b.append(h('h4', null, 'ทักษะ'));
      const sk = h('div', { class: 'skills' });
      for (const s in SKILLS) {
        const v = p.skills[s];
        sk.append(h('div', { class: 'sk' }, h('span', null, SKILLS[s]), h('i', null, h('b', { style: `width:${v.lv * 5}%` })), h('em', null, v.lv)));
      }
      b.append(sk);
      b.append(h('h4', null, 'ความสัมพันธ์'));
      const rel = h('div', { class: 'rels' });
      for (const o of livePawns()) {
        if (o === p) continue;
        const r = p.rel[o.id] || 0;
        rel.append(h('div', { class: 'small' }, `${o.name}: ${relationName(p, o)} `, h('span', { class: r >= 0 ? 'good' : 'bad' }, `(${r > 0 ? '+' : ''}${r})`)));
      }
      b.append(rel);
      if (p.partner && pawnById(p.partner) && !pawnById(p.partner).dead) {
        b.append(h('h4', null, 'วางแผนครอบครัว'));
        b.append(h('label', { class: 'toggle' }, h('input', { type: 'checkbox', id: 'plan' + p.id, ...(p.planBaby ? { checked: '' } : {}), onclick: e => { p.planBaby = e.target.checked; const q = pawnById(p.partner); if (q) q.planBaby = p.planBaby; } }), ' อยากมีลูก (ต้องนอนเตียงคู่ด้วยกัน)'));
      }
      SHEETS.pawn.live(b, id);
    },
    live(b, id) {
      const p = pawnById(id);
      if (!p || p.dead) return;
      const pb = b.querySelector('[data-k="pbars"]');
      if (pb) {
        pb.innerHTML = '';
        pb.append(bar('🍚 อิ่ม', p.food, p.food < 25 ? 'bad' : ''), bar('😴 พลัง', p.rest, p.rest < 25 ? 'bad' : ''),
          bar('😊 อารมณ์', p.mood, moodCls(p.mood)), bar('❤️ สุขภาพ', p.hp / p.maxHp * 100, 'good'));
        if (lifeStage(p) !== 'adult' && lifeStage(p) !== 'teen') pb.append(bar('🎈 สนุก', p.joy, ''));
        pb.append(h('div', { class: 'small muted' }, `🌡️ ${Math.round(p.temp || 0)}°C (สบายที่ ${comfortMin(p)}°C ขึ้นไป) • ${jobLabel(p)}`));
      }
      const th = b.querySelector('[data-k="th"]');
      if (th) {
        th.innerHTML = '';
        for (const [l, v] of p.thoughts.slice().sort((a, c) => c[1] - a[1])) th.append(h('span', { class: 'th ' + (v >= 0 ? 'good' : 'bad') }, `${l} ${v > 0 ? '+' : ''}${v}`));
      }
    },
  },
  station: {
    title: id => G.bld[id] ? '📜 ' + BDEF[G.bld[id].type].name : '',
    render(b, id) {
      const st = G.bld[id];
      if (!st) { closeSheet(); return; }
      b.append(h('p', { class: 'tip' }, 'ตั้งจำนวนที่ต้องการให้มีในคลัง คนจะผลิตจนกว่าจะครบ'));
      for (const bill of st.bills) {
        const r = RECIPES[bill.r];
        if (r.only && r.only !== st.type) continue;
        const lock = r.res && !resDone(r.res);
        const ing = r.ing.map(([c, n]) => `${c === 'raw' ? '🥬/🍖' : ITEMS[c].icon}${n}`).join(' + ');
        b.append(h('div', { class: 'bill' + (lock ? ' locked' : '') },
          spriteImg(iSpr(r.out)),
          h('div', { class: 'grow' }, h('b', null, r.name), h('small', null, lock ? `🔒 ต้องวิจัย ${RESEARCH[r.res].name}` : `${ing} • มีอยู่ ${G.counts[r.out] || 0}`)),
          lock ? null : h('div', { class: 'stepper' },
            h('button', { onclick: () => { bill.n = Math.max(0, bill.n - (bill.n > 10 ? 5 : 1)); renderSheet(); } }, '−'),
            h('b', null, bill.n),
            h('button', { onclick: () => { bill.n = Math.min(200, bill.n + (bill.n >= 10 ? 5 : 1)); renderSheet(); } }, '+'))));
      }
    },
  },
  stock: {
    title: () => '📦 ของในคลัง',
    render(b) {
      const g = h('div', { class: 'stock' });
      for (const k in ITEMS) {
        const n = G.counts[k] || 0;
        if (!n) continue;
        g.append(h('div', { class: 'si' }, spriteImg(iSpr(k)), h('span', null, ITEMS[k].name), h('b', null, U.fmt(n))));
      }
      b.append(g);
      b.append(h('p', { class: 'small muted' }, `อาหารรวม ≈ ${foodUnits()} หน่วย (คนละ ~5 หน่วย/วัน ถ้าปรุงสุก, ~9 ถ้ากินดิบ) • ความมั่งคั่ง ${U.fmt(wealth())}`));
      if (G.spoiledYesterday) b.append(h('p', { class: 'small bad' }, `เมื่อวานอาหารเน่าเสีย ${G.spoiledYesterday} หน่วย — เก็บในห้อง/บ่อน้ำแข็งจะเน่าช้าลง`));
    },
  },
  trade: {
    title: () => '🐫 พ่อค้าเร่',
    render(b) {
      if (!G.trader) { b.append(h('p', null, 'พ่อค้าออกเดินทางไปแล้ว')); return; }
      b.append(h('p', { class: 'tip' }, `เงินของคุณ: 🪙 ${G.counts.silver || 0} • พ่อค้าจะออกเดินทางใน ${Math.max(0, (G.trader.until - G.tick) / DAY * 24).toFixed(0)} ชม.`));
      b.append(h('h4', null, '🛒 ซื้อ'));
      for (const t in G.trader.stock) {
        const p = buyPrice(t);
        b.append(h('div', { class: 'bill' }, spriteImg(iSpr(t)), h('div', { class: 'grow' }, h('b', null, ITEMS[t].name), h('small', null, `มี ${G.trader.stock[t]} • 🪙${p}/ชิ้น`)),
          h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { tradeBuy(t, 1); renderSheet(); } }, 'ซื้อ 1'),
            ITEMS[t].stack > 5 ? h('button', { class: 'btn sm', onclick: () => { tradeBuy(t, 10); renderSheet(); } }, 'ซื้อ 10') : null)));
      }
      b.append(h('h4', null, '💰 ขาย'));
      for (const t in ITEMS) {
        if (t === 'silver' || !(G.counts[t] > 0)) continue;
        const p = sellPrice(t);
        b.append(h('div', { class: 'bill' }, spriteImg(iSpr(t)), h('div', { class: 'grow' }, h('b', null, ITEMS[t].name), h('small', null, `มี ${G.counts[t]} • 🪙${p}/ชิ้น`)),
          h('div', { class: 'row' }, h('button', { class: 'btn sm', onclick: () => { tradeSell(t, 1); renderSheet(); } }, 'ขาย 1'),
            ITEMS[t].stack > 5 ? h('button', { class: 'btn sm', onclick: () => { tradeSell(t, 10); renderSheet(); } }, 'ขาย 10') : null)));
      }
    },
  },
  log: {
    title: () => '📜 บันทึก & ความสำเร็จ',
    render(b) {
      b.append(h('h4', null, `🏆 ความสำเร็จ (แต้มมรดกสะสม ${LEGACY.points})`));
      const g = h('div', { class: 'achs' });
      for (const id in ACHIEVEMENTS) {
        const a = ACHIEVEMENTS[id];
        g.append(h('div', { class: 'ach' + (G.ach[id] ? ' got' : '') }, h('b', null, (G.ach[id] ? '🏆 ' : '🔒 ') + a.name), h('small', null, `${a.desc} (+${a.pts})`)));
      }
      b.append(g);
      b.append(h('h4', null, '📖 เหตุการณ์ล่าสุด'));
      for (const l of G.log.slice(0, 60)) b.append(h('p', { class: 'log ' + l.kind }, h('small', null, `วัน ${l.d} ${String(l.h).padStart(2, '0')}:00`), ' ' + l.msg));
    },
  },
  menu: {
    title: () => '☰ เมนู',
    render(b) {
      const g = h('div', { class: 'grid' });
      g.append(
        toolBtn('💾', 'บันทึกเกม', 'บันทึกอัตโนมัติทุกวัน', () => { saveGame(); toast('💾 บันทึกแล้ว', 'good'); }),
        toolBtn('📜', 'บันทึก', 'เหตุการณ์ & ความสำเร็จ', () => openSheet('log')),
        toolBtn('📦', 'คลัง', 'ของทั้งหมด', () => openSheet('stock')),
        toolBtn('❓', 'วิธีเล่น', '', () => showHelp()),
        toolBtn('📤', 'ส่งออกเซฟ', 'คัดลอกเป็นข้อความ', () => exportSave()),
        toolBtn('🏠', 'เมนูหลัก', 'บันทึกแล้วออก', () => { saveGame(); showMainMenu(); }),
      );
      b.append(g);
      b.append(h('h4', null, 'ตั้งค่า'));
      const opt = (key, label) => h('label', { class: 'toggle' }, h('input', { type: 'checkbox', id: 'opt_' + key, ...(G.settings[key] ? { checked: '' } : {}), onclick: e => { G.settings[key] = e.target.checked; } }), ' ' + label);
      b.append(h('div', { class: 'small' }, 'ความยาว 1 วันในเกม (ที่ความเร็ว ▶ ปกติ)'));
      b.append(dayLenPicker(DAY, t => { changeDayLen(t); toast(`⏱️ 1 วันในเกม = ${DAY_LENGTHS.find(d => d.ticks === t).min} นาที`, 'good'); renderSheet(); }));
      b.append(opt('peaceful', 'โหมดสงบ (ไม่มีโจร/สัตว์คลั่ง)'));
      b.append(h('label', { class: 'toggle' }, h('input', { type: 'checkbox', id: 'opt_quest', ...(G.settings.showQuest !== false ? { checked: '' } : {}), onclick: e => { G.settings.showQuest = e.target.checked; } }), ' แสดงเป้าหมายแนะนำ'));
      b.append(h('p', { class: 'small muted' }, `ครอบครัว${G.surname} • วันที่ ${dayNum()} • เกิด ${G.stats.born} • ขับไล่โจร ${G.stats.raidsWon} ครั้ง`));
    },
  },
};
function dayLenPicker(cur, onPick) {
  const row = h('div', { class: 'tabs daylen' });
  for (const d of DAY_LENGTHS) row.append(h('button', { class: d.ticks === cur ? 'on' : '', onclick: () => onPick(d.ticks) }, `${d.min} นาที`));
  return row;
}
function spriteImg(spr) {
  const c = mkCanvas(32, 32);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  x.drawImage(spr, 0, 0, 32, 32);
  c.className = 'spr';
  return c;
}

// ===== หน้าจอหลัก / เริ่มเกม =====
function showScreen(html) {
  const m = $('menu');
  m.hidden = false;
  m.innerHTML = '';
  m.append(html);
}
function hideScreen() { $('menu').hidden = true; }
function showMainMenu() {
  if (G) G.paused = true;
  let has = false;
  try { has = !!localStorage.getItem(SAVE_KEY); } catch (e) { }
  const box = h('div', { class: 'screen title' },
    h('div', { class: 'logo' }, h('img', { src: 'icon-192.png', alt: '', class: 'logo-img' }), h('small', null, 'FAMILY IN NOWHERE'), h('h1', null, 'ครอบครัวไร้ถิ่น'), h('p', null, 'พาครอบครัวเล็กๆ เอาชีวิตรอดกลางป่าลึก สร้างบ้าน เลี้ยงลูก สืบทอดตระกูล')),
    h('div', { class: 'menu-btns' },
      has ? h('button', { class: 'btn big primary', onclick: () => { if (loadGame()) startLoop(); } }, '▶ เล่นต่อ') : null,
      h('button', { class: 'btn big' + (has ? '' : ' primary'), onclick: () => showNewGame() }, '🌱 เริ่มเกมใหม่'),
      h('button', { class: 'btn big', onclick: () => showLegacy() }, `🏛️ มรดกตระกูล (${LEGACY.points} แต้ม)`),
      h('button', { class: 'btn big', onclick: () => showHelp(true) }, '❓ วิธีเล่น'),
      h('button', { class: 'btn big', onclick: () => importSave() }, '📥 นำเข้าเซฟ')),
    h('p', { class: 'small muted foot' }, LEGACY.best ? `สถิติอยู่รอดนานสุด ${LEGACY.best} วัน • เล่นมาแล้ว ${LEGACY.games} ครั้ง` : 'เล่นออฟไลน์ได้ • บันทึกอัตโนมัติในเครื่อง'));
  showScreen(box);
}
let NG = null;
function rollFamily() {
  const surname = U.pick(SURNAMES);
  const dadAge = U.ri(27, 36), momAge = U.clamp(dadAge + U.ri(-5, 2), 24, 38);
  NG = {
    surname, dayLen: NG ? NG.dayLen : 6000, peace: NG ? NG.peace : false,
    members: [
      { role: 'พ่อ', gender: 'm', age: dadAge, name: U.pick(NAMES_M), traits: randTraits(2), shirt: U.pick(SHIRT), skin: U.pick(SKIN), hair: U.pick(HAIR) },
      { role: 'แม่', gender: 'f', age: momAge, name: U.pick(NAMES_F), traits: randTraits(2), shirt: U.pick(SHIRT), skin: U.pick(SKIN), hair: U.pick(HAIR) },
      { role: 'ลูก', gender: U.chance(0.5) ? 'm' : 'f', age: U.ri(5, 7), name: U.pick(NAMES_KID), traits: randTraits(1), shirt: U.pick(SHIRT) },
    ],
  };
  const k = NG.members[2]; k.skin = U.chance(0.5) ? NG.members[0].skin : NG.members[1].skin; k.hair = U.chance(0.5) ? NG.members[0].hair : NG.members[1].hair;
  if (LEGACY.perks.twokids) {
    let nm; do { nm = U.pick(NAMES_KID); } while (nm === k.name);
    NG.members.push({ role: 'ลูก', gender: U.chance(0.5) ? 'm' : 'f', age: U.ri(2, 4), name: nm, traits: randTraits(1), shirt: U.pick(SHIRT), skin: k.skin, hair: NG.members[0].hair });
  }
}
function showNewGame() {
  if (!NG) rollFamily();
  const fam = h('div', { class: 'fam-preview' });
  for (const m of NG.members) {
    fam.append(h('div', { class: 'mcard' }, portrait({ kind: 'pawn', gender: m.gender, skin: m.skin, hair: m.hair, shirt: m.shirt }, 56),
      h('div', null, h('b', null, `${m.role}: ${m.name}`), h('small', null, `${m.age} ปี • ${m.traits.map(t => TRAITS[t].name).join(', ')}`))));
  }
  const perks = h('div', { class: 'perk-list' });
  const owned = Object.keys(PERKS).filter(k => LEGACY.perks[k]);
  if (owned.length) for (const k of owned) perks.append(h('span', { class: 'chip on' }, '✓ ' + PERKS[k].name));
  else perks.append(h('small', { class: 'muted' }, 'ยังไม่มีมรดกตระกูล — สะสมแต้มจากความสำเร็จเพื่อปลดล็อกโบนัสเริ่มเกม'));
  const box = h('div', { class: 'screen' },
    h('h2', null, `ครอบครัว${NG.surname}`),
    h('p', { class: 'muted' }, 'คุณได้รับครอบครัวเล็กๆ หลงทางมาอยู่ในดินแดนไร้นาม มีเสบียงติดตัวเพียงเล็กน้อย'),
    fam,
    h('h4', null, 'โบนัสมรดกที่ใช้'), perks,
    h('h4', null, 'ความยาว 1 วันในเกม'),
    dayLenPicker(NG.dayLen, t => { NG.dayLen = t; showNewGame(); }),
    h('label', { class: 'toggle' }, h('input', { type: 'checkbox', id: 'ngPeace', ...(NG.peace ? { checked: '' } : {}), onclick: e => { NG.peace = e.target.checked; } }), ' โหมดสงบ (ไม่มีโจรบุก เหมาะกับมือใหม่)'),
    h('div', { class: 'menu-btns row' },
      h('button', { class: 'btn', onclick: () => showMainMenu() }, '← กลับ'),
      h('button', { class: 'btn', onclick: () => { rollFamily(); showNewGame(); } }, '🎲 สุ่มครอบครัวใหม่'),
      h('button', { class: 'btn primary', onclick: () => { const pc = $('ngPeace').checked; newGame(NG, { peaceful: pc, dayLen: NG.dayLen }); NG = null; startLoop(); } }, '🌱 เริ่มชีวิตใหม่')));
  showScreen(box);
}
function showLegacy() {
  const list = h('div', { class: 'perk-shop' });
  for (const k in PERKS) {
    const p = PERKS[k];
    const own = LEGACY.perks[k];
    list.append(h('div', { class: 'bill' + (own ? ' got' : '') }, h('div', { class: 'grow' }, h('b', null, p.name), h('small', null, p.desc)),
      own ? h('span', { class: 'chip on' }, '✓ ได้แล้ว') : h('button', {
        class: 'btn sm' + (LEGACY.points >= p.cost ? ' primary' : ''), onclick: () => {
          if (LEGACY.points < p.cost) { toast('แต้มมรดกไม่พอ', 'bad'); return; }
          LEGACY.points -= p.cost; LEGACY.perks[k] = true; saveLegacy(); showLegacy();
        },
      }, `🏛️ ${p.cost}`)));
  }
  const box = h('div', { class: 'screen' },
    h('h2', null, '🏛️ มรดกตระกูล'),
    h('p', { class: 'muted' }, `แต้มมรดก: ${LEGACY.points} — ได้จากความสำเร็จในเกม และเมื่อตระกูลสิ้นสุด (ตามจำนวนวันที่รอด + ลูกที่เกิด) ใช้ซื้อโบนัสถาวรสำหรับเกมต่อๆ ไป`),
    list,
    h('div', { class: 'menu-btns' }, h('button', { class: 'btn', onclick: () => showMainMenu() }, '← กลับ')));
  showScreen(box);
}
function showHelp(fromMenu) {
  const box = h('div', { class: 'screen help' },
    h('h2', null, '❓ วิธีเล่น'),
    h('div', { html: `
<p><b>เป้าหมาย:</b> พาครอบครัวเอาชีวิตรอดให้นานที่สุด มีลูกหลานสืบตระกูล ตัวละครจะทำงานเองตามที่คุณสั่ง</p>
<h4>การควบคุม</h4>
<ul><li>ลาก 1 นิ้ว = เลื่อนแผนที่ • ถ่าง/หุบ 2 นิ้ว = ซูม</li>
<li>แตะตัวละคร/สิ่งของ = ดูข้อมูล • แตะรูปด้านบน = ไปหาคนนั้น</li>
<li>เลือกเครื่องมือ (สร้าง/สั่งงาน/โซน) แล้วลาก 1 นิ้วเพื่อวาง กด "เสร็จ" เมื่อเลิกใช้</li></ul>
<h4>เริ่มต้นอย่างไร</h4>
<ol><li>สร้าง <b>คลังเก็บของ</b> (โซน) ใกล้ๆ จุดเริ่มต้น</li>
<li>สั่ง <b>ตัดไม้</b> ให้ได้ไม้ แล้วสร้าง <b>กองไฟ</b> เพื่อทำอาหารปรุง (คุ้มกว่ากินดิบ 2 เท่า)</li>
<li>ทำ <b>แปลงปลูก</b> ข้าว/มันฝรั่ง และเก็บผลไม้ป่า</li>
<li>สร้าง <b>ห้อง</b> ด้วยกำแพง+ประตู ใส่เตียงคู่ให้พ่อแม่ เตียงเดี่ยวให้ลูก</li>
<li>ตุนอาหารก่อน <b>ฤดูหนาว</b> (วันที่ 19-24 ของทุกปี) พืชจะไม่โต ต้องมีเสื้อกันหนาวและห้องที่อุ่น</li></ol>
<h4>ครอบครัว</h4>
<ul><li>อายุ 7 ขวบ เด็กช่วยขนของและปลูกผักได้ • 13 ปีทำงานได้ทุกอย่าง • 18 ปีเป็นผู้ใหญ่</li>
<li>สามีภรรยาที่นอนเตียงคู่ด้วยกันและอารมณ์ดี มีโอกาสมีลูก (ปิดได้ในหน้าข้อมูล)</li>
<li>ทารกต้องมีคนป้อนอาหาร (งาน "ดูแลเด็ก") เด็กๆ ต้องมีคนเล่นด้วย</li>
<li>เมื่อลูกโต จะมีคนมาสู่ขอ หรือมีผู้เดินทางมาขออยู่ด้วย ตระกูลจะสืบต่อไปหลายรุ่น</li></ul>
<h4>อันตราย</h4>
<ul><li>โจรบุก: กด "เกณฑ์" แล้วแตะโจรเพื่อโจมตี ทำอาวุธ (ธนู/หอก) ที่โต๊ะช่าง</li>
<li>อารมณ์ต่ำ → ตัวละครสติแตกไม่ทำงาน ดูแลเรื่องอาหาร ที่นอน และความอบอุ่น</li>
<li>ป่วย/บาดเจ็บ: ต้องมีคนทำงาน "รักษา" ยาสมุนไพรช่วยให้หายเร็ว</li></ul>
<p class="muted small">ความเร็ว: ⏸ หยุด, ▶ ปกติ, ▶▶ x2, ⏩ x4 • บนคอมใช้ปุ่ม Space/1/2/3 และล้อเมาส์</p>` }),
    h('div', { class: 'menu-btns' }, h('button', { class: 'btn primary', onclick: () => fromMenu ? showMainMenu() : hideScreen() }, fromMenu ? '← กลับ' : 'เข้าใจแล้ว')));
  showScreen(box);
}
function showGameOver(days, pts) {
  const box = h('div', { class: 'screen' },
    h('h2', null, '🕯️ สิ้นสุดตระกูล'),
    h('p', null, `ครอบครัว${G.surname}อยู่รอดในดินแดนไร้นามได้ ${days} วัน`),
    h('p', { class: 'muted' }, `ลูกหลานที่เกิด ${G.stats.born} คน • ขับไล่โจร ${G.stats.raidsWon} ครั้ง • ความสำเร็จ ${Object.keys(G.ach).length} อย่าง`),
    h('p', null, `🏛️ ได้รับแต้มมรดก +${pts}`),
    h('div', { class: 'menu-btns' }, h('button', { class: 'btn primary', onclick: () => showMainMenu() }, 'กลับเมนูหลัก')));
  showScreen(box);
}
function exportSave() {
  saveGame();
  let s = '';
  try { s = localStorage.getItem(SAVE_KEY) || ''; } catch (e) { }
  const ta = h('textarea', { id: 'exportBox', readonly: '' }, s);
  const box = h('div', { class: 'screen' }, h('h2', null, '📤 ส่งออกเซฟ'),
    h('p', { class: 'muted' }, 'คัดลอกข้อความนี้เก็บไว้ แล้วนำไป "นำเข้าเซฟ" ในเครื่องอื่นได้'), ta,
    h('div', { class: 'menu-btns row' },
      h('button', { class: 'btn primary', onclick: () => { ta.select(); try { navigator.clipboard.writeText(s).then(() => toast('คัดลอกแล้ว', 'good'), () => toast('กดค้างที่ข้อความเพื่อคัดลอก', '')); } catch (e) { toast('กดค้างที่ข้อความเพื่อคัดลอก', ''); } } }, '📋 คัดลอก'),
      h('button', { class: 'btn', onclick: () => { hideScreen(); } }, 'ปิด')));
  showScreen(box);
}
function importSave() {
  const ta = h('textarea', { id: 'importBox', placeholder: 'วางข้อความเซฟที่นี่' });
  const box = h('div', { class: 'screen' }, h('h2', null, '📥 นำเข้าเซฟ'), ta,
    h('div', { class: 'menu-btns row' },
      h('button', { class: 'btn', onclick: () => showMainMenu() }, '← กลับ'),
      h('button', { class: 'btn primary', onclick: () => { if (loadGame(ta.value.trim())) startLoop(); else toast('ข้อความเซฟไม่ถูกต้อง', 'bad'); } }, 'โหลด')));
  showScreen(box);
}

function initUI() {
  for (const b of document.querySelectorAll('#speed button[data-sp]')) b.addEventListener('click', () => setSpeed(+b.dataset.sp));
  for (const b of document.querySelectorAll('#bar button')) b.addEventListener('click', () => openSheet(b.dataset.s));
  $('sheetClose').addEventListener('click', closeSheet);
  $('hintDone').addEventListener('click', () => setTool(null));
  $('bTrader').addEventListener('click', () => openSheet('trade'));
  $('quest').addEventListener('click', () => openSheet('log'));
}
function uiTick() {
  if (!G) return;
  updateTop();
  updateFamily();
  updateInfo();
  liveSheet();
  if (UI.dirty.research && UI.sheet === 'research') renderSheet();
  if (UI.dirty.log && UI.sheet === 'log') renderSheet();
  UI.dirty = {};
}
