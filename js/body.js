// Modelo anatómico (frente e costas) + análise de cada músculo.
// Os músculos são desenhados só do lado direito e espelhados para o esquerdo.
import { getEx } from './data.js';
import { e1rm } from './coach.js';

export const REGIONS = {
  traps:        { name: 'Trapézio',          min: 6,  max: 16 },
  'front-delts':{ name: 'Deltoide frontal',  min: 6,  max: 14 },
  'side-delts': { name: 'Deltoide lateral',  min: 12, max: 22, aesthetic: true },
  'rear-delts': { name: 'Deltoide posterior',min: 8,  max: 18, aesthetic: true },
  'chest-upper':{ name: 'Peito superior',    min: 8,  max: 16, aesthetic: true },
  chest:        { name: 'Peito',             min: 8,  max: 18 },
  biceps:       { name: 'Bíceps',            min: 10, max: 20, aesthetic: true },
  triceps:      { name: 'Tríceps',           min: 10, max: 20, aesthetic: true },
  forearms:     { name: 'Antebraços',        min: 4,  max: 14 },
  abs:          { name: 'Abdominais',        min: 8,  max: 18, aesthetic: true },
  obliques:     { name: 'Oblíquos',          min: 3,  max: 12 },
  lats:         { name: 'Dorsais',           min: 10, max: 20, aesthetic: true },
  'upper-back': { name: 'Costas (meio)',     min: 8,  max: 18 },
  'lower-back': { name: 'Lombar',            min: 3,  max: 10 },
  glutes:       { name: 'Glúteos',           min: 8,  max: 18 },
  quads:        { name: 'Quadríceps',        min: 10, max: 20 },
  hamstrings:   { name: 'Isquiotibiais',     min: 8,  max: 16 },
  adductors:    { name: 'Adutores',          min: 3,  max: 12 },
  calves:       { name: 'Gémeos',            min: 8,  max: 16 },
};

// Exercícios recomendados para cada músculo (ids da base de dados)
export const RECOMMEND = {
  traps: ['Barbell_Shrug', 'Dumbbell_Shrug', 'Face_Pull'],
  'front-delts': ['Leverage_Shoulder_Press', 'Front_Cable_Raise', 'Dumbbell_Shoulder_Press'],
  'side-delts': ['Cable_Seated_Lateral_Raise', 'Side_Lateral_Raise', 'Leverage_Shoulder_Press'],
  'rear-delts': ['Reverse_Machine_Flyes', 'Face_Pull', 'Cable_Rear_Delt_Fly'],
  'chest-upper': ['Barbell_Incline_Bench_Press_-_Medium_Grip', 'Incline_Dumbbell_Press', 'Incline_Cable_Flye'],
  chest: ['Butterfly', 'Dumbbell_Bench_Press', 'Cable_Crossover'],
  biceps: ['One_Arm_Dumbbell_Preacher_Curl', 'Hammer_Curls', 'Barbell_Curl'],
  triceps: ['Triceps_Pushdown_-_Rope_Attachment', 'Cable_Rope_Overhead_Triceps_Extension', 'Dips_-_Triceps_Version'],
  forearms: ['Hammer_Curls', 'Palms-Up_Barbell_Wrist_Curl_Over_A_Bench', 'Farmers_Walk'],
  abs: ['Cable_Crunch', 'Decline_Crunch', 'Hanging_Leg_Raise'],
  obliques: ['Pallof_Press', 'Decline_Oblique_Crunch', 'Russian_Twist'],
  lats: ['Wide-Grip_Lat_Pulldown', 'Pullups', 'Straight-Arm_Pulldown'],
  'upper-back': ['Leverage_High_Row', 'Seated_Cable_Rows', 'One-Arm_Dumbbell_Row'],
  'lower-back': ['Hyperextensions_Back_Extensions', 'Romanian_Deadlift'],
  glutes: ['Barbell_Hip_Thrust', 'Romanian_Deadlift', 'Dumbbell_Lunges'],
  quads: ['Smith_Machine_Squat', 'Leg_Extensions', 'Leg_Press'],
  hamstrings: ['Lying_Leg_Curls', 'Seated_Leg_Curl', 'Romanian_Deadlift'],
  adductors: ['Thigh_Adductor', 'Sumo_Deadlift'],
  calves: ['Calf_Press_On_The_Leg_Press_Machine', 'Standing_Calf_Raises', 'Seated_Calf_Raise'],
};

// Peso de cada exercício em cada região (primário 1, secundário 0.5), com regras para os deltoides e o peito
export function regionsFor(exId) {
  const ex = getEx(exId);
  const n = `${ex.en || ''} ${ex.id}`.toLowerCase();
  const out = {};
  const add = (r, v) => (out[r] = Math.max(out[r] || 0, v));
  const map = (m, v) => {
    switch (m) {
      case 'chest':
        if (/incline/.test(n)) { add('chest-upper', v); add('chest', v * 0.5); }
        else if (/decline|dip/.test(n)) add('chest', v);
        else { add('chest', v); add('chest-upper', v * 0.5); }
        break;
      case 'shoulders':
        if (/lateral|side|upright/.test(n) && !/rear/.test(n)) add('side-delts', v);
        else if (/rear|reverse|face_pull|face pull/.test(n)) add('rear-delts', v);
        else if (/front/.test(n)) add('front-delts', v);
        else if (/press|military|arnold/.test(n)) { add('front-delts', v); add('side-delts', v * 0.5); }
        else add('front-delts', v);
        break;
      case 'lats': add('lats', v); break;
      case 'middle back': add('upper-back', v); break;
      case 'traps': add('traps', v); break;
      case 'lower back': add('lower-back', v); break;
      case 'biceps': add('biceps', v); break;
      case 'triceps': add('triceps', v); break;
      case 'forearms': add('forearms', v); break;
      case 'abdominals': add('abs', v); add('obliques', v * 0.5); break;
      case 'quadriceps': add('quads', v); break;
      case 'hamstrings': add('hamstrings', v); break;
      case 'glutes': add('glutes', v); break;
      case 'calves': add('calves', v); break;
      case 'adductors': add('adductors', v); break;
      case 'abductors': add('glutes', v * 0.5); break;
    }
  };
  ex.primary.forEach((m) => map(m, 1));
  ex.secondary.forEach((m) => map(m, 0.5));
  if (/row|pulldown|pull-up|pullup|chin/.test(n)) add('rear-delts', 0.5);
  return out;
}

const done = (ex) => ex.sets.filter((s) => s.done && s.r > 0);

// Séries por região num intervalo
export function regionSets(workouts, from, to = Infinity) {
  const out = {};
  for (const w of workouts) {
    if (w.start < from || w.start >= to) continue;
    for (const ex of w.exercises) {
      const n = done(ex).length;
      if (!n) continue;
      for (const [r, v] of Object.entries(regionsFor(ex.exId))) out[r] = (out[r] || 0) + n * v;
    }
  }
  return out;
}

// Tendência de força por região: média da variação do melhor e1RM (primeira vs última metade de 6 semanas)
export function regionStrength(workouts, now = Date.now()) {
  const from = now - 42 * 864e5, mid = now - 21 * 864e5;
  const byEx = {};
  for (const w of workouts) {
    if (w.start < from) continue;
    for (const ex of w.exercises) {
      const best = Math.max(0, ...done(ex).map((s) => e1rm(s.w, s.r)));
      if (!best) continue;
      const slot = (byEx[ex.exId] ||= { a: 0, b: 0 });
      if (w.start < mid) slot.a = Math.max(slot.a, best); else slot.b = Math.max(slot.b, best);
    }
  }
  const acc = {};
  for (const [id, { a, b }] of Object.entries(byEx)) {
    if (!a || !b) continue;
    const pct = ((b - a) / a) * 100;
    for (const [r, v] of Object.entries(regionsFor(id))) {
      if (v < 1) continue;
      (acc[r] ||= []).push(pct);
    }
  }
  const out = {};
  for (const [r, list] of Object.entries(acc)) out[r] = list.reduce((x, y) => x + y, 0) / list.length;
  return out;
}

export function volumeState(r, sets) {
  const { min, max } = REGIONS[r];
  if (!sets) return 'none';
  if (sets < min * 0.5) return 'low';
  if (sets < min) return 'mid';
  if (sets <= max) return 'good';
  return 'high';
}
export function strengthState(pct) {
  if (pct == null) return 'none';
  if (pct < -1) return 'low';
  if (pct < 1.5) return 'mid';
  return 'good';
}

// Score estético 0–100: quão perto cada músculo está do volume ideal (prioridades estéticas valem a dobrar)
export function aestheticScore(sets) {
  let tot = 0, got = 0;
  for (const [r, cfg] of Object.entries(REGIONS)) {
    const w = cfg.aesthetic ? 2 : 1;
    const s = sets[r] || 0;
    tot += w;
    got += w * (s >= cfg.min ? (s <= cfg.max * 1.25 ? 1 : 0.8) : s / cfg.min);
  }
  return Math.round((got / tot) * 100);
}

// ---------- Desenho ----------
// Coordenadas num viewBox 200×440, só lado direito (x ≥ 100).
const FRONT = {
  traps: ['M108 66C114 76 126 82 142 86L114 89C111 82 109 74 108 66Z'],
  'front-delts': ['M133 90C137 87.5 141 86.5 146 86.5C151 101 153 117 153 131C147 119 140 106 131 98Z'],
  'side-delts': ['M148 86.5C159 89 166 98 166 110C166 121 161 130 155.5 133C155.5 118 153.5 101 148 86.5Z'],
  'chest-upper': ['M103 92L131 95C140 102 146 109 148.5 116C134 112 118 110.5 103 112Z'],
  chest: ['M103 114.5C118 113 134 114.5 149.5 119C151 127 146 136 136 140C126 144 114 144 107 141C104 139 103 136 103 132Z'],
  biceps: ['M152 137C159 133.5 165.5 140 166.5 152C167 164 164 173 160.5 177C154.5 172 150.5 161 150 149C150 143 150.5 139 152 137Z'],
  forearms: ['M158.5 182C166 180 172 190 174.5 204C176.5 219 178 233 178 244L169 246C164.5 230 158.5 214 156.5 199C155.5 191 156 185 158.5 182Z'],
  abs: [
    'M103 148H116.5Q118 148 118 150V163Q118 165 116.5 165H104.5Q103 165 103 163Z',
    'M103 168H117Q118.5 168 118.5 170V183Q118.5 185 117 185H104.5Q103 185 103 183Z',
    'M103 188H117Q118.5 188 118.5 190V203Q118.5 205 117 205H104.5Q103 205 103 203Z',
    'M103 208H117Q118.5 208 118 211C117 220 112 228 103 233Z',
  ],
  obliques: ['M121.5 148C129 146 136 146 141.5 149C140.5 168 138.5 188 137.5 205C132 210 126.5 216 121.5 223C121.5 198 121.5 172 121.5 148Z'],
  quads: ['M128 225C141 222 149 238 149 258C149 282 143 303 136.5 317C128 321 118.5 321 112.5 315C110.5 293 110.5 263 114 241C116.5 231 121.5 226 128 225Z'],
  adductors: ['M103 238C107 236.5 111 240 111.5 249C111 266 109.5 283 107.5 296C104 281 103 264 103 249Z'],
  calves: ['M118.5 331C126.5 327 136.5 331 138.5 345C140 363 136.5 383 132 401L124 401C120 381 116.5 361 116.5 345C116.5 339 116.5 334 118.5 331Z'],
};
const BACK = {
  traps: ['M100 64L108 64C112 75 124 83 143 88C128 96 116 112 107 138L100 150Z'],
  'rear-delts': ['M135 92C140 88 144 86.5 148 86.5C152 100 154 116 154 131C148 117 142 104 135 92Z'],
  'side-delts': ['M150 86.5C160 89 166 98 166 110C166 121 161 130 156 133C156 118 154.5 101 150 86.5Z'],
  'upper-back': ['M118 100C127 97 137 98 146 103C147 114 143 124 137 130C128 129 120 124 114 117C115 110 116 104 118 100Z'],
  lats: ['M112 125C121 131 133 134 146.5 132C148.5 150 144.5 170 136.5 189C128.5 199 118.5 205 108.5 209C108 189 108.5 158 112 125Z'],
  'lower-back': ['M101 156C106 159 110.5 170 110.5 190L110.5 214C106.5 218 103.5 220 101 220Z'],
  triceps: ['M151 136C158.5 132.5 166 140 167 152C168 164 164.5 174 160.5 178C154.5 172 150.5 160 149.5 148C149.5 142 150 138 151 136Z'],
  forearms: ['M158.5 182C166 180 172 190 174.5 204C176.5 219 178 233 178 244L169 246C164.5 230 158.5 214 156.5 199C155.5 191 156 185 158.5 182Z'],
  glutes: ['M101 222C116 215 136 218 144.5 231C149 245 146.5 259 136 265C124 269 110 267 101 261Z'],
  hamstrings: ['M106 270C116 268 132 268 143 266C145 286 141 304 134.5 318L114.5 318C110 302 106 288 106 270Z'],
  calves: ['M116.5 328C126 322 138.5 328 140 344C141 358 136.5 372 130.5 381C126 377 120.5 373 117.5 365C114.5 353 114.5 338 116.5 328Z',
    'M120 383C126 386 132 384 134 380C134 391 132 399 130 405L122 405C121 397 120 390 120 383Z'],
};
// Partes sem músculo (cabeça, mãos, joelhos, pés)
const SILHOUETTE = [
  'M100 62L108 62C112 74 124 82 146 86C160 90 167 100 167 112C163 124 157 134 151 140C148 160 146 180 144.5 200C148 214 152 226 152 246L100 246Z',
  'M150 132C158 128 168 136 168.5 154C169 170 167 180 165 186C161 191 156 189 154 183C150 170 148 150 150 132Z',
  'M104 236C120 222 151 228 151 260C151 290 143 318 141 338C142 364 137 390 135 405L121 405C118 380 114 352 113 332C108 302 104 270 104 236Z',
];
const BASE = {
  front: [...SILHOUETTE, 'M100 8C114 8 122 20 122 36C122 52 112 62 100 62Z', 'M100 62L108 62L109 70L100 70Z',
    'M169 248C175 247 180 252 181 260C182 268 178 274 173 274C168 273 166 266 166 258Z',
    'M113 318C120 322 132 322 137 318C139 325 138 330 134 332C127 335 119 334 115 330C113 326 112 322 113 318Z',
    'M122 404L134 404C136 410 140 416 140 421C140 425 128 426 122 424C120 418 121 410 122 404Z'],
};
BASE.back = BASE.front;

const STATE_FILL = {
  none: 'url(#m-none)', low: 'url(#m-low)', mid: 'url(#m-mid)', good: 'url(#m-good)', high: 'url(#m-high)',
};

const defs = `<defs>
  <linearGradient id="m-none" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c3038"/><stop offset="1" stop-color="#1f2228"/></linearGradient>
  <linearGradient id="m-low" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff7a6b"/><stop offset="1" stop-color="#e0403a"/></linearGradient>
  <linearGradient id="m-mid" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#f59e0b"/></linearGradient>
  <linearGradient id="m-good" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e2ff8a"/><stop offset="1" stop-color="#8fd014"/></linearGradient>
  <linearGradient id="m-high" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7dd3fc"/><stop offset="1" stop-color="#0ea5e9"/></linearGradient>
  <filter id="m-glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>`;

function figure(shapes, base, states, selected) {
  const half = (mirror) => {
    const t = mirror ? ' transform="translate(200 0) scale(-1 1)"' : '';
    const b = base.map((d) => `<path d="${d}" class="bm-base"/>`).join('');
    const m = Object.entries(shapes).map(([r, paths]) => {
      const st = states[r] || 'none';
      return paths.map((d) => `<path d="${d}" data-region="${r}" class="bm-m ${st} ${selected === r ? 'sel' : ''}" fill="${STATE_FILL[st]}"/>`).join('');
    }).join('');
    return `<g${t}>${b}${m}</g>`;
  };
  return half(false) + half(true);
}

export function bodySvg(states, { selected = null } = {}) {
  return `<div class="bodymap">
    <figure><svg viewBox="14 0 172 440" class="bm-svg">${defs}${figure(FRONT, BASE.front, states, selected)}</svg><figcaption>Frente</figcaption></figure>
    <figure><svg viewBox="14 0 172 440" class="bm-svg">${defs}${figure(BACK, BASE.back, states, selected)}</svg><figcaption>Costas</figcaption></figure>
  </div>`;
}

// Silhueta pequena para pré-visualizar os músculos de uma rotina
export function miniBody(regions) {
  const st = Object.fromEntries(Object.keys(regions).map((r) => [r, 'good']));
  return `<svg viewBox="14 0 172 440" class="bm-mini">${defs}${figure(FRONT, BASE.front, st)}</svg><svg viewBox="14 0 172 440" class="bm-mini">${defs}${figure(BACK, BASE.back, st)}</svg>`;
}
