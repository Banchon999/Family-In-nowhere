'use strict';
// ===== สไปรท์ pixel art 16x16 =====
const SPR = {};
function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function sprFromRows(rows, pal) {
  const c = mkCanvas(PX, PX), x = c.getContext('2d');
  for (let r = 0; r < rows.length; r++) for (let k = 0; k < rows[r].length; k++) {
    const ch = rows[r][k];
    if (ch === '.' || !pal[ch]) continue;
    x.fillStyle = pal[ch]; x.fillRect(k, r, 1, 1);
  }
  return c;
}
function sprDraw(fn) { const c = mkCanvas(PX, PX), x = c.getContext('2d'); fn(x, (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); }); return c; }

const ROWS = {
  man: [
    '................', '.....HHHHHH.....', '....HHHHHHHH....', '....HSSSSSSH....',
    '....SSESSESS....', '....SSSSSSSS....', '.....SSSSSS.....', '......SSSS......',
    '....CCCCCCCC....', '...CCCCCCCCCC...', '...SCCCCCCCCS...', '...SCCCCCCCCS...',
    '....PPPPPPPP....', '....PPP..PPP....', '....PPP..PPP....', '....BBB..BBB....'],
  woman: [
    '................', '.....HHHHHH.....', '....HHHHHHHH....', '...HHSSSSSSHH...',
    '...HSSESSESSH...', '...HSSSSSSSSH...', '...HHSSSSSSHH...', '...HH.SSSS.HH...',
    '....CCCCCCCC....', '...CCCCCCCCCC...', '...SCCCCCCCCS...', '...SCCCCCCCCS...',
    '...CCCCCCCCCC...', '...CCCCCCCCCC...', '....SS....SS....', '....BB....BB....'],
  rabbit: [
    '................', '................', '................', '................',
    '................', '...........WW...', '...........WW...', '..........WWW...',
    '.........BBBBB..', '.........BBEBBN.', '...BBBBBBBBBBB..', '..WBBBBBBBBBB...',
    '...BBBBBBBBBB...', '....BB....BB....', '................', '................'],
  deer: [
    '..........A.A...', '..........AAA...', '...........A....', '..........BBB...',
    '..........BEBB..', '..........BBBBN.', '..........BB....', '..BBBBBBBBBB....',
    '.WBBBBBBBBBB....', '..BBLLLLLLBB....', '..BBBBBBBBBB....', '..B.B....B.B....',
    '..B.B....B.B....', '..B.B....B.B....', '..D.D....D.D....', '................'],
  boar: [
    '................', '................', '................', '................',
    '................', '....H.H.H.......', '..BBBBBBBBBB....', '.BBBBBBBBBBBBB..',
    '.BBBBBBBBBBEBBB.', '.BBBBBBBBBBBBBNN', '.BBBBBBBBBBBBTT.', '..BBBBBBBBBBB...',
    '..BB.BB..BB.BB..', '..BB.BB..BB.BB..', '................', '................'],
  wolf: [
    '................', '................', '................', '................',
    '...........B.B..', '..........BBBB..', '..........BEBBB.', '..........BBBBNN',
    'T.BBBBBBBBBBB...', 'TTBBBBBBBBBBB...', '.TBBBBBBBBBB....', '..BLLLLLLLLB....',
    '..B.B....B.B....', '..B.B....B.B....', '..D.D....D.D....', '................'],
  tree: [
    '......GGGG......', '....GGGGGGGG....', '...GGGLGGGGGG...', '..GGLLGGGGGDGG..',
    '..GGGGGGGGDDGG..', '.GGGGLGGGGGDGGG.', '.GGGGGGGGGDDDGG.', '.GDGGGGGGGGDDGG.',
    '..GDDGGGGDDDDG..', '..GGDDDDDDDDGG..', '...GGDDDDDDGG...', '.....DDTTDD.....',
    '.......TT.......', '.......TT.......', '......TTTT......', '................'],
  bush: [
    '................', '................', '................', '................',
    '................', '................', '......GGGG......', '....GGGLGGGG....',
    '...GGRGGGGRGG...', '..GGGGGGRGGGGG..', '..GRGGLGGGGRGG..', '..GGGGGGGGGGGG..',
    '...GGRGGGGGGG...', '....GGGGGRGG....', '......DDDD......', '................'],
};
const ANIM_PAL = {
  rabbit: { B: '#b89a76', W: '#efe4d2', E: '#1a1a1a', N: '#e89aa8' },
  deer: { B: '#9a6a3c', W: '#efe4d2', E: '#1a1a1a', N: '#2a1d14', A: '#d8c4a0', L: '#d9b88a', D: '#2a1d14' },
  boar: { B: '#5a4436', H: '#2e2420', E: '#e8c040', N: '#c98a7a', T: '#f4efe0' },
  wolf: { B: '#7d8288', L: '#c4c8cc', E: '#e8c040', N: '#1f1f1f', T: '#7d8288', D: '#3a3a3a' },
};
const TREE_PAL = [
  { G: '#4f8f3a', L: '#76b84f', D: '#356b2a', T: '#6b4a2b' },
  { G: '#3c7c2c', L: '#5ea33f', D: '#285a1f', T: '#6b4a2b' },
  { G: '#c7742a', L: '#e8a83f', D: '#97481c', T: '#6b4a2b' },
  { G: '#5f7c6c', L: '#eef4f6', D: '#405848', T: '#5a3f26' },
];
function treeSpr(season) { const k = 'tree' + season; return SPR[k] || (SPR[k] = sprFromRows(ROWS.tree, TREE_PAL[season])); }
function bushSpr(season, ripe) {
  const k = 'bush' + season + (ripe ? 'r' : '');
  if (SPR[k]) return SPR[k];
  const w = season === 3;
  const pal = { G: w ? '#7a6a4a' : '#4d8a36', L: w ? '#e8eef0' : '#6aab48', D: '#5a3d22', R: ripe ? '#d6334a' : (w ? '#7a6a4a' : '#4d8a36') };
  return SPR[k] = sprFromRows(ROWS.bush, pal);
}
function animalSpr(type) { return SPR['a' + type] || (SPR['a' + type] = sprFromRows(ROWS[type], ANIM_PAL[type])); }
function pawnSpr(c) {
  const coatCol = '#8a6a48';
  const shirt = c.kind === 'raider' ? '#6d2620' : c.coat ? coatCol : c.shirt;
  const hair = c.kind === 'raider' ? '#1b1b1b' : c.hair;
  const skin = c.skin || '#c68b59';
  const g = c.gender === 'f' ? 'woman' : 'man';
  const k = `p${g}${skin}${hair}${shirt}${c.kind}`;
  if (SPR[k]) return SPR[k];
  const s = sprFromRows(ROWS[g], { H: hair, S: skin, E: '#1a1a1a', C: shirt, P: c.kind === 'raider' ? '#2a2420' : '#3b3a4a', B: '#2a1f17' });
  const x = s.getContext('2d');
  if (c.kind === 'raider') { x.fillStyle = '#2a1a18'; x.fillRect(4, 5, 8, 2); }
  if (c.coat && c.kind !== 'raider') { x.fillStyle = '#e8dcc0'; x.fillRect(4, 8, 8, 1); }
  return SPR[k] = s;
}

// สิ่งก่อสร้าง
const BSPR_FN = {
  bed: (c, R) => { R(3, 1, 10, 14, '#7a5232'); R(4, 2, 8, 3, '#f0ead8'); R(4, 5, 8, 9, '#4a78b8'); R(4, 5, 8, 1, '#6d97d0'); },
  dbed: (c, R) => { R(1, 1, 14, 14, '#7a5232'); R(2, 2, 5, 3, '#f0ead8'); R(9, 2, 5, 3, '#f0ead8'); R(2, 5, 12, 9, '#b8505a'); R(2, 5, 12, 1, '#d77a82'); },
  crib: (c, R) => { R(3, 4, 10, 10, '#a57a4a'); R(4, 5, 8, 8, '#f3d9e6'); for (let k = 4; k < 12; k += 2) R(k, 4, 1, 10, '#c89a64'); R(5, 6, 3, 2, '#fff'); },
  table: (c, R) => { R(3, 11, 1, 4, '#5e3c20'); R(12, 11, 1, 4, '#5e3c20'); R(2, 4, 12, 8, '#8a5a32'); R(2, 4, 12, 2, '#a8743f'); R(6, 6, 4, 3, '#e8e0d0'); },
  plantpot: (c, R) => { R(5, 10, 6, 5, '#b5603a'); R(5, 10, 6, 1, '#d17a50'); R(4, 5, 8, 5, '#4f9a3c'); R(6, 3, 4, 3, '#5fae48'); R(5, 4, 2, 2, '#e85a8a'); R(9, 6, 2, 2, '#f2c94c'); R(7, 2, 2, 2, '#e85a8a'); },
  toybox: (c, R) => { R(3, 7, 10, 8, '#c0392b'); R(3, 6, 10, 2, '#e67e22'); R(6, 2, 4, 4, '#3498db'); R(7, 3, 1, 1, '#fff'); R(11, 4, 3, 3, '#f1c40f'); },
  blackboard: (c, R) => { R(1, 2, 14, 10, '#6b4a2b'); R(2, 3, 12, 8, '#2d4a3a'); R(3, 5, 5, 1, '#e8e8e0'); R(3, 7, 8, 1, '#e8e8e0'); R(9, 5, 3, 1, '#e8e8e0'); R(3, 12, 1, 3, '#6b4a2b'); R(12, 12, 1, 3, '#6b4a2b'); },
  statue: (c, R) => { R(3, 12, 10, 3, '#7c7670'); R(6, 4, 4, 8, '#b8b2aa'); R(6, 1, 4, 3, '#c8c2ba'); R(4, 5, 2, 4, '#b8b2aa'); R(10, 5, 2, 4, '#b8b2aa'); R(7, 2, 1, 1, '#8a847c'); },
  campfire: (c, R) => { for (const [a, b] of [[3, 10], [6, 12], [10, 12], [12, 9], [4, 7], [11, 6]]) R(a, b, 2, 2, '#8a847c'); R(4, 10, 8, 2, '#6b4a2b'); R(6, 8, 4, 2, '#5a3a20'); },
  torch: (c, R) => { R(7, 6, 2, 9, '#6b4a2b'); R(6, 5, 4, 2, '#4a3a2a'); },
  workbench: (c, R) => { R(1, 5, 14, 7, '#8a5a32'); R(1, 5, 14, 2, '#a8743f'); R(2, 12, 2, 3, '#5e3c20'); R(12, 12, 2, 3, '#5e3c20'); R(3, 3, 5, 2, '#9aa2aa'); R(9, 2, 1, 4, '#6b4a2b'); R(9, 2, 3, 1, '#9aa2aa'); },
  research: (c, R) => { R(1, 6, 14, 6, '#7a5232'); R(1, 6, 14, 1, '#9a6a3f'); R(2, 12, 2, 3, '#5e3c20'); R(12, 12, 2, 3, '#5e3c20'); R(3, 3, 5, 4, '#c94f4f'); R(4, 3, 1, 4, '#8a2f2f'); R(9, 4, 4, 3, '#f0ead8'); R(13, 2, 1, 3, '#f0ead8'); R(13, 1, 1, 1, '#f2c94c'); },
  stove: (c, R) => { R(2, 3, 12, 12, '#6f6a66'); R(2, 3, 12, 3, '#4a4642'); R(4, 4, 3, 1, '#2a2622'); R(9, 4, 3, 1, '#2a2622'); R(5, 9, 6, 4, '#3a2016'); R(11, 0, 2, 3, '#5a5652'); },
  fireplace: (c, R) => { R(1, 2, 14, 13, '#8a7f75'); for (let k = 0; k < 4; k++) R(1, 3 + k * 3, 14, 1, '#756b62'); R(4, 7, 8, 8, '#2a1d14'); R(0, 2, 16, 2, '#9a8f85'); },
  cooler: (c, R) => { R(2, 3, 12, 12, '#7d96a4'); R(2, 3, 12, 3, '#cfe3ee'); R(4, 8, 3, 3, '#e8f4fa'); R(8, 9, 3, 3, '#e8f4fa'); R(6, 11, 3, 3, '#d4eaf5'); },
  coop: (c, R) => { R(2, 7, 12, 8, '#9a6b3c'); for (let k = 0; k < 6; k++) R(2 + k, 7 - k / 1.2 | 0, 12 - k * 2, 1, '#b5452f'); R(7, 10, 3, 5, '#3a2618'); R(11, 12, 3, 2, '#f4f1ea'); R(13, 11, 1, 1, '#d6334a'); },
  barricade: (c, R) => { R(1, 9, 14, 4, '#7a5232'); for (let k = 1; k < 15; k += 3) { R(k, 5, 2, 9, '#8a6238'); R(k, 4, 2, 1, '#a8743f'); } },
};
function bSpr(type) {
  const k = 'b' + type;
  if (SPR[k]) return SPR[k];
  const fn = BSPR_FN[type];
  return SPR[k] = fn ? sprDraw(fn) : null;
}
// ไอคอนสิ่งของ
const ISPR_FN = {
  wood: (c, R) => { R(2, 9, 12, 3, '#8a5a32'); R(3, 6, 11, 3, '#9a6a3c'); R(2, 9, 2, 3, '#d8b080'); R(3, 6, 2, 3, '#d8b080'); R(4, 12, 10, 2, '#7a4a28'); R(4, 12, 2, 2, '#c8a070'); },
  stone: (c, R) => { R(3, 8, 6, 5, '#8a847c'); R(7, 10, 6, 4, '#9e978e'); R(5, 6, 4, 3, '#a8a198'); R(3, 8, 2, 1, '#bdb6ac'); },
  iron: (c, R) => { R(2, 10, 10, 3, '#5b6670'); R(4, 7, 10, 3, '#6e7a85'); R(4, 7, 10, 1, '#9aa6b0'); R(2, 10, 10, 1, '#8a96a0'); },
  silver: (c, R) => { R(4, 9, 6, 4, '#c9a63c'); R(7, 7, 6, 4, '#e8c85a'); R(8, 8, 3, 1, '#fff2b0'); },
  veg: (c, R) => { R(4, 8, 8, 6, '#4f9a3c'); R(5, 7, 6, 2, '#6fbf50'); R(9, 9, 4, 2, '#e8862a'); R(10, 11, 3, 2, '#e8862a'); R(6, 10, 2, 2, '#d6334a'); },
  meat: (c, R) => { R(3, 8, 9, 6, '#b8443a'); R(4, 9, 6, 3, '#d65a4a'); R(11, 7, 3, 2, '#f4efe0'); R(13, 6, 2, 2, '#f4efe0'); },
  meal: (c, R) => { R(3, 10, 10, 4, '#c8a070'); R(2, 9, 12, 2, '#d8b888'); R(4, 7, 8, 3, '#e8862a'); R(6, 6, 3, 2, '#5fae48'); },
  finemeal: (c, R) => { R(2, 8, 12, 7, '#2a1d14'); R(3, 9, 5, 5, '#f4efe0'); R(9, 9, 4, 2, '#e8862a'); R(9, 12, 4, 2, '#5fae48'); R(2, 8, 12, 1, '#c0392b'); },
  medicine: (c, R) => { R(6, 4, 4, 9, '#3f8f4a'); R(4, 5, 3, 4, '#5fc27a'); R(9, 6, 3, 4, '#5fc27a'); R(5, 10, 6, 1, '#f4efe0'); },
  hide: (c, R) => { R(3, 6, 10, 8, '#8a5a32'); R(2, 7, 1, 6, '#8a5a32'); R(13, 7, 1, 6, '#8a5a32'); R(5, 8, 4, 2, '#a8743f'); },
  cotton: (c, R) => { R(3, 8, 4, 4, '#f4f1ea'); R(7, 6, 5, 5, '#ffffff'); R(9, 10, 4, 4, '#e8e4dc'); },
  coat: (c, R) => { R(4, 4, 8, 10, '#8a6a48'); R(2, 5, 2, 7, '#8a6a48'); R(12, 5, 2, 7, '#8a6a48'); R(4, 4, 8, 2, '#e8dcc0'); R(7, 6, 1, 8, '#5e4630'); },
  club: (c, R) => { R(3, 12, 2, 2, '#6b4a2b'); R(5, 9, 2, 3, '#7a5232'); R(7, 5, 4, 5, '#8a5a32'); },
  spear: (c, R) => { for (let k = 0; k < 10; k++) R(3 + k, 13 - k, 1, 1, '#8a5a32'); R(12, 2, 2, 2, '#b8c0c8'); R(13, 1, 1, 1, '#e8f0f8'); },
  bow: (c, R) => { for (let k = 0; k < 11; k++) R(4 + Math.round(Math.sin(k / 10 * Math.PI) * 4), 2 + k, 1, 1, '#8a5a32'); R(4, 2, 1, 11, '#e8e0d0'); },
  sword: (c, R) => { for (let k = 0; k < 8; k++) R(5 + k, 10 - k, 1, 1, '#c8d0d8'); R(3, 10, 4, 1, '#c9a63c'); R(3, 12, 2, 2, '#6b4a2b'); },
  crossbow: (c, R) => { R(3, 7, 10, 2, '#7a5232'); for (let k = 0; k < 9; k++) R(11 + Math.round(Math.sin(k / 8 * Math.PI) * 2), 3 + k, 1, 1, '#5b6670'); R(4, 9, 2, 4, '#6b4a2b'); },
};
function iSpr(t) { const k = 'i' + t; return SPR[k] || (SPR[k] = sprDraw(ISPR_FN[t] || ((c, R) => R(4, 4, 8, 8, '#ccc')))); }
