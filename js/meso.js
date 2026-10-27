// Mesociclo automático: blocos de 4 semanas a subir o esforço + 1 semana de deload.
// O volume de cada músculo ajusta-se sozinho ao teu feedback (pump e recuperação)
// e à performance. Funciona com a rotação contínua (cada músculo de ~3 em 3 dias).
import { REGIONS, regionsFor } from './body.js';
import { e1rm, history } from './coach.js';

const DAY = 864e5, WEEK = 7 * DAY;
export const ACC_WEEKS = 4;
export const RIR_LABEL = ['3 reps', '2 reps', '1–2 reps', '0–1 rep'];
export const RPE_LABEL = ['7', '8', '8–9', '9–10'];
export const PUMP = ['😐 Fraco', '💪 Bom', '🔥 Brutal'];
export const REC = ['😎 Zero dor', '👍 Ok', '😬 Dorido', '🥵 Muito'];

const SKIP = ['forearms', 'obliques', 'adductors', 'lower-back', 'traps'];
const SESSION_CAP = 10; // acima disto, mais séries no mesmo dia rendem pouco
const extraCap = (r) => (REGIONS[r]?.aesthetic ? 3 : 1); // estéticos podem subir mais

// Novo bloco: começa a meio caminho do pico do bloco anterior
export function newMeso(prev, now = Date.now()) {
  const extra = {};
  for (const [id, n] of Object.entries(prev?.peak || {})) if (n > 0) extra[id] = Math.ceil(n / 2);
  return { n: (prev?.n || 0) + 1, start: now, deloadFrom: null, extra, peak: { ...extra }, log: (prev?.log || []).slice(-80) };
}

export function phase(m, now = Date.now()) {
  if (!m) return null;
  const deloadFrom = m.deloadFrom ?? m.start + ACC_WEEKS * WEEK;
  if (now >= deloadFrom) return { deload: true, week: ACC_WEEKS + 1, over: now >= deloadFrom + WEEK };
  const week = Math.min(ACC_WEEKS, Math.floor((now - m.start) / WEEK) + 1);
  return { deload: false, week, rir: RIR_LABEL[week - 1], rpe: RPE_LABEL[week - 1], over: false };
}

// Quando o deload termina, arranca o bloco seguinte
export function rollover(m, now = Date.now()) {
  return phase(m, now)?.over ? newMeso(m, now) : m;
}

export function plannedSets(m, exId, base, now = Date.now()) {
  const p = phase(m, now);
  if (!p) return base;
  if (p.deload) return Math.max(1, Math.ceil(base / 2));
  return Math.max(1, base + (m.extra[exId] || 0));
}

// Músculos que o treino trabalha como alvo principal
export function sessionRegions(exercises) {
  const out = new Set();
  for (const e of exercises) for (const [r, v] of Object.entries(regionsFor(e.exId))) if (v >= 1 && !SKIP.includes(r)) out.add(r);
  return [...out];
}

export function lastEntry(m, r, before = Infinity) {
  for (let i = m.log.length - 1; i >= 0; i--) if (m.log[i].r === r && m.log[i].t < before) return m.log[i];
  return null;
}

// Perguntas de recuperação para o treino que está a começar
export function pendingRecovery(m, regions, before, wid) {
  return regions
    .map((r) => lastEntry(m, r, before))
    .filter((e) => e && before - e.t < 10 * DAY && (e.rec == null || e.recWid === wid));
}

export function decide(pump, rec, perf) {
  if (rec == null) return null;
  if (rec === 3) return { d: -1, why: 'Ainda muito dorido: recuperação não chega' };
  if (perf === 'down' && rec >= 2) return { d: -1, why: 'Performance a descer e ainda dorido' };
  if (rec === 2) return { d: 0, why: 'Ainda um pouco dorido: dose no limite' };
  if (perf === 'down') return { d: 0, why: 'Performance desceu: consolida antes de subir' };
  if (pump === 2 && rec === 1) return { d: 0, why: 'Pump brutal e recuperaste à justa: dose certa' };
  return { d: 1, why: rec === 0 ? 'Nem ficaste dorido: aguenta mais volume' : 'Recuperaste a tempo e a performance aguentou' };
}

const bestOf = (sets) => Math.max(0, ...sets.filter((s) => s.done && s.r > 0).map((s) => e1rm(s.w, s.r)));

function perfFor(workouts, w, r) {
  const older = workouts.filter((x) => x.id !== w.id && x.start < w.start);
  let up = 0, down = 0, n = 0;
  for (const ex of w.exercises) {
    if ((regionsFor(ex.exId)[r] || 0) < 1) continue;
    const now = bestOf(ex.sets);
    const prev = history(older, ex.exId).find((h) => !h.deload);
    if (!now || !prev) continue;
    const k = now / bestOf(prev.sets);
    n++;
    if (k > 1.005) up++; else if (k < 0.975) down++;
  }
  if (!n) return null;
  return down > up ? 'down' : up ? 'up' : 'same';
}

const setsOf = (m, e) => e.sets + (m.extra[e.exId] || 0);
const hits = (e, r) => (regionsFor(e.exId)[r] || 0) >= 1;
// Exercícios de isolamento primeiro: mexer neles afeta só o músculo em causa
const spread = (e) => Object.values(regionsFor(e.exId)).filter((v) => v >= 0.5).length;

// Aplica +1/−1 série ao exercício certo do split
function apply(m, routines, r, d) {
  const cands = routines.flatMap((rt) => rt.exercises.filter((e) => hits(e, r)).map((e) => ({ e, rt })));
  if (!cands.length || !d) return { d: 0 };
  if (d > 0) {
    const pick = cands.sort((a, b) => setsOf(m, a.e) - setsOf(m, b.e) || spread(a.e) - spread(b.e))[0];
    const session = pick.rt.exercises.filter((e) => hits(e, r)).reduce((t, e) => t + setsOf(m, e), 0);
    if ((m.extra[pick.e.exId] || 0) >= extraCap(r) || session >= SESSION_CAP) return { d: 0, capped: true };
    m.extra[pick.e.exId] = (m.extra[pick.e.exId] || 0) + 1;
    m.peak[pick.e.exId] = Math.max(m.peak[pick.e.exId] || 0, m.extra[pick.e.exId]);
    return { d: 1, exId: pick.e.exId };
  }
  const pick = cands.filter((c) => setsOf(m, c.e) > 1 && (m.extra[c.e.exId] || 0) > -1).sort((a, b) => setsOf(m, b.e) - setsOf(m, a.e) || spread(a.e) - spread(b.e))[0];
  if (!pick) return { d: 0 };
  m.extra[pick.e.exId] = (m.extra[pick.e.exId] || 0) - 1;
  return { d: -1, exId: pick.e.exId };
}

// Depois de cada treino: decide o volume da próxima vez e prepara as perguntas
export function afterWorkout(m, workouts, routines, w) {
  const p = phase(m, w.start);
  if (!p || p.deload) return { regions: [], changes: [], deloadNow: false };
  const regions = sessionRegions(w.exercises);
  const changes = [];
  for (const r of regions) {
    const prev = lastEntry(m, r, w.start);
    const perf = perfFor(workouts, w, r);
    const dec = prev && prev.wid !== w.id ? decide(prev.pump, prev.rec, perf) : null;
    const res = dec ? apply(m, routines, r, dec.d) : null;
    const why = res?.capped ? 'Já estás no teto de séries para este músculo' : dec?.why;
    m.log.push({ t: w.start, wid: w.id, r, pump: null, rec: null, perf, delta: res ? res.d : null, exId: res?.exId || null, why: why || null });
    if (res) changes.push({ r, d: res.d, exId: res.exId, why });
  }
  // Fadiga acumulada: 2+ músculos a pedir menos volume na mesma semana → deload antecipado
  const cut = new Set(m.log.filter((e) => e.delta < 0 && e.t > w.start - WEEK).map((e) => e.r));
  const deloadNow = cut.size >= 2;
  if (deloadNow) m.deloadFrom = w.end || Date.now();
  return { regions, changes, deloadNow };
}
