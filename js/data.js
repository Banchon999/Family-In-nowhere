'use strict';
// ===== ค่าคงที่หลักของเกม =====
const TILE = 32;            // พิกเซลต่อช่องที่ zoom 1
const PX = 16;              // ความละเอียดสไปรท์ (pixel art)
const MAP_W = 64, MAP_H = 64, NT = MAP_W * MAP_H;
const TPS = 20;             // tick ต่อวินาทีที่ความเร็ว 1x
// ความยาววันปรับได้ในเมนู (ค่า tick ต่อวัน) — อัตราต่างๆ ที่คิดเป็นต่อวันคูณด้วย DS
const BASE_DAY = 2400;      // 2 นาทีจริงที่ 1x
let DAY = 6000, HOUR = DAY / 24, DS = BASE_DAY / DAY;
const DAY_LENGTHS = [{ min: 3, ticks: 3600 }, { min: 5, ticks: 6000 }, { min: 8, ticks: 9600 }, { min: 12, ticks: 14400 }];
function setDayLen(ticks) { DAY = ticks; HOUR = DAY / 24; DS = BASE_DAY / DAY; }
const SEASON_DAYS = 6, YEAR_DAYS = 24;
const SAVE_KEY = 'fin_save_v1', LEGACY_KEY = 'fin_legacy_v1';

const SEASONS = [
  { name: 'ใบไม้ผลิ', icon: '🌱', temp: 17 },
  { name: 'ฤดูร้อน', icon: '☀️', temp: 28 },
  { name: 'ใบไม้ร่วง', icon: '🍂', temp: 11 },
  { name: 'ฤดูหนาว', icon: '❄️', temp: -9 },
];

// พื้นดิน
const T_GRASS = 0, T_SOIL = 1, T_SAND = 2, T_SHALLOW = 3, T_WATER = 4, T_RFLOOR = 5;
const TER = [
  { name: 'หญ้า', fert: 1.0, cost: 1 },
  { name: 'ดินอุดมสมบูรณ์', fert: 1.4, cost: 1 },
  { name: 'ทราย', fert: 0.5, cost: 1.3 },
  { name: 'น้ำตื้น', fert: 0, cost: 2.4 },
  { name: 'น้ำลึก', fert: 0, cost: 999 },
  { name: 'พื้นหิน', fert: 0, cost: 1 },
];
// สิ่งที่อยู่บนพื้น (ธรรมชาติ/พืช)
const N_NONE = 0, N_TREE = 1, N_ROCK = 2, N_ORE = 3, N_BUSH = 4, N_CROP = 5;
// คำสั่งงาน
const D_NONE = 0, D_CHOP = 1, D_MINE = 2, D_HARVEST = 3;
// โซน
const Z_NONE = 0, Z_STOCK = 1, Z_FARM = 2;

const ITEMS = {
  wood: { name: 'ไม้', icon: '🪵', stack: 75, val: 1 },
  stone: { name: 'หิน', icon: '🪨', stack: 75, val: 1 },
  iron: { name: 'เหล็ก', icon: '🔩', stack: 75, val: 4 },
  silver: { name: 'เงิน', icon: '🪙', stack: 500, val: 1 },
  veg: { name: 'ผักผลไม้', icon: '🥬', stack: 75, val: 1.5, food: 7, raw: 1, perish: 1 },
  meat: { name: 'เนื้อ/ไข่', icon: '🍖', stack: 75, val: 1.5, food: 7, raw: 1, perish: 1.3 },
  meal: { name: 'อาหารปรุง', icon: '🍲', stack: 20, val: 7, food: 60, perish: 0.7 },
  finemeal: { name: 'อาหารชั้นดี', icon: '🍱', stack: 20, val: 14, food: 70, perish: 0.7 },
  medicine: { name: 'ยาสมุนไพร', icon: '🌿', stack: 25, val: 18 },
  hide: { name: 'หนังสัตว์', icon: '🟫', stack: 75, val: 3 },
  cotton: { name: 'ฝ้าย', icon: '☁️', stack: 75, val: 2 },
  coat: { name: 'เสื้อกันหนาว', icon: '🧥', stack: 5, val: 60, equip: 'coat' },
  club: { name: 'กระบอง', icon: '🏏', stack: 5, val: 15, equip: 'weapon' },
  spear: { name: 'หอก', icon: '🔱', stack: 5, val: 40, equip: 'weapon' },
  bow: { name: 'ธนู', icon: '🏹', stack: 5, val: 60, equip: 'weapon' },
  sword: { name: 'ดาบเหล็ก', icon: '🗡️', stack: 5, val: 120, equip: 'weapon' },
  crossbow: { name: 'หน้าไม้', icon: '🎯', stack: 5, val: 150, equip: 'weapon' },
};
const FOOD_PREF = ['finemeal', 'meal', 'veg', 'meat'];

const WEAPONS = {
  fist: { name: 'มือเปล่า', dmg: 4, cd: 32, range: 1.5 },
  club: { name: 'กระบอง', dmg: 8, cd: 38, range: 1.5 },
  spear: { name: 'หอก', dmg: 11, cd: 40, range: 1.6 },
  sword: { name: 'ดาบเหล็ก', dmg: 16, cd: 40, range: 1.6 },
  bow: { name: 'ธนู', dmg: 9, cd: 55, range: 8, ranged: 1 },
  crossbow: { name: 'หน้าไม้', dmg: 15, cd: 70, range: 10, ranged: 1 },
};

const BCATS = { struct: 'โครงสร้าง', furn: 'เฟอร์นิเจอร์', prod: 'การผลิต' };
const BDEF = {
  wall_wood: { name: 'กำแพงไม้', cat: 'struct', cost: { wood: 5 }, work: 70, hp: 150, solid: 1, wall: 1, desc: 'ล้อมให้ครบเป็นห้อง จะมีหลังคาและอุ่นขึ้น' },
  wall_stone: { name: 'กำแพงหิน', cat: 'struct', cost: { stone: 5 }, work: 130, hp: 400, solid: 1, wall: 1, res: 'masonry', desc: 'แข็งแรงกว่ากำแพงไม้มาก' },
  door: { name: 'ประตู', cat: 'struct', cost: { wood: 10 }, work: 90, hp: 120, wall: 1, door: 1, desc: 'คนในบ้านเดินผ่านได้ ศัตรูต้องพังเข้ามา' },
  floor_wood: { name: 'พื้นไม้', cat: 'struct', cost: { wood: 2 }, work: 25, floor: 1, beauty: 1, desc: 'เดินเร็วขึ้น ห้องสวยขึ้น' },
  floor_stone: { name: 'พื้นหิน', cat: 'struct', cost: { stone: 2 }, work: 35, floor: 2, beauty: 2, res: 'masonry', desc: 'สวยกว่าพื้นไม้' },
  barricade: { name: 'รั้วกำบัง', cat: 'struct', cost: { wood: 10 }, work: 60, hp: 100, solid: 1, cover: 1, res: 'defense', desc: 'ยืนหลังรั้วแล้วโดนยิงยากขึ้นมาก' },
  bed: { name: 'เตียงเดี่ยว', cat: 'furn', cost: { wood: 25 }, work: 150, hp: 80, bed: 1, desc: 'นอนหลับสบาย พักฟื้นเร็ว' },
  dbed: { name: 'เตียงคู่', cat: 'furn', cost: { wood: 40 }, work: 220, hp: 100, bed: 2, desc: 'สามีภรรยานอนด้วยกัน มีลูกได้' },
  crib: { name: 'เปลเด็ก', cat: 'furn', cost: { wood: 15 }, work: 100, hp: 60, crib: 1, desc: 'ที่นอนของทารก' },
  table: { name: 'โต๊ะกินข้าว', cat: 'furn', cost: { wood: 20 }, work: 120, hp: 80, table: 1, beauty: 1, desc: 'กินข้าวที่โต๊ะ อารมณ์ดีขึ้น' },
  plantpot: { name: 'กระถางดอกไม้', cat: 'furn', cost: { wood: 8 }, work: 40, hp: 40, beauty: 3, solid: 1, desc: 'ตกแต่งห้องให้สวย' },
  toybox: { name: 'กล่องของเล่น', cat: 'furn', cost: { wood: 25 }, work: 120, hp: 60, toy: 1, solid: 1, res: 'childcare', desc: 'เด็กๆ มาเล่นเองได้' },
  blackboard: { name: 'กระดานสอนหนังสือ', cat: 'furn', cost: { wood: 30 }, work: 150, hp: 60, teach: 1, solid: 1, res: 'education', desc: 'พ่อแม่สอนทักษะให้ลูก' },
  statue: { name: 'รูปปั้น', cat: 'furn', cost: { stone: 50 }, work: 400, hp: 200, beauty: 10, solid: 1, res: 'art', desc: 'ทำให้ห้องสวยมาก' },
  campfire: { name: 'กองไฟ', cat: 'prod', cost: { wood: 20 }, work: 60, hp: 60, solid: 1, heat: 10, light: 5, station: 'cook', desc: 'ทำอาหาร ให้ความอบอุ่นและแสงสว่าง' },
  torch: { name: 'คบเพลิง', cat: 'prod', cost: { wood: 6 }, work: 30, hp: 30, heat: 2, light: 4, desc: 'แสงสว่างตอนกลางคืน' },
  workbench: { name: 'โต๊ะช่าง', cat: 'prod', cost: { wood: 50 }, work: 250, hp: 120, solid: 1, station: 'craft', desc: 'ทำอาวุธ เสื้อกันหนาว' },
  research: { name: 'โต๊ะวิจัย', cat: 'prod', cost: { wood: 45 }, work: 250, hp: 100, solid: 1, station: 'research', desc: 'คิดค้นเทคโนโลยีใหม่' },
  stove: { name: 'เตาหุงต้ม', cat: 'prod', cost: { stone: 30, iron: 10 }, work: 250, hp: 150, solid: 1, heat: 5, light: 2, station: 'cook', res: 'stove', desc: 'ทำอาหารเร็วขึ้น ทำอาหารชั้นดีได้' },
  fireplace: { name: 'เตาผิง', cat: 'prod', cost: { stone: 40 }, work: 250, hp: 200, solid: 1, heat: 18, light: 4, res: 'masonry', desc: 'ทำให้ห้องอุ่นมากในฤดูหนาว' },
  cooler: { name: 'บ่อน้ำแข็ง', cat: 'prod', cost: { stone: 30, iron: 10 }, work: 250, hp: 150, solid: 1, cool: 1, res: 'preserve', desc: 'อาหารในห้องเดียวกันจะไม่เน่า' },
  coop: { name: 'เล้าไก่', cat: 'prod', cost: { wood: 50 }, work: 250, hp: 100, solid: 1, coop: 1, res: 'husbandry', desc: 'ได้ไข่ 5 ฟองทุกวัน (ยกเว้นหนาวจัด)' },
};

const RECIPES = {
  meal: { name: 'อาหารปรุง', st: 'cook', ing: [['raw', 5]], out: 'meal', work: 110, skill: 'cooking', def: 12 },
  finemeal: { name: 'อาหารชั้นดี', st: 'cook', ing: [['veg', 3], ['meat', 3]], out: 'finemeal', work: 160, skill: 'cooking', res: 'stove', only: 'stove', def: 0 },
  coat: { name: 'เสื้อขนสัตว์', st: 'craft', ing: [['hide', 15]], out: 'coat', work: 400, skill: 'crafting', def: 0 },
  coat2: { name: 'เสื้อฝ้ายบุนวม', st: 'craft', ing: [['cotton', 20]], out: 'coat', work: 400, skill: 'crafting', res: 'tailoring', def: 0 },
  spear: { name: 'หอก', st: 'craft', ing: [['wood', 30]], out: 'spear', work: 350, skill: 'crafting', def: 0 },
  bow: { name: 'ธนู', st: 'craft', ing: [['wood', 45]], out: 'bow', work: 450, skill: 'crafting', def: 0 },
  sword: { name: 'ดาบเหล็ก', st: 'craft', ing: [['iron', 35]], out: 'sword', work: 600, skill: 'crafting', res: 'smithing', def: 0 },
  crossbow: { name: 'หน้าไม้', st: 'craft', ing: [['wood', 30], ['iron', 25]], out: 'crossbow', work: 650, skill: 'crafting', res: 'smithing', def: 0 },
};
function ingTypes(cls) { return cls === 'raw' ? ['veg', 'meat'] : [cls]; }

const CROPS = [
  null,
  { name: 'ข้าว', days: 4, yield: 8, item: 'veg', col: '#e2c75c' },
  { name: 'มันฝรั่ง', days: 5, yield: 10, item: 'veg', col: '#a7864c' },
  { name: 'ข้าวโพด', days: 8, yield: 24, item: 'veg', col: '#f0cb3a', res: 'corn' },
  { name: 'สมุนไพร', days: 7, yield: 2, item: 'medicine', col: '#5fc27a', res: 'herbal' },
  { name: 'ฝ้าย', days: 7, yield: 9, item: 'cotton', col: '#f4f1ea', res: 'tailoring' },
];

const RESEARCH = {
  corn: { name: 'ข้าวโพด', cost: 250, desc: 'ปลูกข้าวโพด ผลผลิตสูงมากต่อแปลง' },
  childcare: { name: 'การเลี้ยงดูเด็ก', cost: 200, desc: 'กล่องของเล่น และดูแลเด็กได้ดีขึ้น' },
  herbal: { name: 'สมุนไพร', cost: 250, desc: 'ปลูกสมุนไพรเป็นยารักษาโรคและบาดแผล' },
  masonry: { name: 'งานก่อหิน', cost: 300, desc: 'กำแพงหิน พื้นหิน เตาผิง' },
  tailoring: { name: 'การตัดเย็บ', cost: 300, desc: 'ปลูกฝ้าย และเย็บเสื้อฝ้ายบุนวม' },
  defense: { name: 'การป้องกัน', cost: 300, desc: 'รั้วกำบัง ลดโอกาสโดนยิง' },
  art: { name: 'ศิลปะ', cost: 300, desc: 'รูปปั้น ทำให้บ้านสวยและอารมณ์ดี' },
  education: { name: 'การศึกษา', cost: 350, req: ['childcare'], desc: 'กระดานสอนหนังสือ พ่อแม่สอนทักษะให้ลูก' },
  husbandry: { name: 'เลี้ยงสัตว์', cost: 400, desc: 'เล้าไก่ ได้ไข่ทุกวัน' },
  stove: { name: 'เตาหุงต้ม', cost: 400, req: ['masonry'], desc: 'เตาหุงต้ม และอาหารชั้นดี' },
  preserve: { name: 'การถนอมอาหาร', cost: 400, req: ['masonry'], desc: 'บ่อน้ำแข็ง เก็บอาหารไม่ให้เน่า' },
  medicine2: { name: 'การแพทย์', cost: 450, req: ['herbal'], desc: 'รักษาได้ผลดีขึ้น ฟื้นตัวเร็วขึ้น' },
  smithing: { name: 'ตีเหล็ก', cost: 500, req: ['masonry'], desc: 'หน้าไม้ และดาบเหล็ก' },
};

const SKILLS = {
  construction: 'ก่อสร้าง', plants: 'เพาะปลูก', mining: 'ขุดเหมือง', cooking: 'ทำอาหาร',
  shooting: 'การต่อสู้', medicine: 'การแพทย์', crafting: 'งานฝีมือ', research: 'วิจัย', social: 'เลี้ยงเด็ก/สังคม',
};
const WORKS = [
  { id: 'doctor', name: 'รักษา', icon: '🩹', skill: 'medicine' },
  { id: 'childcare', name: 'ดูแลเด็ก', icon: '🍼', skill: 'social' },
  { id: 'cook', name: 'ทำอาหาร', icon: '🍳', skill: 'cooking' },
  { id: 'hunt', name: 'ล่าสัตว์', icon: '🏹', skill: 'shooting' },
  { id: 'build', name: 'ก่อสร้าง', icon: '🔨', skill: 'construction' },
  { id: 'grow', name: 'เพาะปลูก', icon: '🌾', skill: 'plants' },
  { id: 'mine', name: 'ขุดหิน', icon: '⛏️', skill: 'mining' },
  { id: 'chop', name: 'ตัดไม้', icon: '🪓', skill: 'plants' },
  { id: 'research', name: 'วิจัย', icon: '🔬', skill: 'research' },
  { id: 'craft', name: 'งานฝีมือ', icon: '🧵', skill: 'crafting' },
  { id: 'haul', name: 'ขนของ', icon: '📦', skill: null },
];
const KID_WORKS = { haul: 1, grow: 1, research: 0 };

const TRAITS = {
  industrious: { name: 'ขยัน', desc: 'ทำงานเร็วขึ้น 20%', no: 'lazy' },
  lazy: { name: 'ขี้เกียจ', desc: 'ทำงานช้าลง 15% แต่อารมณ์ดี', no: 'industrious' },
  optimist: { name: 'มองโลกแง่ดี', desc: 'อารมณ์ +8', no: 'pessimist' },
  pessimist: { name: 'มองโลกแง่ร้าย', desc: 'อารมณ์ -8', no: 'optimist' },
  glutton: { name: 'กินจุ', desc: 'หิวเร็วขึ้น 40%' },
  tough: { name: 'อึด', desc: 'รับความเสียหายน้อยลง 40%' },
  fast: { name: 'ว่องไว', desc: 'เดินเร็วขึ้น 20%' },
  greenthumb: { name: 'มือเย็น', desc: 'ปลูกพืชเก่ง +30%' },
  loving: { name: 'รักครอบครัว', desc: 'ความสุขจากครอบครัวเพิ่มขึ้น' },
  coldproof: { name: 'ทนหนาว', desc: 'ทนความหนาวได้ดีกว่า 8°C' },
  quick: { name: 'หัวไว', desc: 'เรียนรู้ทักษะเร็วขึ้น 50%' },
  sickly: { name: 'ขี้โรค', desc: 'ป่วยง่าย หายช้า' },
  brave: { name: 'ใจเด็ด', desc: 'สติแตกยากกว่าปกติ' },
};

const THOUGHTS = {
  ateRaw: { label: 'กินของดิบ', val: -5, days: 0.8 },
  ateFine: { label: 'อาหารอร่อยมาก', val: 6, days: 1 },
  ateTable: { label: 'กินข้าวที่โต๊ะ', val: 2, days: 1 },
  ateFloor: { label: 'กินข้าวบนพื้น', val: -3, days: 1 },
  sleptOut: { label: 'นอนกลางแจ้ง', val: -6, days: 1 },
  sleptFloor: { label: 'นอนบนพื้น', val: -3, days: 1 },
  sleptPartner: { label: 'นอนกอดคนรัก', val: 5, days: 1 },
  niceRoom: { label: 'ห้องนอนสวย', val: 4, days: 1 },
  famDied: { label: 'คนในครอบครัวเสียชีวิต', val: -18, days: 8 },
  childDied: { label: 'ลูกเสียชีวิต', val: -35, days: 12 },
  partnerDied: { label: 'คู่ชีวิตเสียชีวิต', val: -30, days: 12 },
  newBaby: { label: 'มีสมาชิกใหม่ในครอบครัว', val: 15, days: 6 },
  played: { label: 'ได้เล่นกับลูก', val: 4, days: 1 },
  wasPlayed: { label: 'ได้เล่นกับผู้ใหญ่', val: 6, days: 1 },
  learned: { label: 'ได้เรียนหนังสือ', val: 3, days: 1 },
  married: { label: 'เพิ่งแต่งงาน', val: 15, days: 6 },
  hurt: { label: 'ได้รับบาดเจ็บ', val: -4, days: 2 },
  fireWarm: { label: 'นั่งผิงไฟ', val: 3, days: 0.4 },
  catharsis: { label: 'ได้ระบายความเครียด', val: 10, days: 2 },
  rescued: { label: 'มีที่อยู่ใหม่', val: 8, days: 4 },
  toy: { label: 'เล่นของเล่นสนุก', val: 4, days: 0.8 },
  victory: { label: 'ขับไล่ศัตรูได้', val: 6, days: 3 },
};

const NAMES_M = ['สมชาย', 'ประเสริฐ', 'วีระ', 'ธนา', 'อนันต์', 'กิตติ', 'ชัยวัฒน์', 'ภูมิ', 'เอกชัย', 'ณัฐพล', 'บุญมี', 'สมศักดิ์', 'พงษ์ศักดิ์', 'ศักดิ์ชัย', 'มานพ', 'ทองดี', 'วิชัย', 'สุรชัย', 'ปกรณ์', 'อำนาจ'];
const NAMES_F = ['มาลี', 'สมใจ', 'วันดี', 'นภา', 'กนกพร', 'ปราณี', 'อรุณี', 'จันทร์เพ็ญ', 'ดวงใจ', 'ศิริพร', 'ลำดวน', 'บุษบา', 'แก้วตา', 'น้ำฝน', 'พิมพ์ใจ', 'สายใจ', 'รัตนา', 'อัมพร', 'ดารุณี', 'ประไพ'];
const NAMES_KID = ['ต้นกล้า', 'น้ำใส', 'ข้าวหอม', 'ภูผา', 'ฟ้าใส', 'ใบบัว', 'ก้อนเมฆ', 'ทะเล', 'มะลิ', 'ดาว', 'ตะวัน', 'ขวัญ', 'แพรว', 'กล้วย', 'ส้มโอ', 'ลูกน้ำ', 'ไผ่', 'ปลายฝน', 'น้ำผึ้ง', 'เพชร', 'ข้าวปุ้น', 'ใบเตย', 'ภูมิใจ', 'แสงดาว', 'ลมหนาว'];
const SURNAMES = ['ใจดี', 'รักป่า', 'ทองดี', 'ศรีสุข', 'บุญมา', 'แสงทอง', 'พรหมมา', 'คงทน', 'ไร้ถิ่น', 'ดงดิบ'];

const SKIN = ['#f1c9a5', '#e0ac7e', '#c68b59', '#a5683f', '#8a5531'];
const HAIR = ['#2b1d14', '#4a2f1d', '#6b4423', '#1b1b1b', '#8b5a2b', '#3a2a20'];
const SHIRT = ['#3f7cac', '#c1503b', '#5b8c3a', '#d49a2a', '#7a4f9a', '#2f8f83', '#b5476e', '#8c6e4a'];

const ANIMALS = {
  rabbit: { name: 'กระต่าย', hp: 20, speed: 0.06, meat: 6, hide: 2, flee: 1 },
  deer: { name: 'กวาง', hp: 50, speed: 0.085, meat: 22, hide: 9, flee: 1 },
  boar: { name: 'หมูป่า', hp: 60, speed: 0.065, meat: 18, hide: 7, fight: 0.6, dmg: 8, cd: 40 },
  wolf: { name: 'หมาป่า', hp: 45, speed: 0.09, meat: 12, hide: 7, fight: 0.8, dmg: 7, cd: 38 },
};

const ACHIEVEMENTS = {
  night1: { name: 'คืนแรกที่รอด', desc: 'อยู่รอดถึงวันที่ 2', pts: 1 },
  shelter: { name: 'บ้านหลังแรก', desc: 'มีเตียงอยู่ในห้องที่มีหลังคา', pts: 2 },
  research1: { name: 'ความรู้คือพลัง', desc: 'วิจัยสำเร็จ 1 อย่าง', pts: 1 },
  raid1: { name: 'ปกป้องครอบครัว', desc: 'ขับไล่โจรได้ครั้งแรก', pts: 3 },
  baby1: { name: 'ของขวัญจากฟ้า', desc: 'มีลูกคนใหม่เกิดในบ้าน', pts: 5 },
  winter1: { name: 'ผ่านพ้นฤดูหนาว', desc: 'อยู่รอดจนถึงปีที่ 2', pts: 5 },
  fam5: { name: 'บ้านอบอุ่น', desc: 'ครอบครัวมี 5 คน', pts: 4 },
  feast: { name: 'ยุ้งฉางเต็ม', desc: 'มีอาหารปรุงสะสม 40 จาน', pts: 2 },
  grown: { name: 'ลูกโตแล้ว', desc: 'ลูกในบ้านอายุครบ 18 ปี', pts: 6 },
  wedding: { name: 'งานวิวาห์', desc: 'มีคู่รักคู่ใหม่ในบ้าน', pts: 5 },
  research6: { name: 'นักปราชญ์', desc: 'วิจัยสำเร็จ 6 อย่าง', pts: 4 },
  fam8: { name: 'ตระกูลใหญ่', desc: 'ครอบครัวมี 8 คน', pts: 8 },
  gen3: { name: 'สามรุ่น', desc: 'หลานคนแรกเกิด', pts: 10 },
  researchAll: { name: 'ยุคแห่งปัญญา', desc: 'วิจัยครบทุกอย่าง', pts: 8 },
  year3: { name: 'ตำนานแห่งดินแดนไร้นาม', desc: 'อยู่รอดถึงปีที่ 4', pts: 10 },
  rich: { name: 'มั่งคั่ง', desc: 'ความมั่งคั่งรวม 15,000', pts: 5 },
};

const PERKS = {
  food: { name: 'เสบียงเพิ่ม', desc: 'เริ่มเกมพร้อมอาหารปรุง +25', cost: 4 },
  wood: { name: 'กองไม้สำรอง', desc: 'เริ่มเกมพร้อมไม้ +150', cost: 4 },
  silver: { name: 'เงินเก็บ', desc: 'เริ่มเกมพร้อมเงิน +300', cost: 5 },
  hunter: { name: 'พรานป่า', desc: 'พ่อเริ่มพร้อมธนู และการต่อสู้ +3', cost: 7 },
  scholar: { name: 'ตำราเก่า', desc: 'เริ่มเกมพร้อมงานวิจัยสุ่ม 2 อย่าง', cost: 10 },
  skilled: { name: 'ครอบครัวมีฝีมือ', desc: 'ทุกคนทักษะ +2 ทุกด้าน', cost: 14 },
  twokids: { name: 'ลูกสองคน', desc: 'เริ่มเกมพร้อมลูกเพิ่มอีก 1 คน', cost: 18 },
};

// เป้าหมายแนะนำ (สอนเล่น) ทำทีละข้อ
const QUESTS = [
  { id: 'stock', text: 'สร้าง "คลังเก็บของ" (เมนู โซน)', reward: { silver: 20 } },
  { id: 'fire', text: 'สร้าง "กองไฟ" เพื่อทำอาหาร', reward: { wood: 30 } },
  { id: 'beds', text: 'สร้างเตียงให้ทุกคน (เตียงคู่ + เตียงเดี่ยว)', reward: { meal: 6 } },
  { id: 'room', text: 'ล้อมกำแพง+ประตู ให้เตียงอยู่ในห้องมีหลังคา', reward: { wood: 50 } },
  { id: 'farm', text: 'สร้าง "แปลงปลูก" อย่างน้อย 12 ช่อง', reward: { veg: 20 } },
  { id: 'research', text: 'สร้างโต๊ะวิจัย แล้วเลือกงานวิจัย', reward: { silver: 40 } },
  { id: 'food', text: 'ตุนอาหาร (ทุกชนิด) ให้ได้ 120 หน่วย ก่อนฤดูหนาว', reward: { medicine: 3 } },
  { id: 'coats', text: 'ทำเสื้อกันหนาวให้ทุกคน (โต๊ะช่าง)', reward: { silver: 60 } },
];
