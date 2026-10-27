import { store, save, uid, replaceAll, resetAll } from './store.js';
import { loadExercises, getEx, img, muscleName, MUSCLES, EQUIPMENT } from './data.js';
import { suggest, history, bests, e1rm, volume, setCount, muscleSets, progressSeries, insights, askClaude, claudeErrorMessage } from './coach.js';
import { esc, fmt, icon, sheet, toast, confetti, haptic, unlockAudio, beep, lineChart, countUp } from './ui.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const S = () => store();

let tab = 'home';
let progressEx = null;
let workoutEl = null;
let ticker = null;
let wakeLock = null;
let chatBusy = false;

// ============ Utilitários ============
const DAY = 864e5;
const num = (v) => { const n = parseFloat(String(v).replace(',', '.')); return Number.isFinite(n) ? n : null; };
const duration = (ms) => {
  const m = Math.floor(ms / 60000), h = Math.floor(m / 60);
  return h ? `${h}h ${String(m % 60).padStart(2, '0')}m` : `${m} min`;
};
const clock = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(r).padStart(2, '0')}`;
};
const dateLong = (t) => new Date(t).toLocaleDateString('pt-PT', { weekday: 'long', day: 'numeric', month: 'long' });
const dateShort = (t) => new Date(t).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
const tons = (kg) => (kg >= 1000 ? `${fmt(Math.round(kg / 100) / 10)} t` : `${Math.round(kg)} kg`);
const weekStart = (t) => { const d = new Date(t); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.getTime(); };

function streakWeeks(workouts) {
  const weeks = new Set(workouts.map((w) => weekStart(w.start)));
  let wk = weekStart(Date.now());
  if (!weeks.has(wk)) wk = weekStart(wk - 3 * DAY); // não somar 7 dias à mão: falha na mudança de hora
  let n = 0;
  while (weeks.has(wk)) { n++; wk = weekStart(wk - 3 * DAY); }
  return n;
}

const thumb = (id) => `<span class="thumb"><img src="${img(id, 0)}" alt="" loading="lazy"><img src="${img(id, 1)}" alt="" loading="lazy"></span>`;

// ============ Navegação ============
function go(next) {
  tab = next;
  const run = () => render();
  if (document.startViewTransition) document.startViewTransition(run); else run();
  window.scrollTo({ top: 0 });
}

function render() {
  const screens = { home: renderHome, history: renderHistory, progress: renderProgress, coach: renderCoach };
  app.innerHTML = `<main class="screen">${screens[tab]()}</main>${tabbar()}${resumeBar()}${tab === 'coach' ? composer() : ''}`;
  countUp(app);
  if (tab === 'coach' && S().chat.length) $('.chat-end')?.scrollIntoView();
}

function tabbar() {
  const t = (id, label, ic) => `<button class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${ic}<span>${label}</span></button>`;
  return `<nav class="tabbar">${t('home', 'Início', icon.home)}${t('history', 'Histórico', icon.history)}${t('progress', 'Progresso', icon.chart)}${t('coach', 'Coach', icon.coach)}</nav>`;
}

function resumeBar() {
  const a = S().active;
  if (!a || workoutEl) return '';
  return `<button class="resume" data-act="open-workout"><span class="pulse"></span><span class="grow ellipsis" style="text-align:left"><b>${esc(a.name)}</b><br><span class="muted small">Treino em curso</span></span><span class="elapsed num" data-elapsed>${clock(Date.now() - a.start)}</span></button>`;
}

// ============ Início ============
function renderHome() {
  const { workouts, routines, active } = S();
  const h = new Date().getHours();
  const hi = h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
  const week = workouts.filter((w) => w.start >= weekStart(Date.now()));
  const vol = week.reduce((t, w) => t + volume(w), 0);
  const recent = workouts.slice(-3).reverse();
  return `
    <div class="top">
      <div><div class="eyebrow">${esc(dateLong(Date.now()))}</div><h1>${hi} 💪</h1></div>
      <button class="icon-btn" data-act="settings" aria-label="Definições">${icon.gear}</button>
    </div>
    <div class="stats">
      <div class="stat"><b class="num" data-count="${week.length}">0</b><span>treinos esta semana</span></div>
      <div class="stat"><b class="num">${vol >= 1000 ? `<span data-count="${Math.round(vol / 100) / 10}" data-dec="1">0</span> t` : `<span data-count="${Math.round(vol)}">0</span>`}</b><span>${vol >= 1000 ? 'volume semanal' : 'kg de volume'}</span></div>
      <div class="stat"><b class="num"><span data-count="${streakWeeks(workouts)}">0</span>🔥</b><span>semanas seguidas</span></div>
    </div>
    <button class="hero" data-act="${active ? 'open-workout' : 'start'}">
      <div><b>${active ? 'Continuar treino' : 'Começar treino'}</b><span>${active ? esc(active.name) : 'Treino livre: adiciona os exercícios que quiseres'}</span></div>
      <div class="arrow">${icon.arrow}</div>
    </button>
    <h2>Rotinas</h2>
    ${routines.length ? `<div class="stack">${routines.map((r) => `
      <div class="card tap row" data-act="start-routine" data-id="${r.id}">
        <div class="grow"><h3 class="ellipsis">${esc(r.name)}</h3><div class="muted small ellipsis">${r.exercises.map((e) => esc(getEx(e.exId).name)).join(' · ')}</div></div>
        <button class="icon-btn" data-act="routine-menu" data-id="${r.id}" aria-label="Opções">${icon.dots}</button>
      </div>`).join('')}</div>`
      : `<div class="card muted small">Ainda não tens rotinas. No fim de um treino carrega em <b style="color:var(--text)">Guardar como rotina</b> para o repetires com um toque.</div>`}
    <h2>Últimos treinos</h2>
    ${recent.length ? `<div class="stack">${recent.map(workoutCard).join('')}</div>` : `<div class="empty"><div class="big">🏋️</div>O primeiro treino é o mais importante. Bora!</div>`}
  `;
}

function workoutCard(w) {
  const prs = w.exercises.reduce((t, e) => t + e.sets.filter((s) => s.pr).length, 0);
  return `<div class="card tap" data-act="workout-detail" data-id="${w.id}">
    <div class="row between"><h3 class="ellipsis">${esc(w.name)}</h3><span class="muted small">${dateShort(w.start)}</span></div>
    <div class="muted small" style="margin-top:4px">${duration(w.end - w.start)} · ${tons(volume(w))} · ${setCount(w)} séries${prs ? ` · <span style="color:var(--gold)">🏆 ${prs} PR</span>` : ''}</div>
    <div class="small ellipsis" style="margin-top:8px;color:#c9ced6">${w.exercises.map((e) => esc(getEx(e.exId).name)).join(' · ')}</div>
  </div>`;
}

// ============ Histórico ============
function renderHistory() {
  const ws = [...S().workouts].reverse();
  if (!ws.length) return `<div class="top"><h1>Histórico</h1></div><div class="empty"><div class="big">📒</div>Os teus treinos aparecem aqui.</div>`;
  const groups = {};
  for (const w of ws) {
    const k = new Date(w.start).toLocaleDateString('pt-PT', { month: 'long', year: 'numeric' });
    (groups[k] ||= []).push(w);
  }
  return `<div class="top"><div><div class="eyebrow">${ws.length} treinos</div><h1>Histórico</h1></div></div>
    ${Object.entries(groups).map(([k, list]) => `<h2 style="text-transform:capitalize">${esc(k)}</h2><div class="stack">${list.map(workoutCard).join('')}</div>`).join('')}`;
}

function workoutDetail(id) {
  const w = S().workouts.find((x) => x.id === id);
  if (!w) return;
  const sh = sheet(`
    <div class="head"><div><h3>${esc(w.name)}</h3><div class="muted small">${esc(dateLong(w.start))}</div></div><button class="icon-btn" data-close>${icon.close}</button></div>
    <div class="body">
      <div class="kv"><div><b>${duration(w.end - w.start)}</b><span>duração</span></div><div><b>${tons(volume(w))}</b><span>volume</span></div><div><b>${setCount(w)}</b><span>séries</span></div></div>
      ${w.exercises.map((e) => `
        <div class="card" style="margin-top:10px">
          <div class="row">${thumb(e.exId)}<div class="grow"><b>${esc(getEx(e.exId).name)}</b></div></div>
          ${e.sets.map((s, i) => `<div class="list-item num"><span class="muted">Série ${i + 1}</span><span>${fmt(s.w)} kg × ${s.r}${s.rpe ? ` <span class="muted">@${fmt(s.rpe)}</span>` : ''}${s.pr ? '<span class="pr-tag">PR</span>' : ''}</span></div>`).join('')}
        </div>`).join('')}
      <div class="row" style="margin-top:16px">
        <button class="btn primary grow" data-act="repeat-workout" data-id="${w.id}">Repetir treino</button>
        <button class="btn danger" data-act="delete-workout" data-id="${w.id}">${icon.trash}</button>
      </div>
    </div>`);
  sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-act]')) sh.close(); });
}

// ============ Progresso ============
function renderProgress() {
  const { workouts } = S();
  const counts = {};
  workouts.forEach((w) => w.exercises.forEach((e) => { if (e.sets.length) counts[e.exId] = (counts[e.exId] || 0) + 1; }));
  const ids = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  if (!ids.length) return `<div class="top"><h1>Progresso</h1></div><div class="empty"><div class="big">📈</div>Regista alguns treinos e vês aqui a tua evolução.</div>`;
  if (!ids.includes(progressEx)) progressEx = ids[0];

  const series = progressSeries(workouts, progressEx);
  const b = bests(workouts, progressEx);
  const first = series[0]?.e1rm || 0, last = series.at(-1)?.e1rm || 0;
  const delta = first ? ((last - first) / first) * 100 : 0;
  const ms = muscleSets(workouts, 7);
  const msList = Object.entries(ms).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const maxSets = Math.max(20, ...msList.map((x) => x[1]));

  return `<div class="top"><div><div class="eyebrow">Evolução</div><h1>Progresso</h1></div></div>
    <div class="chips">${ids.map((id) => `<button class="chip ${id === progressEx ? 'on' : ''}" data-act="progress-ex" data-id="${id}">${esc(getEx(id).name)}</button>`).join('')}</div>
    <div class="card" style="margin-top:14px">
      <div class="row between"><div><div class="muted small">1RM estimado</div><b style="font-size:28px" class="num"><span data-count="${Math.round(last)}">0</span> kg</b></div>
      ${series.length > 1 ? `<span class="chip" style="background:${delta >= 0 ? 'var(--accent-soft)' : 'rgba(255,92,92,.12)'};color:${delta >= 0 ? 'var(--accent)' : 'var(--danger)'}">${delta >= 0 ? '▲' : '▼'} ${fmt(Math.abs(Math.round(delta * 10) / 10))}%</span>` : ''}</div>
      <div style="margin-top:10px">${lineChart(series.map((s) => ({ t: s.date, y: s.e1rm })))}</div>
    </div>
    <div class="kv"><div><b class="num">${fmt(b.w)}</b><span>kg máximo</span></div><div><b class="num">${Math.round(b.e)}</b><span>melhor 1RM est.</span></div><div><b class="num">${series.length}</b><span>sessões</span></div></div>
    <button class="btn block" data-act="ex-detail" data-id="${progressEx}">Ver demonstração do exercício</button>
    <h2>Últimas sessões</h2>
    <div class="card">${series.slice(-8).reverse().map((s) => `<div class="list-item num"><span class="muted">${dateShort(s.date)}</span><span>${fmt(s.best.w)} kg × ${s.best.r}</span><span class="muted small">1RM ${Math.round(s.e1rm)}</span></div>`).join('')}</div>
    <h2>Séries por músculo · 7 dias</h2>
    <div class="card bars">${msList.length ? msList.map(([m, n], i) => `<div class="bar-row"><span class="ellipsis">${esc(muscleName(m))}</span><div class="track"><div class="fill" style="width:${(n / maxSets) * 100}%;animation-delay:${i * 0.06}s"></div></div><span class="num muted" style="text-align:right">${fmt(n)}</span></div>`).join('') : '<span class="muted small">Sem treinos nos últimos 7 dias.</span>'}
      <p class="muted small" style="margin:10px 0 0">Referência para hipertrofia: 10–20 séries semanais por músculo.</p></div>`;
}

// ============ Coach ============
const QUICK = [
  'Analisa a minha última semana',
  'Em que exercício estou estagnado e o que faço?',
  'Que cargas faço no próximo treino?',
  'Monta-me um plano de 4 dias',
];

function renderCoach() {
  const { workouts, chat, settings } = S();
  const ins = insights(workouts);
  return `<div class="top"><div><div class="eyebrow">Inteligência</div><h1>Coach</h1></div>
      ${chat.length ? `<button class="btn sm" data-act="clear-chat">Limpar</button>` : ''}</div>
    ${ins.length ? `<div class="stack">${ins.map((x, i) => `<div class="card insight ${x.tone}" style="animation-delay:${i * 0.07}s"><div class="ico">${x.icon}</div><div><b>${esc(x.title)}</b><div class="muted small" style="margin-top:2px">${esc(x.text)}</div></div></div>`).join('')}</div>`
      : `<div class="card muted small">Faz o teu primeiro treino e o coach começa a analisar a tua progressão, plateaus e equilíbrio muscular.</div>`}
    <h2>Pergunta ao coach</h2>
    ${!settings.apiKey ? `<div class="card"><b>Liga o coach com AI ✨</b><p class="muted small">O chat usa o Claude e lê o teu histórico real para responder. Precisas de uma chave da API da Anthropic (console.anthropic.com). Os insights acima funcionam sempre, mesmo sem chave e offline.</p><button class="btn primary sm" data-act="settings">Adicionar chave</button></div>` : ''}
    ${!chat.length && settings.apiKey ? `<div class="chips" style="flex-wrap:wrap;margin:0">${QUICK.map((q) => `<button class="chip" data-act="quick" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
    <div id="chat">${chat.map((m) => `<div class="msg ${m.role}">${esc(m.content)}</div>`).join('')}</div>
    <div class="chat-end"></div>`;
}

function composer() {
  return `<form class="composer" data-form="chat"><input class="field" name="q" placeholder="Pergunta sobre os teus treinos…" autocomplete="off" enterkeyhint="send"><button class="send" aria-label="Enviar">${icon.send}</button></form>`;
}

async function sendChat(text) {
  const s = S();
  if (!text.trim() || chatBusy) return;
  if (!s.settings.apiKey) return openSettings();
  chatBusy = true;
  s.chat.push({ role: 'user', content: text.trim() });
  save();
  render();
  const box = $('#chat');
  const bubble = document.createElement('div');
  bubble.className = 'msg assistant';
  bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  box.append(bubble);
  bubble.scrollIntoView({ block: 'end', behavior: 'smooth' });
  let acc = '';
  try {
    const full = await askClaude({
      apiKey: s.settings.apiKey, workouts: s.workouts, chat: s.chat,
      onText: (t) => { acc += t; bubble.textContent = acc; if (tab === 'coach') bubble.scrollIntoView({ block: 'end' }); },
    });
    s.chat.push({ role: 'assistant', content: full || acc });
    save();
  } catch (err) {
    const last = s.chat.pop();
    save();
    bubble.className = 'msg err';
    bubble.textContent = await claudeErrorMessage(err);
    const input = $('[data-form=chat] input');
    if (input) input.value = last?.content || '';
  } finally {
    chatBusy = false;
  }
}

// ============ Treino ativo ============
function newEntry(exId, n) {
  const last = history(S().workouts, exId)[0];
  const count = n || last?.sets.length || 3;
  return { exId, sets: Array.from({ length: count }, () => ({ w: null, r: null, rpe: null, done: false })) };
}

function startWorkout(routine, fromWorkout) {
  const s = S();
  if (s.active) return openWorkout();
  const day = new Date().toLocaleDateString('pt-PT', { weekday: 'long' });
  const src = routine?.exercises || fromWorkout?.exercises.map((e) => ({ exId: e.exId, sets: e.sets.length }));
  s.active = {
    id: uid(), start: Date.now(),
    name: routine?.name || fromWorkout?.name || `Treino de ${day}`,
    exercises: (src || []).map((e) => newEntry(e.exId, e.sets)),
  };
  save();
  haptic();
  openWorkout();
  if (!src) openPicker();
}

function openWorkout() {
  if (!S().active) return;
  if (!workoutEl) {
    workoutEl = document.createElement('div');
    workoutEl.className = 'workout';
    document.body.append(workoutEl);
    workoutEl.addEventListener('input', onWorkoutInput);
  }
  renderWorkout();
  render();
  requestWakeLock();
}

function closeWorkout() {
  if (!workoutEl) return;
  const el = workoutEl;
  workoutEl = null;
  el.classList.add('closing');
  setTimeout(() => el.remove(), 300);
  releaseWakeLock();
  render();
}

function renderWorkout() {
  const a = S().active;
  if (!a || !workoutEl) return;
  const scroll = workoutEl.scrollTop;
  workoutEl.innerHTML = `
    <div class="workout-head">
      <button class="icon-btn" data-act="minimize" aria-label="Minimizar">${icon.down}</button>
      <div class="grow"><input class="workout-title" data-field="name" value="${esc(a.name)}" aria-label="Nome do treino"><div class="elapsed num" data-elapsed>${clock(Date.now() - a.start)}</div></div>
      <button class="btn primary sm" data-act="finish">Terminar</button>
    </div>
    <div class="content">
      ${a.exercises.map(exerciseCard).join('')}
      ${!a.exercises.length ? `<div class="empty"><div class="big">➕</div>Adiciona o primeiro exercício</div>` : ''}
      <button class="btn block" style="margin-top:18px;color:var(--accent)" data-act="add-ex">${icon.plus} Adicionar exercício</button>
      <button class="btn ghost block" style="margin-top:6px;color:var(--danger)" data-act="discard">Cancelar treino</button>
    </div>`;
  workoutEl.scrollTop = scroll;
}

function exerciseCard(entry, ei) {
  const { workouts, settings, active } = S();
  const ex = getEx(entry.exId);
  const prev = history(workouts, entry.exId)[0];
  const sg = suggest(workouts, entry.exId, settings.increment);
  const ph = (i, k) => {
    if (sg && k === 'w') return fmt(sg.w);
    if (sg && k === 'r') return sg.r;
    const p = prev?.sets[i] || prev?.sets.at(-1);
    return p ? fmt(p[k]) : k === 'w' ? 'kg' : 'reps';
  };
  return `<div class="card ex-card" data-ei="${ei}">
    <div class="ex-top">
      <button data-act="ex-detail" data-id="${ex.id}">${thumb(ex.id)}</button>
      <div class="grow"><button class="ex-name" data-act="ex-detail" data-id="${ex.id}">${esc(ex.name)}</button><div class="muted small">${esc(ex.primary.map(muscleName).join(', '))}</div></div>
      <button class="icon-btn" data-act="ex-menu" data-ei="${ei}" aria-label="Opções">${icon.dots}</button>
    </div>
    ${sg ? `<button class="suggest ${sg.kind === 'deload' ? 'deload' : ''}" data-act="apply-suggest" data-ei="${ei}"><span class="badge">COACH</span><span class="grow">${esc(sg.why)}</span><b class="num">${fmt(sg.w)}×${sg.r}</b></button>` : ''}
    <table class="sets">
      <thead><tr><th>Série</th><th>Anterior</th><th>kg</th><th>Reps</th><th>RPE</th><th></th></tr></thead>
      <tbody>${entry.sets.map((s, si) => {
        const p = prev?.sets[si];
        return `<tr class="set ${s.done ? 'done' : ''} ${s.pr ? 'pr' : ''}" data-si="${si}">
          <td>${si + 1}${s.pr ? '<span class="pr-tag">PR</span>' : ''}</td>
          <td class="prev num">${p ? `${fmt(p.w)}×${p.r}` : '–'}</td>
          <td><input class="num" inputmode="decimal" data-field="w" data-ei="${ei}" data-si="${si}" value="${fmt(s.w)}" placeholder="${ph(si, 'w')}"></td>
          <td><input class="num" inputmode="numeric" data-field="r" data-ei="${ei}" data-si="${si}" value="${fmt(s.r)}" placeholder="${ph(si, 'r')}"></td>
          <td class="rpe"><input class="num" inputmode="decimal" data-field="rpe" data-ei="${ei}" data-si="${si}" value="${fmt(s.rpe)}" placeholder="–"></td>
          <td><button class="check" data-act="tick" data-ei="${ei}" data-si="${si}" aria-label="Concluir série">${icon.check}</button></td>
        </tr>`;
      }).join('')}</tbody>
    </table>
    <div class="row" style="margin-top:4px">
      <button class="btn sm grow" data-act="add-set" data-ei="${ei}">${icon.plus} Série</button>
      ${entry.sets.length > 1 ? `<button class="btn sm" data-act="remove-set" data-ei="${ei}">− Série</button>` : ''}
    </div>
  </div>`;
}

function onWorkoutInput(e) {
  const t = e.target;
  const a = S().active;
  if (!a || !t.dataset.field) return;
  if (t.dataset.field === 'name') { a.name = t.value; save(); return; }
  const set = a.exercises[+t.dataset.ei].sets[+t.dataset.si];
  set[t.dataset.field] = num(t.value);
  if (t.dataset.field === 'rpe' && set.rpe != null) set.rpe = Math.min(10, Math.max(1, set.rpe));
  save();
}

function tick(ei, si) {
  unlockAudio();
  const a = S().active;
  const entry = a.exercises[ei];
  const set = entry.sets[si];
  if (set.done) {
    set.done = false; set.pr = false;
    save(); renderWorkout();
    return;
  }
  const row = workoutEl.querySelector(`[data-ei="${ei}"] tr[data-si="${si}"]`);
  const w = set.w ?? num(row.querySelector('[data-field=w]').placeholder);
  const r = set.r ?? num(row.querySelector('[data-field=r]').placeholder);
  if (w == null || r == null || r <= 0) {
    toast('Indica o peso e as reps');
    row.querySelector(w == null ? '[data-field=w]' : '[data-field=r]').focus();
    return;
  }
  Object.assign(set, { w, r, done: true });

  // Recorde? Compara com o histórico e com as séries já feitas hoje
  const past = bests(S().workouts, entry.exId);
  const today = entry.sets.filter((s, i) => i !== si && s.done).reduce((m, s) => Math.max(m, e1rm(s.w, s.r)), 0);
  const val = e1rm(w, r);
  set.pr = past.e > 0 && val > past.e && val > today;
  if (set.pr) entry.sets.forEach((s, i) => { if (i !== si && s.pr && e1rm(s.w, s.r) < val) s.pr = false; });
  save();
  haptic(set.pr ? 40 : 10);
  renderWorkout();
  if (set.pr) {
    confetti();
    toast(`🏆 Novo recorde: ${fmt(w)} kg × ${r}`, 'gold');
  }
  startRest(S().settings.rest);
}

function applySuggest(ei) {
  const { workouts, settings, active } = S();
  const entry = active.exercises[ei];
  const sg = suggest(workouts, entry.exId, settings.increment);
  if (!sg) return;
  entry.sets.forEach((s) => { if (!s.done) { s.w = sg.w; s.r = sg.r; } });
  save(); haptic(); renderWorkout();
  toast('Cargas do coach aplicadas ✓');
}

function finishWorkout() {
  const s = S();
  const a = s.active;
  const exercises = a.exercises
    .map((e) => ({ exId: e.exId, sets: e.sets.filter((x) => x.done).map(({ w, r, rpe, pr }) => ({ w, r, rpe, pr: !!pr, done: true })) }))
    .filter((e) => e.sets.length);
  if (!exercises.length) {
    if (confirm('Nenhuma série concluída. Descartar este treino?')) { s.active = null; save(); closeWorkout(); stopRest(); }
    return;
  }
  const w = { id: a.id, name: a.name.trim() || 'Treino', start: a.start, end: Date.now(), exercises };
  s.workouts.push(w);
  s.active = null;
  save();
  stopRest();
  closeWorkout();
  const prs = exercises.flatMap((e) => e.sets.filter((x) => x.pr).map((x) => ({ ...x, exId: e.exId })));
  if (prs.length) setTimeout(confetti, 350);
  const sh = sheet(`
    <div class="head"><h3>Treino concluído 🎉</h3><button class="icon-btn" data-close>${icon.close}</button></div>
    <div class="body">
      <div class="kv"><div><b>${duration(w.end - w.start)}</b><span>duração</span></div><div><b>${tons(volume(w))}</b><span>volume</span></div><div><b>${setCount(w)}</b><span>séries</span></div></div>
      ${prs.length ? `<div class="card" style="border-color:rgba(255,212,59,.35)"><b style="color:var(--gold)">🏆 ${prs.length} recorde${prs.length > 1 ? 's' : ''} pessoal${prs.length > 1 ? 'is' : ''}</b>${prs.map((p) => `<div class="list-item"><span>${esc(getEx(p.exId).name)}</span><b class="num">${fmt(p.w)} × ${p.r}</b></div>`).join('')}</div>` : ''}
      <button class="btn primary block" style="margin-top:14px" data-act="save-routine" data-id="${w.id}">Guardar como rotina</button>
      <button class="btn block" style="margin-top:8px" data-close>Fechar</button>
    </div>`);
  sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-act=save-routine]')) sh.close(); });
}

function saveRoutine(workoutId) {
  const w = S().workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const name = prompt('Nome da rotina', w.name);
  if (!name) return;
  S().routines.push({ id: uid(), name, exercises: w.exercises.map((e) => ({ exId: e.exId, sets: e.sets.length })) });
  save(); render();
  toast('Rotina guardada ✓');
}

// ============ Descanso ============
let rest = null;
function startRest(sec) {
  stopRest();
  const el = document.createElement('div');
  el.className = 'rest';
  document.body.append(el);
  rest = { end: Date.now() + sec * 1000, total: sec, el, fired: false };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-rest]');
    if (!b) return;
    const v = b.dataset.rest;
    if (v === 'skip') return stopRest();
    rest.end += +v * 1000; rest.total = Math.max(rest.total + +v, 1);
    haptic(); paintRest();
  });
  paintRest();
}
function stopRest() { rest?.el.remove(); rest = null; }
function paintRest() {
  if (!rest) return;
  const left = rest.end - Date.now();
  const C = 2 * Math.PI * 22;
  const k = Math.max(0, left) / (rest.total * 1000);
  if (left <= 0 && !rest.fired) {
    rest.fired = true;
    beep(); haptic(200);
    rest.el.classList.add('done');
    setTimeout(stopRest, 4000);
  }
  rest.el.innerHTML = `
    <div class="ring"><svg width="52" height="52"><circle cx="26" cy="26" r="22" stroke="var(--surface)" stroke-width="5" fill="none"/><circle cx="26" cy="26" r="22" stroke="var(--accent)" stroke-width="5" fill="none" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - k)}" style="transition:stroke-dashoffset .3s linear"/></svg><span class="t num">${left > 0 ? clock(left) : '✓'}</span></div>
    <div class="grow"><b>${left > 0 ? 'Descanso' : 'Bora! Próxima série'}</b><div class="muted small">${left > 0 ? 'Respira, hidrata' : 'Descanso terminado'}</div></div>
    ${left > 0 ? `<button class="btn sm" data-rest="-15">−15</button><button class="btn sm" data-rest="15">+15</button><button class="btn sm" data-rest="skip">Saltar</button>` : ''}`;
}

// ============ Seletor de exercícios ============
async function openPicker() {
  const list = await loadExercises();
  const picked = new Set();
  let q = '', muscle = '';
  const used = new Set(S().workouts.flatMap((w) => w.exercises.map((e) => e.exId)));
  const sh = sheet(`
    <div class="head"><h3>Adicionar exercícios</h3><button class="btn primary sm" data-act="picker-add" disabled>Adicionar</button></div>
    <div style="padding:0 16px 10px"><input class="field" type="search" placeholder="Procurar (ex.: supino, squat, curl)" data-pick="q"></div>
    <div class="chips" style="margin:0 0 8px">${['', ...Object.keys(MUSCLES).slice(0, 15)].map((m) => `<button class="chip ${m === '' ? 'on' : ''}" data-muscle="${m}">${m ? esc(muscleName(m)) : 'Todos'}</button>`).join('')}</div>
    <div class="body" data-list></div>`);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const paint = () => {
    const nq = norm(q);
    let res = list.filter((x) => (!muscle || x.primary.includes(muscle)) && (!nq || norm(x.name).includes(nq) || norm(x.en).includes(nq)));
    res.sort((a, b) => (used.has(b.id) - used.has(a.id)) || (b.popular - a.popular));
    res = res.slice(0, 80);
    $('[data-list]', sh.el).innerHTML = res.length ? res.map((x) => `
      <button class="ex-row ${picked.has(x.id) ? 'on' : ''}" data-pick-id="${x.id}">
        ${thumb(x.id)}
        <span class="grow"><b class="ellipsis" style="display:block">${esc(x.name)}</b><span class="muted small">${esc(x.primary.map(muscleName).join(', '))} · ${esc(EQUIPMENT[x.equipment] || x.equipment)}${used.has(x.id) ? ' · <span style="color:var(--accent)">já fizeste</span>' : ''}</span></span>
        <span class="sel">${picked.has(x.id) ? icon.check : ''}</span>
      </button>`).join('') : '<div class="empty">Nada encontrado</div>';
    const btn = $('[data-act=picker-add]', sh.el);
    btn.disabled = !picked.size;
    btn.textContent = picked.size ? `Adicionar (${picked.size})` : 'Adicionar';
  };
  sh.el.addEventListener('input', (e) => { if (e.target.dataset.pick === 'q') { q = e.target.value; paint(); } });
  sh.el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-muscle]');
    if (m) {
      muscle = m.dataset.muscle;
      sh.el.querySelectorAll('[data-muscle]').forEach((c) => c.classList.toggle('on', c === m));
      paint();
      return;
    }
    const row = e.target.closest('[data-pick-id]');
    if (row) {
      const id = row.dataset.pickId;
      picked.has(id) ? picked.delete(id) : picked.add(id);
      haptic(); paint();
      return;
    }
    if (e.target.closest('[data-act=picker-add]')) {
      const a = S().active;
      picked.forEach((id) => a.exercises.push(newEntry(id)));
      save(); renderWorkout(); sh.close();
      setTimeout(() => workoutEl?.scrollTo({ top: workoutEl.scrollHeight, behavior: 'smooth' }), 300);
    }
  });
  paint();
}

// ============ Detalhe do exercício (animação) ============
function exerciseDetail(id) {
  const ex = getEx(id);
  const { workouts } = S();
  const series = progressSeries(workouts, id);
  const b = bests(workouts, id);
  const sg = suggest(workouts, id, S().settings.increment);
  sheet(`
    <div class="head"><h3 class="ellipsis">${esc(ex.name)}</h3><button class="icon-btn" data-close>${icon.close}</button></div>
    <div class="body">
      <div class="demo"><span class="live">● DEMO</span><img src="${img(id, 0)}" alt="Posição inicial"><img src="${img(id, 1)}" alt="Posição final"></div>
      <div class="chips" style="margin:12px 0 0;flex-wrap:wrap">
        ${ex.primary.map((m) => `<span class="chip on">${esc(muscleName(m))}</span>`).join('')}
        ${ex.secondary.map((m) => `<span class="chip">${esc(muscleName(m))}</span>`).join('')}
        <span class="chip">${esc(EQUIPMENT[ex.equipment] || ex.equipment)}</span>
      </div>
      ${series.length ? `
        <div class="kv"><div><b class="num">${fmt(b.w)}</b><span>kg máximo</span></div><div><b class="num">${Math.round(b.e)}</b><span>1RM est.</span></div><div><b class="num">${series.length}</b><span>sessões</span></div></div>
        ${sg ? `<div class="suggest ${sg.kind === 'deload' ? 'deload' : ''}"><span class="badge">PRÓXIMO</span><span class="grow">${esc(sg.why)}</span></div>` : ''}
        ${series.length > 1 ? `<div class="card" style="margin-top:10px">${lineChart(series.map((s) => ({ t: s.date, y: s.e1rm })), { h: 150 })}</div>` : ''}` : ''}
      ${ex.instructions?.length ? `<h2 style="margin-top:20px">Execução <span class="muted small">(EN)</span></h2><ol class="steps">${ex.instructions.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    </div>`);
}

function exerciseMenu(ei) {
  const a = S().active;
  const entry = a.exercises[ei];
  const sh = sheet(`
    <div class="head"><h3>${esc(getEx(entry.exId).name)}</h3><button class="icon-btn" data-close>${icon.close}</button></div>
    <div class="body stack">
      <button class="btn block" data-m="demo">Ver demonstração</button>
      ${ei > 0 ? '<button class="btn block" data-m="up">Mover para cima</button>' : ''}
      ${ei < a.exercises.length - 1 ? '<button class="btn block" data-m="down">Mover para baixo</button>' : ''}
      <button class="btn danger block" data-m="remove">Remover exercício</button>
    </div>`);
  sh.el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    sh.close();
    if (m === 'demo') return exerciseDetail(entry.exId);
    if (m === 'remove') a.exercises.splice(ei, 1);
    if (m === 'up' || m === 'down') {
      const j = m === 'up' ? ei - 1 : ei + 1;
      [a.exercises[ei], a.exercises[j]] = [a.exercises[j], a.exercises[ei]];
    }
    save(); renderWorkout();
  });
}

// ============ Definições ============
function openSettings() {
  const st = S().settings;
  const sh = sheet(`
    <div class="head"><h3>Definições</h3><button class="icon-btn" data-close>${icon.close}</button></div>
    <div class="body">
      <label class="lbl">Descanso por defeito</label>
      <div class="chips" style="margin:0">${[60, 90, 120, 150, 180, 240].map((v) => `<button class="chip ${st.rest === v ? 'on' : ''}" data-rest-v="${v}">${clock(v * 1000)}</button>`).join('')}</div>
      <label class="lbl">Incremento de carga (barra/máquina)</label>
      <div class="chips" style="margin:0">${[1.25, 2.5, 5].map((v) => `<button class="chip ${st.increment === v ? 'on' : ''}" data-inc-v="${v}">${fmt(v)} kg</button>`).join('')}</div>
      <label class="lbl">Chave da API Anthropic (coach com AI)</label>
      <input class="field" type="password" data-key placeholder="sk-ant-..." value="${esc(st.apiKey)}" autocomplete="off">
      <p class="muted small">Fica guardada só neste iPhone e é enviada apenas para api.anthropic.com. Cria uma chave em console.anthropic.com com um limite de gastos baixo. Cada pergunta custa uns cêntimos.</p>
      <label class="lbl">Dados</label>
      <div class="row"><button class="btn grow" data-act="export">Exportar backup</button><label class="btn grow">Importar<input type="file" accept="application/json" data-import hidden></label></div>
      <button class="btn danger block" style="margin-top:10px" data-act="wipe">Apagar todos os dados</button>
      <p class="muted small" style="margin-top:16px">Imagens dos exercícios: free-exercise-db (domínio público).</p>
    </div>`, { onClose: () => render() });
  sh.el.addEventListener('click', (e) => {
    const r = e.target.closest('[data-rest-v]'), i = e.target.closest('[data-inc-v]');
    if (r) { st.rest = +r.dataset.restV; sh.el.querySelectorAll('[data-rest-v]').forEach((c) => c.classList.toggle('on', c === r)); save(); haptic(); }
    if (i) { st.increment = +i.dataset.incV; sh.el.querySelectorAll('[data-inc-v]').forEach((c) => c.classList.toggle('on', c === i)); save(); haptic(); }
  });
  sh.el.addEventListener('change', async (e) => {
    if (e.target.matches('[data-key]')) { st.apiKey = e.target.value.trim(); save(); toast(st.apiKey ? 'Coach AI ligado ✨' : 'Chave removida'); }
    if (e.target.matches('[data-import]')) {
      try {
        const data = JSON.parse(await e.target.files[0].text());
        if (!Array.isArray(data.workouts)) throw new Error();
        if (confirm(`Importar ${data.workouts.length} treinos? Os dados atuais serão substituídos.`)) { replaceAll(data); toast('Backup importado ✓'); sh.close(); }
      } catch { toast('Ficheiro inválido'); }
    }
  });
}

function exportData() {
  const { apiKey, ...settings } = S().settings;
  const blob = new Blob([JSON.stringify({ ...S(), settings, active: null }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `gym-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

// ============ Wake lock (ecrã ligado durante o treino) ============
async function requestWakeLock() {
  try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
}
function releaseWakeLock() { wakeLock?.release().catch(() => {}); wakeLock = null; }
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && workoutEl) requestWakeLock(); });

// ============ Eventos globais ============
const actions = {
  tab: (d) => go(d.tab),
  start: () => startWorkout(),
  'open-workout': () => openWorkout(),
  'start-routine': (d) => startWorkout(S().routines.find((r) => r.id === d.id)),
  'routine-menu': (d) => {
    const r = S().routines.find((x) => x.id === d.id);
    if (r && confirm(`Apagar a rotina "${r.name}"?`)) { S().routines = S().routines.filter((x) => x.id !== d.id); save(); render(); }
  },
  'workout-detail': (d) => workoutDetail(d.id),
  'repeat-workout': (d) => startWorkout(null, S().workouts.find((w) => w.id === d.id)),
  'delete-workout': (d) => {
    if (!confirm('Apagar este treino?')) return;
    S().workouts = S().workouts.filter((w) => w.id !== d.id); save(); render();
  },
  'progress-ex': (d) => { progressEx = d.id; haptic(); render(); },
  'ex-detail': (d) => exerciseDetail(d.id),
  settings: () => openSettings(),
  quick: (d) => sendChat(d.q),
  'clear-chat': () => { if (confirm('Limpar a conversa?')) { S().chat = []; save(); render(); } },
  minimize: () => closeWorkout(),
  finish: () => finishWorkout(),
  discard: () => { if (confirm('Cancelar e apagar este treino?')) { S().active = null; save(); stopRest(); closeWorkout(); } },
  'add-ex': () => openPicker(),
  'ex-menu': (d) => exerciseMenu(+d.ei),
  'apply-suggest': (d) => applySuggest(+d.ei),
  tick: (d) => tick(+d.ei, +d.si),
  'add-set': (d) => {
    const sets = S().active.exercises[+d.ei].sets;
    const last = sets.at(-1);
    sets.push({ w: last?.w ?? null, r: last?.r ?? null, rpe: null, done: false });
    save(); haptic(); renderWorkout();
  },
  'remove-set': (d) => { S().active.exercises[+d.ei].sets.pop(); save(); renderWorkout(); },
  'save-routine': (d) => saveRoutine(d.id),
  export: () => exportData(),
  wipe: () => { if (confirm('Apagar TODOS os treinos, rotinas e definições? Isto não se desfaz.')) { resetAll(); location.reload(); } },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
  e.stopPropagation();
  fn(el.dataset);
});

document.addEventListener('submit', (e) => {
  if (e.target.dataset.form !== 'chat') return;
  e.preventDefault();
  const input = e.target.q;
  const v = input.value;
  input.value = '';
  sendChat(v);
});

// Relógios: duração do treino e descanso
ticker = setInterval(() => {
  const a = S().active;
  if (a) document.querySelectorAll('[data-elapsed]').forEach((el) => (el.textContent = clock(Date.now() - a.start)));
  if (rest) paintRest();
}, 500);

// ============ Arranque ============
(async function boot() {
  app.innerHTML = '<div class="empty" style="padding-top:40vh">A carregar…</div>';
  try { await loadExercises(); } catch { toast('Erro a carregar exercícios'); }
  render();
  if (S().active) openWorkout();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
