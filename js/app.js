import { store, save, uid, replaceAll, resetAll } from './store.js';
import { loadExercises, getEx, img, muscleName, MUSCLES, EQUIPMENT, MY_SPLIT } from './data.js';
import { suggest, history, bests, e1rm, volume, setCount, progressSeries, insights, askClaude, claudeErrorMessage } from './coach.js';
import { REGIONS, RECOMMEND, regionsFor, regionSets, regionStrength, volumeState, strengthState, aestheticScore, bodySvg, miniBody } from './body.js';
import { plan, weightTrend, weightAdvice, adonis, ACTIVITY, GOALS } from './nutrition.js';
import { esc, fmt, icon, sheet, toast, confetti, haptic, unlockAudio, beep, lineChart, countUp } from './ui.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const S = () => store();

let tab = 'home';
let progressEx = null;
let bodyMode = 'volume';
let workoutEl = null;
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
const dec = (n) => fmt(n).replace('.', ',');
const half = (n) => dec(Math.round(n * 2) / 2);

function streakWeeks(workouts) {
  const weeks = new Set(workouts.map((w) => weekStart(w.start)));
  let wk = weekStart(Date.now());
  if (!weeks.has(wk)) wk = weekStart(wk - 3 * DAY); // não somar 7 dias à mão: falha na mudança de hora
  let n = 0;
  while (weeks.has(wk)) { n++; wk = weekStart(wk - 3 * DAY); }
  return n;
}

const thumb = (id) => `<span class="thumb"><img src="${img(id, 0)}" alt="" loading="lazy"><img src="${img(id, 1)}" alt="" loading="lazy"></span>`;

function ring(pct, { size = 84, stroke = 8, color = 'var(--accent)', label = '', sub = '' } = {}) {
  const r = (size - stroke) / 2, C = 2 * Math.PI * r, k = Math.max(0, Math.min(1, pct));
  return `<div class="ring-box" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" style="transform:rotate(-90deg)"><circle cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="var(--surface-3)" stroke-width="${stroke}" fill="none"/>
    <circle class="ring-arc" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke="${color}" stroke-width="${stroke}" fill="none" stroke-linecap="round" stroke-dasharray="${C}" style="--c:${C};--off:${C * (1 - k)}"/></svg>
    <div class="ring-label"><b>${label}</b>${sub ? `<span>${sub}</span>` : ''}</div></div>`;
}

// ============ Navegação ============
function go(next) {
  if (tab === next) return;
  tab = next;
  haptic();
  if (document.startViewTransition) document.startViewTransition(render); else render();
  window.scrollTo({ top: 0 });
}

function render() {
  const screens = { home: renderHome, body: renderBody, progress: renderProgress, history: renderHistory, coach: renderCoach };
  app.innerHTML = `<div class="bg-glow"></div><main class="screen">${screens[tab]()}</main>${tabbar()}${resumeBar()}${tab === 'coach' ? composer() : ''}`;
  countUp(app);
  if (tab === 'coach' && S().chat.length) $('.chat-end')?.scrollIntoView();
}

function tabbar() {
  const t = (id, label, ic) => `<button class="tab ${tab === id ? 'on' : ''}" data-act="tab" data-tab="${id}">${ic}<span>${label}</span></button>`;
  return `<nav class="tabbar">${t('home', 'Início', icon.home)}${t('body', 'Corpo', icon.body)}${t('progress', 'Progresso', icon.chart)}${t('history', 'Histórico', icon.history)}${t('coach', 'Coach', icon.coach)}</nav>`;
}

function resumeBar() {
  const a = S().active;
  if (!a || workoutEl) return '';
  return `<button class="resume" data-act="open-workout"><span class="pulse"></span><span class="grow ellipsis" style="text-align:left"><b>${esc(a.name)}</b><br><span class="muted small">Treino em curso</span></span><span class="elapsed num" data-elapsed>${clock(Date.now() - a.start)}</span></button>`;
}

// ============ Início ============
function nextRoutine() {
  const { routines, workouts } = S();
  if (!routines.length) return null;
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i];
    const idx = routines.findIndex((r) => r.id === w.routineId || r.name === w.name);
    if (idx >= 0) return routines[(idx + 1) % routines.length];
  }
  return routines[0];
}

function routineRegions(r) {
  const out = {};
  r.exercises.forEach((e) => Object.entries(regionsFor(e.exId)).forEach(([k, v]) => { if (v >= 1) out[k] = 1; }));
  return out;
}

function renderHome() {
  const { workouts, routines, active } = S();
  const h = new Date().getHours();
  const hi = h < 6 ? 'Boa noite' : h < 12 ? 'Bom dia' : h < 20 ? 'Boa tarde' : 'Boa noite';
  const ws = weekStart(Date.now());
  const week = workouts.filter((w) => w.start >= ws);
  const vol = week.reduce((t, w) => t + volume(w), 0);
  const next = nextRoutine();
  const recent = workouts.slice(-3).reverse();
  const days = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'];
  const today = (new Date().getDay() + 6) % 7;
  const trained = new Set(week.map((w) => (new Date(w.start).getDay() + 6) % 7));

  let hero;
  if (active) {
    hero = `<button class="hero" data-act="open-workout"><div><span class="hero-eyebrow">EM CURSO</span><b>${esc(active.name)}</b><span class="num" data-elapsed>${clock(Date.now() - active.start)}</span></div><div class="arrow">${icon.arrow}</div></button>`;
  } else if (next) {
    const regs = routineRegions(next);
    const sets = next.exercises.reduce((t, e) => t + e.sets, 0);
    hero = `<div class="next-card">
      <div class="next-info">
        <span class="hero-eyebrow">PRÓXIMO TREINO</span>
        <h2 class="next-name">${esc(next.name)}</h2>
        <div class="muted small">${next.exercises.length} exercícios · ${sets} séries · ~${Math.round(sets * 2.6)} min</div>
        <div class="tags">${Object.keys(regs).slice(0, 5).map((r) => `<span class="tag">${esc(REGIONS[r].name)}</span>`).join('')}</div>
      </div>
      <div class="next-body">${miniBody(regs)}</div>
      <button class="btn primary block start-btn" data-act="start-routine" data-id="${next.id}">Começar ${icon.arrow}</button>
    </div>`;
  } else {
    hero = `<button class="hero" data-act="start"><div><b>Começar treino</b><span>Treino livre</span></div><div class="arrow">${icon.arrow}</div></button>`;
  }

  return `
    <div class="top">
      <div><div class="eyebrow">${esc(dateLong(Date.now()))}</div><h1>${hi}</h1></div>
      <button class="icon-btn" data-act="settings" aria-label="Definições">${icon.gear}</button>
    </div>
    <div class="week-strip">${days.map((d, i) => `<div class="day ${trained.has(i) ? 'on' : ''} ${i === today ? 'today' : ''}"><span>${d}</span><i></i></div>`).join('')}</div>
    ${hero}
    <div class="stats">
      <div class="stat"><b class="num" data-count="${week.length}">0</b><span>treinos na semana</span></div>
      <div class="stat"><b class="num">${vol >= 1000 ? `<i data-count="${Math.round(vol / 100) / 10}" data-dec="1">0</i>t` : `<i data-count="${Math.round(vol)}">0</i>`}</b><span>${vol >= 1000 ? 'volume semanal' : 'kg de volume'}</span></div>
      <div class="stat"><b class="num"><i data-count="${streakWeeks(workouts)}">0</i> 🔥</b><span>semanas seguidas</span></div>
    </div>
    <div class="section-head"><h2>O teu split</h2><button class="btn ghost sm" data-act="new-routine">${icon.plus} Nova</button></div>
    <div class="routine-grid">${routines.map((r) => `
      <div class="routine ${next && r.id === next.id && !active ? 'is-next' : ''}">
        <button class="routine-main" data-act="start-routine" data-id="${r.id}">
          <b class="ellipsis">${esc(r.name)}</b>
          <span class="muted small">${r.exercises.length} exercícios</span>
          <span class="thumbs">${r.exercises.slice(0, 4).map((e) => thumb(e.exId)).join('')}</span>
        </button>
        <button class="routine-edit" data-act="edit-routine" data-id="${r.id}" aria-label="Editar">${icon.edit}</button>
      </div>`).join('')}
      <button class="routine free" data-act="start"><span class="free-plus">${icon.plus}</span><b>Treino livre</b></button>
    </div>
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

// ============ Corpo ============
function bodyData() {
  const { workouts } = S();
  const sets = regionSets(workouts, Date.now() - 7 * DAY);
  const strength = regionStrength(workouts);
  return { sets, strength };
}

function priorities(sets) {
  return Object.entries(REGIONS)
    .map(([r, cfg]) => ({ r, cfg, s: sets[r] || 0, gap: Math.max(0, cfg.min - (sets[r] || 0)) / cfg.min * (cfg.aesthetic ? 1.5 : 1) }))
    .filter((x) => x.gap > 0 && !['forearms', 'adductors', 'lower-back', 'obliques'].includes(x.r))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, 4);
}

function renderBody() {
  const { weights, measures, profile } = S();
  const { sets, strength } = bodyData();
  const states = Object.fromEntries(Object.keys(REGIONS).map((r) => [r, bodyMode === 'volume' ? volumeState(r, sets[r]) : strengthState(strength[r])]));
  const score = aestheticScore(sets);
  const prio = priorities(sets);
  const lastW = weights.at(-1);
  const p = plan(profile, lastW?.kg);
  const trend = weightTrend(weights);
  const adv = weightAdvice(p, trend);
  const lastM = measures.at(-1);
  const ad = adonis(lastM);
  const legend = bodyMode === 'volume'
    ? [['low', 'Muito pouco'], ['mid', 'Abaixo'], ['good', 'Ideal'], ['high', 'Muito']]
    : [['low', 'A descer'], ['mid', 'Estagnado'], ['good', 'A subir'], ['none', 'Sem dados']];

  return `<div class="top"><div><div class="eyebrow">Análise muscular</div><h1>Corpo</h1></div>
      <button class="icon-btn" data-act="profile" aria-label="Perfil">${icon.user}</button></div>
    <div class="segmented" style="--i:${bodyMode === 'volume' ? 0 : 1}">
      <span class="seg-pill"></span>
      <button class="${bodyMode === 'volume' ? 'on' : ''}" data-act="body-mode" data-mode="volume">Volume · 7 dias</button>
      <button class="${bodyMode === 'strength' ? 'on' : ''}" data-act="body-mode" data-mode="strength">Força · 6 semanas</button>
    </div>
    <div class="card body-card">
      ${bodySvg(states)}
      <div class="legend">${legend.map(([k, l]) => `<span><i class="dot ${k}"></i>${l}</span>`).join('')}</div>
      <p class="muted small center" style="margin:6px 0 0">Toca num músculo para ver detalhes</p>
    </div>

    <div class="card score-card">
      ${ring(score / 100, { label: `<i data-count="${score}">0</i>`, sub: '/100', color: score >= 75 ? 'var(--accent)' : score >= 45 ? 'var(--warn)' : 'var(--danger)' })}
      <div class="grow"><b>Score estético</b><p class="muted small" style="margin:4px 0 0">Quão perto está cada músculo do volume ideal esta semana. Ombros laterais, peito superior, dorsais, braços e abs contam a dobrar.</p></div>
    </div>

    ${prio.length ? `<h2>Onde focar esta semana</h2><div class="card">${prio.map((x) => `
      <button class="prio" data-act="region" data-r="${x.r}">
        <span class="prio-bar"><i style="--h:${Math.max(6, Math.min(100, (x.s / x.cfg.min) * 100))}%"></i></span>
        <span class="grow"><b>${esc(x.cfg.name)}</b>${x.cfg.aesthetic ? '<span class="aes">✦ estética</span>' : ''}<br><span class="muted small">${half(x.s)} de ${x.cfg.min}–${x.cfg.max} séries · faz ${esc(getEx(RECOMMEND[x.r][0]).name)}</span></span>
        <span class="muted">›</span>
      </button>`).join('')}</div>` : ''}

    <div class="section-head"><h2>Peso corporal</h2><button class="btn ghost sm" data-act="log-weight">${icon.plus} Registar</button></div>
    <div class="card">
      ${lastW ? `<div class="row between"><div><b class="big-num num">${dec(lastW.kg)}<small> kg</small></b><div class="muted small">${dateShort(lastW.t)}</div></div>
        ${trend ? `<span class="chip" style="background:var(--accent-soft);color:var(--accent)">${trend.rate >= 0 ? '▲' : '▼'} ${dec(Math.abs(Math.round(trend.rate * 100) / 100))} kg/sem</span>` : ''}</div>
        <div style="margin-top:10px">${lineChart(weights.slice(-30).map((w) => ({ t: w.t, y: w.kg })), { h: 140 })}</div>`
      : `<p class="muted small" style="margin:0">Regista o teu peso para o coach calcular o plano para ganhar massa e ver se estás a evoluir ao ritmo certo.</p>`}
      ${adv ? `<div class="advice ${adv.tone}"><b>${esc(adv.title)}</b><span>${esc(adv.text)}</span></div>` : ''}
    </div>

    <div class="section-head"><h2>Plano para ganhar massa</h2><button class="btn ghost sm" data-act="profile">Perfil</button></div>
    ${p ? `<div class="card">
      <div class="row between"><div><span class="muted small">Calorias por dia</span><b class="big-num num" style="display:block"><i data-count="${p.kcal}">0</i><small> kcal</small></b></div>
      <div class="muted small" style="text-align:right">Manutenção ≈ ${p.tdee}<br>${p.goal === 'bulk' ? '+300 superávit' : p.goal === 'cut' ? '−450 défice' : 'manutenção'}</div></div>
      <div class="macros">
        ${[['Proteína', p.protein, 4, '#c6ff3d'], ['Hidratos', p.carbs, 4, '#7dd3fc'], ['Gordura', p.fat, 9, '#ffb547']].map(([n, g, k, c]) => `
          <div class="macro"><div class="row between"><span>${n}</span><b class="num">${g} g</b></div><div class="track"><i style="width:${(g * k / p.kcal) * 100}%;background:${c}"></i></div></div>`).join('')}
      </div>
      <ul class="tips">
        <li><b>${p.protein} g de proteína</b>: divide por 4 refeições (~${Math.round(p.protein / 4)} g cada).</li>
        <li>Ritmo ideal: <b>${p.goal === 'bulk' ? '+' : ''}${dec(Math.round(p.rate[0] * 100) / 100)} a ${dec(Math.round(p.rate[1] * 100) / 100)} kg por semana</b>.</li>
        <li>Dorme 7–9 h: é quando o músculo cresce.</li>
        <li>Progressão de carga em cada treino: segue as sugestões do coach.</li>
      </ul>
    </div>` : `<div class="card"><p class="muted small" style="margin-top:0">Preenche o teu perfil (idade, altura, atividade) e regista o peso para calcular calorias e macros.</p><button class="btn primary sm" data-act="profile">Configurar perfil</button></div>`}

    <div class="section-head"><h2>Medidas e proporções</h2><button class="btn ghost sm" data-act="log-measures">${icon.plus} Registar</button></div>
    <div class="card">
      ${lastM ? `<div class="score-card" style="padding:0;border:0;background:none">
        ${ad ? ring(ad / 1.618, { label: dec(Math.round(ad * 100) / 100), sub: 'V-taper', color: ad >= 1.5 ? 'var(--accent)' : 'var(--warn)' }) : ''}
        <div class="grow"><b>Índice de Adónis</b><p class="muted small" style="margin:4px 0 0">Ombros ÷ cintura. O ideal estético é 1,618 (proporção áurea).${ad ? ` Faltam ${Math.max(0, Math.round(lastM.waist * 1.618 - lastM.shoulders))} cm de ombros para lá chegares com esta cintura.` : ''}</p></div></div>
        <div class="measure-grid">${[['shoulders', 'Ombros'], ['chest', 'Peito'], ['waist', 'Cintura'], ['arm', 'Braço'], ['thigh', 'Coxa']].map(([k, l]) => {
          const prev = [...measures].reverse().find((m, i) => i > 0 && m[k]);
          const d = prev && lastM[k] ? lastM[k] - prev[k] : 0;
          return `<div><span class="muted small">${l}</span><b class="num">${lastM[k] ? dec(lastM[k]) : '–'}</b>${d ? `<span class="small" style="color:${(k === 'waist' ? d < 0 : d > 0) ? 'var(--accent)' : 'var(--danger)'}">${d > 0 ? '+' : ''}${dec(Math.round(d * 10) / 10)}</span>` : ''}</div>`;
        }).join('')}</div>`
      : `<p class="muted small" style="margin:0">Mede ombros, cintura e braço uma vez por mês: é a melhor forma de ver progresso estético além do espelho.</p>`}
    </div>`;
}

function regionSheet(r) {
  const cfg = REGIONS[r];
  const { workouts } = S();
  const { sets, strength } = bodyData();
  const s = sets[r] || 0;
  const st = volumeState(r, s);
  const tr = strength[r];
  const mine = {};
  for (const w of workouts.slice(-30)) for (const e of w.exercises) if ((regionsFor(e.exId)[r] || 0) >= 1) mine[e.exId] = (mine[e.exId] || 0) + 1;
  const mineIds = Object.keys(mine).sort((a, b) => mine[b] - mine[a]).slice(0, 4);
  const recs = RECOMMEND[r].filter((id) => !mineIds.includes(id)).slice(0, 3);
  const msg = {
    none: `Ainda não treinaste ${cfg.name.toLowerCase()} esta semana. Faz ${cfg.min}–${cfg.max} séries para crescer.`,
    low: `Faltam ${Math.ceil(cfg.min - s)} séries para o mínimo eficaz (${cfg.min}). Este músculo está a ficar para trás.`,
    mid: `Quase lá: faltam ${Math.ceil(cfg.min - s)} séries para chegares às ${cfg.min}.`,
    good: 'Volume no ponto. Foca-te em subir cargas ou reps em cada sessão.',
    high: `Volume muito alto (>${cfg.max}). Mais séries não é mais músculo: pode estar a atrasar a recuperação.`,
  }[st];
  sheet(`
    <div class="head"><div><h3>${esc(cfg.name)}</h3>${cfg.aesthetic ? '<span class="aes">✦ prioridade estética</span>' : ''}</div><button class="icon-btn" data-close>${icon.close}</button></div>
    <div class="body">
      <div class="kv"><div><b class="num">${half(s)}</b><span>séries (7 dias)</span></div><div><b class="num">${cfg.min}–${cfg.max}</b><span>ideal/semana</span></div><div><b class="num" style="color:${tr == null ? 'inherit' : tr >= 1.5 ? 'var(--accent)' : tr < -1 ? 'var(--danger)' : 'var(--warn)'}">${tr == null ? '–' : `${tr > 0 ? '+' : ''}${dec(Math.round(tr * 10) / 10)}%`}</b><span>força 6 sem.</span></div></div>
      <div class="vol-track"><i class="${st}" style="width:${Math.min(100, (s / (cfg.max * 1.2)) * 100)}%"></i><span style="left:${(cfg.min / (cfg.max * 1.2)) * 100}%"></span><span style="left:${(cfg.max / (cfg.max * 1.2)) * 100}%"></span></div>
      <div class="advice ${st === 'good' ? 'good' : st === 'high' ? 'info' : 'warn'}"><span>${esc(msg)}</span></div>
      ${tr != null && tr < 0 ? `<div class="advice warn"><span>A força está a descer. Verifica sono, calorias (estás em superávit?) e considera uma semana de deload.</span></div>` : ''}
      ${mineIds.length ? `<h2>Os teus exercícios</h2>${mineIds.map((id) => exRow(id)).join('')}` : ''}
      <h2>Recomendados</h2>${recs.map((id) => exRow(id)).join('')}
    </div>`);
}

function exRow(id) {
  const b = bests(S().workouts, id);
  const ex = getEx(id);
  return `<button class="ex-row" data-act="ex-detail" data-id="${id}">${thumb(id)}<span class="grow"><b class="ellipsis" style="display:block">${esc(ex.name)}</b><span class="muted small">${b.w ? `Melhor: ${dec(b.w)} kg · 1RM ${Math.round(b.e)}` : esc(EQUIPMENT[ex.equipment] || '')}</span></span><span class="muted">›</span></button>`;
}

function openProfile() {
  const pr = S().profile;
  const sh = sheet(`
    <div class="head"><h3>O teu perfil</h3><button class="btn primary sm" data-save>Guardar</button></div>
    <div class="body">
      <label class="lbl">Sexo</label>
      <div class="chips wrap" data-group="sex">${[['m', 'Masculino'], ['f', 'Feminino']].map(([v, l]) => `<button class="chip ${(pr.sex || 'm') === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
      <div class="grid2">
        <div><label class="lbl">Idade</label><input class="field" inputmode="numeric" data-f="age" value="${pr.age || ''}" placeholder="anos"></div>
        <div><label class="lbl">Altura</label><input class="field" inputmode="numeric" data-f="height" value="${pr.height || ''}" placeholder="cm"></div>
      </div>
      <label class="lbl">Peso atual</label><input class="field" inputmode="decimal" data-f="weight" value="${S().weights.at(-1)?.kg ?? ''}" placeholder="kg">
      <label class="lbl">Nível de atividade</label>
      <div class="chips wrap" data-group="activity">${ACTIVITY.map((a) => `<button class="chip ${(pr.activity || 1.55) === a.v ? 'on' : ''}" data-v="${a.v}">${a.label} <span class="muted">· ${a.hint}</span></button>`).join('')}</div>
      <label class="lbl">Objetivo</label>
      <div class="chips wrap" data-group="goal">${GOALS.map((g) => `<button class="chip ${(pr.goal || 'bulk') === g.v ? 'on' : ''}" data-v="${g.v}">${g.label}</button>`).join('')}</div>
    </div>`);
  const sel = { sex: pr.sex || 'm', activity: pr.activity || 1.55, goal: pr.goal || 'bulk' };
  sh.el.addEventListener('click', (e) => {
    const c = e.target.closest('[data-group] .chip');
    if (c) {
      const g = c.parentElement.dataset.group;
      sel[g] = g === 'activity' ? +c.dataset.v : c.dataset.v;
      c.parentElement.querySelectorAll('.chip').forEach((x) => x.classList.toggle('on', x === c));
      haptic();
    }
    if (e.target.closest('[data-save]')) {
      const v = (f) => num($(`[data-f=${f}]`, sh.el).value);
      S().profile = { ...sel, age: v('age'), height: v('height') };
      const kg = v('weight');
      if (kg && kg !== S().weights.at(-1)?.kg) S().weights.push({ t: Date.now(), kg });
      save(); sh.close(); render(); toast('Perfil guardado ✓');
    }
  });
}

function logWeight() {
  const last = S().weights.at(-1);
  const sh = sheet(`
    <div class="head"><h3>Registar peso</h3><button class="btn primary sm" data-save>Guardar</button></div>
    <div class="body">
      <div class="big-input"><input inputmode="decimal" data-kg value="${last ? dec(last.kg) : ''}" placeholder="0,0"><span>kg</span></div>
      <p class="muted small center">De manhã, em jejum, depois da casa de banho.</p>
      ${S().weights.length ? `<h2>Registos</h2>${[...S().weights].reverse().slice(0, 10).map((w, i) => `<div class="list-item"><span class="muted">${dateShort(w.t)}</span><b class="num">${dec(w.kg)} kg</b><button class="btn sm" data-del="${S().weights.length - 1 - i}">${icon.trash}</button></div>`).join('')}` : ''}
    </div>`);
  sh.el.addEventListener('click', (e) => {
    const d = e.target.closest('[data-del]');
    if (d) { S().weights.splice(+d.dataset.del, 1); save(); sh.close(); render(); return; }
    if (!e.target.closest('[data-save]')) return;
    const kg = num($('[data-kg]', sh.el).value);
    if (!kg || kg < 30 || kg > 300) return toast('Peso inválido');
    const ws = S().weights;
    const today = new Date().toDateString();
    if (ws.length && new Date(ws.at(-1).t).toDateString() === today) ws.at(-1).kg = kg; else ws.push({ t: Date.now(), kg });
    save(); haptic(); sh.close(); render(); toast('Peso registado ✓');
  });
}

function logMeasures() {
  const last = S().measures.at(-1) || {};
  const fields = [['shoulders', 'Ombros', 'à volta, no ponto mais largo'], ['chest', 'Peito', 'na linha dos mamilos'], ['waist', 'Cintura', 'no umbigo, relaxado'], ['arm', 'Braço', 'contraído, no pico do bíceps'], ['thigh', 'Coxa', 'no ponto mais largo']];
  const sh = sheet(`
    <div class="head"><h3>Medidas (cm)</h3><button class="btn primary sm" data-save>Guardar</button></div>
    <div class="body">${fields.map(([k, l, h]) => `<label class="lbl">${l} <span class="muted">· ${h}</span></label><input class="field" inputmode="decimal" data-m="${k}" placeholder="${last[k] ? dec(last[k]) : 'cm'}">`).join('')}</div>`);
  sh.el.addEventListener('click', (e) => {
    if (!e.target.closest('[data-save]')) return;
    const m = { t: Date.now() };
    sh.el.querySelectorAll('[data-m]').forEach((i) => { m[i.dataset.m] = num(i.value) ?? last[i.dataset.m] ?? null; });
    S().measures.push(m);
    save(); sh.close(); render(); toast('Medidas guardadas ✓');
  });
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
          ${e.sets.map((s, i) => `<div class="list-item num"><span class="muted">Série ${i + 1}</span><span>${dec(s.w)} kg × ${s.r}${s.rpe ? ` <span class="muted">@${dec(s.rpe)}</span>` : ''}${s.pr ? '<span class="pr-tag">PR</span>' : ''}</span></div>`).join('')}
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
  const sg = suggest(workouts, progressEx, S().settings.increment);

  return `<div class="top"><div><div class="eyebrow">Evolução</div><h1>Progresso</h1></div></div>
    <div class="chips">${ids.map((id) => `<button class="chip ${id === progressEx ? 'on' : ''}" data-act="progress-ex" data-id="${id}">${esc(getEx(id).name)}</button>`).join('')}</div>
    <div class="card" style="margin-top:14px">
      <div class="row between"><div><div class="muted small">1RM estimado</div><b class="big-num num"><i data-count="${Math.round(last)}">0</i><small> kg</small></b></div>
      ${series.length > 1 ? `<span class="chip" style="background:${delta >= 0 ? 'var(--accent-soft)' : 'rgba(255,92,92,.12)'};color:${delta >= 0 ? 'var(--accent)' : 'var(--danger)'}">${delta >= 0 ? '▲' : '▼'} ${dec(Math.abs(Math.round(delta * 10) / 10))}%</span>` : ''}</div>
      <div style="margin-top:10px">${lineChart(series.map((s) => ({ t: s.date, y: s.e1rm })))}</div>
    </div>
    ${sg ? `<div class="suggest ${sg.kind === 'deload' ? 'deload' : ''}" style="margin-top:12px"><span class="badge">PRÓXIMO</span><span class="grow">${esc(sg.why)}</span><b class="num">${dec(sg.w)}×${sg.r}</b></div>` : ''}
    <div class="kv"><div><b class="num">${dec(b.w)}</b><span>kg máximo</span></div><div><b class="num">${Math.round(b.e)}</b><span>melhor 1RM est.</span></div><div><b class="num">${series.length}</b><span>sessões</span></div></div>
    <button class="btn block" data-act="ex-detail" data-id="${progressEx}">Ver demonstração do exercício</button>
    <h2>Últimas sessões</h2>
    <div class="card">${series.slice(-8).reverse().map((s) => `<div class="list-item num"><span class="muted">${dateShort(s.date)}</span><span>${dec(s.best.w)} kg × ${s.best.r}</span><span class="muted small">1RM ${Math.round(s.e1rm)}</span></div>`).join('')}</div>`;
}

// ============ Coach ============
const QUICK = [
  'Analisa a minha última semana',
  'O que faço para ganhar mais massa?',
  'Em que músculo estou mais atrasado?',
  'Que cargas faço no próximo treino?',
];

function aiContext() {
  const { profile, weights, measures, routines } = S();
  const { sets } = bodyData();
  const p = plan(profile, weights.at(-1)?.kg);
  const tr = weightTrend(weights);
  const lines = [];
  if (profile.age) lines.push(`Perfil: ${profile.sex === 'f' ? 'mulher' : 'homem'}, ${profile.age} anos, ${profile.height} cm, objetivo ${profile.goal}.`);
  if (weights.length) lines.push(`Peso: ${weights.at(-1).kg} kg${tr ? `, tendência ${Math.round(tr.rate * 100) / 100} kg/semana` : ''}.`);
  if (p) lines.push(`Plano calculado: ${p.kcal} kcal, ${p.protein} g proteína, ${p.carbs} g hidratos, ${p.fat} g gordura.`);
  if (measures.length) { const m = measures.at(-1); lines.push(`Medidas (cm): ombros ${m.shoulders}, peito ${m.chest}, cintura ${m.waist}, braço ${m.arm}, coxa ${m.thigh}.`); }
  lines.push(`Séries por músculo nos últimos 7 dias: ${Object.entries(REGIONS).map(([r, c]) => `${c.name} ${Math.round((sets[r] || 0) * 10) / 10} (ideal ${c.min}-${c.max})`).join('; ')}.`);
  if (routines.length) lines.push(`Split: ${routines.map((r) => `${r.name} = ${r.exercises.map((e) => `${getEx(e.exId).name} ${e.sets}x`).join(', ')}`).join(' | ')}.`);
  return lines.join('\n');
}

function renderCoach() {
  const { workouts, chat, settings } = S();
  const ins = insights(workouts);
  return `<div class="top"><div><div class="eyebrow">Inteligência</div><h1>Coach</h1></div>
      ${chat.length ? `<button class="btn sm" data-act="clear-chat">Limpar</button>` : ''}</div>
    ${ins.length ? `<div class="stack">${ins.map((x, i) => `<div class="card insight ${x.tone}" style="animation-delay:${i * 0.07}s"><div class="ico">${x.icon}</div><div><b>${esc(x.title)}</b><div class="muted small" style="margin-top:2px">${esc(x.text)}</div></div></div>`).join('')}</div>`
      : `<div class="card muted small">Faz o teu primeiro treino e o coach começa a analisar a tua progressão, plateaus e equilíbrio muscular.</div>`}
    <h2>Pergunta ao coach</h2>
    ${!settings.apiKey ? `<div class="card ai-card"><b>Liga o coach com AI ✨</b><p class="muted small">O chat usa o Claude e lê o teu histórico, peso, medidas e split para responder. Precisas de uma chave da API da Anthropic (console.anthropic.com). Os insights acima funcionam sempre, mesmo sem chave e offline.</p><button class="btn primary sm" data-act="settings">Adicionar chave</button></div>` : ''}
    ${!chat.length && settings.apiKey ? `<div class="chips wrap">${QUICK.map((q) => `<button class="chip" data-act="quick" data-q="${esc(q)}">${esc(q)}</button>`).join('')}</div>` : ''}
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
      apiKey: s.settings.apiKey, workouts: s.workouts, chat: s.chat, context: aiContext(),
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
    id: uid(), start: Date.now(), routineId: routine?.id || fromWorkout?.routineId || null,
    name: routine?.name || fromWorkout?.name || `Treino de ${day}`,
    exercises: (src || []).map((e) => newEntry(e.exId, e.sets)),
  };
  save();
  haptic();
  openWorkout();
  if (!src) openPicker({ title: 'Adicionar exercícios', onPick: addToWorkout });
}

function addToWorkout(ids) {
  const a = S().active;
  ids.forEach((id) => a.exercises.push(newEntry(id)));
  save(); renderWorkout();
  setTimeout(() => workoutEl?.scrollTo({ top: workoutEl.scrollHeight, behavior: 'smooth' }), 300);
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
  const total = a.exercises.reduce((t, e) => t + e.sets.length, 0);
  const doneN = a.exercises.reduce((t, e) => t + e.sets.filter((s) => s.done).length, 0);
  workoutEl.innerHTML = `
    <div class="workout-head">
      <button class="icon-btn" data-act="minimize" aria-label="Minimizar">${icon.down}</button>
      <div class="grow"><input class="workout-title" data-field="name" value="${esc(a.name)}" aria-label="Nome do treino"><div class="elapsed num"><span data-elapsed>${clock(Date.now() - a.start)}</span> · ${doneN}/${total} séries</div></div>
      <button class="btn primary sm" data-act="finish">Terminar</button>
    </div>
    <div class="w-progress"><i style="width:${total ? (doneN / total) * 100 : 0}%"></i></div>
    <div class="content">
      ${a.exercises.map(exerciseCard).join('')}
      ${!a.exercises.length ? `<div class="empty"><div class="big">➕</div>Adiciona o primeiro exercício</div>` : ''}
      <button class="btn block" style="margin-top:18px;color:var(--accent)" data-act="add-ex">${icon.plus} Adicionar exercício</button>
      <button class="btn ghost block" style="margin-top:6px;color:var(--danger)" data-act="discard">Cancelar treino</button>
    </div>`;
  workoutEl.scrollTop = scroll;
}

function exerciseCard(entry, ei) {
  const { workouts, settings } = S();
  const ex = getEx(entry.exId);
  const prev = history(workouts, entry.exId)[0];
  const sg = suggest(workouts, entry.exId, settings.increment);
  const allDone = entry.sets.length && entry.sets.every((s) => s.done);
  const ph = (i, k) => {
    if (sg && k === 'w') return dec(sg.w);
    if (sg && k === 'r') return sg.r;
    const p = prev?.sets[i] || prev?.sets.at(-1);
    return p ? dec(p[k]) : k === 'w' ? 'kg' : 'reps';
  };
  return `<div class="card ex-card ${allDone ? 'complete' : ''}" data-ei="${ei}">
    <div class="ex-top">
      <button data-act="ex-detail" data-id="${ex.id}">${thumb(ex.id)}</button>
      <div class="grow"><button class="ex-name" data-act="ex-detail" data-id="${ex.id}">${esc(ex.name)}</button><div class="muted small">${esc(ex.primary.map(muscleName).join(', '))}</div></div>
      <button class="icon-btn" data-act="ex-menu" data-ei="${ei}" aria-label="Opções">${icon.dots}</button>
    </div>
    ${sg ? `<button class="suggest ${sg.kind === 'deload' ? 'deload' : ''}" data-act="apply-suggest" data-ei="${ei}"><span class="badge">COACH</span><span class="grow">${esc(sg.why)}</span><b class="num">${dec(sg.w)}×${sg.r}</b></button>` : ''}
    <table class="sets">
      <thead><tr><th>Série</th><th>Anterior</th><th>kg</th><th>Reps</th><th>RPE</th><th></th></tr></thead>
      <tbody>${entry.sets.map((s, si) => {
        const p = prev?.sets[si];
        return `<tr class="set ${s.done ? 'done' : ''} ${s.pr ? 'pr' : ''}" data-si="${si}">
          <td>${si + 1}${s.pr ? '<span class="pr-tag">PR</span>' : ''}</td>
          <td class="prev num">${p ? `${dec(p.w)}×${p.r}` : '–'}</td>
          <td><input class="num" inputmode="decimal" data-field="w" data-ei="${ei}" data-si="${si}" value="${s.w == null ? '' : dec(s.w)}" placeholder="${ph(si, 'w')}"></td>
          <td><input class="num" inputmode="numeric" data-field="r" data-ei="${ei}" data-si="${si}" value="${fmt(s.r)}" placeholder="${ph(si, 'r')}"></td>
          <td class="rpe"><input class="num" inputmode="decimal" data-field="rpe" data-ei="${ei}" data-si="${si}" value="${s.rpe == null ? '' : dec(s.rpe)}" placeholder="–"></td>
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
  const row = workoutEl.querySelector(`.ex-card[data-ei="${ei}"] tr[data-si="${si}"]`);
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
    toast(`🏆 Novo recorde: ${dec(w)} kg × ${r}`, 'gold');
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
  const w = { id: a.id, name: a.name.trim() || 'Treino', routineId: a.routineId || null, start: a.start, end: Date.now(), exercises };
  s.workouts.push(w);
  s.active = null;
  save();
  stopRest();
  closeWorkout();
  const prs = exercises.flatMap((e) => e.sets.filter((x) => x.pr).map((x) => ({ ...x, exId: e.exId })));
  if (prs.length) setTimeout(confetti, 350);
  const regs = {};
  exercises.forEach((e) => Object.entries(regionsFor(e.exId)).forEach(([k, v]) => { if (v >= 1) regs[k] = 1; }));
  const sh = sheet(`
    <div class="head"><h3>Treino concluído 🎉</h3><button class="icon-btn" data-close>${icon.close}</button></div>
    <div class="body">
      <div class="done-body">${miniBody(regs)}</div>
      <div class="kv"><div><b>${duration(w.end - w.start)}</b><span>duração</span></div><div><b>${tons(volume(w))}</b><span>volume</span></div><div><b>${setCount(w)}</b><span>séries</span></div></div>
      ${prs.length ? `<div class="card" style="border-color:rgba(255,212,59,.35)"><b style="color:var(--gold)">🏆 ${prs.length} recorde${prs.length > 1 ? 's' : ''} pessoal${prs.length > 1 ? 'is' : ''}</b>${prs.map((p) => `<div class="list-item"><span>${esc(getEx(p.exId).name)}</span><b class="num">${dec(p.w)} × ${p.r}</b></div>`).join('')}</div>` : ''}
      ${!w.routineId ? `<button class="btn primary block" style="margin-top:14px" data-act="save-routine" data-id="${w.id}">Guardar como rotina</button>` : ''}
      <button class="btn block" style="margin-top:8px" data-close>Fechar</button>
    </div>`);
  sh.el.addEventListener('click', (e) => { if (e.target.closest('[data-act=save-routine]')) sh.close(); });
}

function saveRoutine(workoutId) {
  const w = S().workouts.find((x) => x.id === workoutId);
  if (!w) return;
  const name = prompt('Nome da rotina', w.name);
  if (!name) return;
  const r = { id: uid(), name, exercises: w.exercises.map((e) => ({ exId: e.exId, sets: e.sets.length })) };
  S().routines.push(r);
  w.routineId = r.id;
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
    <div class="grow"><b>${left > 0 ? 'Descanso' : 'Bora!'}</b><div class="muted small">${left > 0 ? 'Respira' : 'Próxima série'}</div></div>
    ${left > 0 ? `<button class="btn sm" data-rest="-15">−15</button><button class="btn sm" data-rest="15">+15</button><button class="btn sm" data-rest="skip">Saltar</button>` : ''}`;
}

// ============ Páginas de ecrã inteiro ============
function page(html) {
  const el = document.createElement('div');
  el.className = 'page';
  el.innerHTML = html;
  document.body.append(el);
  const close = () => { el.classList.add('closing'); setTimeout(() => el.remove(), 280); };
  el.addEventListener('click', (e) => { if (e.target.closest('[data-back]')) close(); });
  return { el, close };
}

// Seletor de exercícios (ecrã inteiro: funciona bem com o teclado do iPhone)
async function openPicker({ title = 'Adicionar exercícios', single = false, onPick }) {
  const list = await loadExercises();
  const picked = new Set();
  let q = '', muscle = '';
  const used = new Set(S().workouts.flatMap((w) => w.exercises.map((e) => e.exId)).concat(S().routines.flatMap((r) => r.exercises.map((e) => e.exId))));
  const pg = page(`
    <header class="page-head">
      <button class="icon-btn" data-back aria-label="Voltar">${icon.close}</button>
      <h3 class="grow">${esc(title)}</h3>
      ${single ? '' : '<button class="btn primary sm" data-add disabled>Adicionar</button>'}
    </header>
    <div class="page-tools">
      <div class="search">${icon.search}<input type="search" placeholder="Procurar (supino, lateral, curl…)" data-q autocomplete="off" enterkeyhint="search"></div>
      <div class="chips">${['', ...Object.keys(MUSCLES).slice(0, 15)].map((m) => `<button class="chip ${m === '' ? 'on' : ''}" data-muscle="${m}">${m ? esc(muscleName(m)) : 'Todos'}</button>`).join('')}</div>
    </div>
    <div class="page-body" data-list></div>`);
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const paint = () => {
    const nq = norm(q);
    let res = list.filter((x) => (!muscle || x.primary.includes(muscle)) && (!nq || norm(x.name).includes(nq) || norm(x.en).includes(nq)));
    res.sort((a, b) => (used.has(b.id) - used.has(a.id)) || (b.popular - a.popular));
    res = res.slice(0, 80);
    $('[data-list]', pg.el).innerHTML = res.length ? res.map((x) => `
      <button class="ex-row ${picked.has(x.id) ? 'on' : ''}" data-pick-id="${x.id}">
        ${thumb(x.id)}
        <span class="grow"><b class="ellipsis" style="display:block">${esc(x.name)}</b><span class="muted small ellipsis" style="display:block">${esc(x.primary.map(muscleName).join(', '))} · ${esc(EQUIPMENT[x.equipment] || x.equipment)}${used.has(x.id) ? ' · <span style="color:var(--accent)">teu</span>' : ''}</span></span>
        ${single ? '<span class="muted">›</span>' : `<span class="sel">${picked.has(x.id) ? icon.check : ''}</span>`}
      </button>`).join('') : '<div class="empty">Nada encontrado</div>';
    const btn = $('[data-add]', pg.el);
    if (btn) { btn.disabled = !picked.size; btn.textContent = picked.size ? `Adicionar (${picked.size})` : 'Adicionar'; }
  };
  pg.el.addEventListener('input', (e) => { if (e.target.matches('[data-q]')) { q = e.target.value; paint(); } });
  pg.el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-muscle]');
    if (m) {
      muscle = m.dataset.muscle;
      pg.el.querySelectorAll('[data-muscle]').forEach((c) => c.classList.toggle('on', c === m));
      haptic(); paint();
      return;
    }
    const row = e.target.closest('[data-pick-id]');
    if (row) {
      const id = row.dataset.pickId;
      if (single) { pg.close(); onPick([id]); return; }
      picked.has(id) ? picked.delete(id) : picked.add(id);
      haptic(); paint();
      return;
    }
    if (e.target.closest('[data-add]')) { pg.close(); onPick([...picked]); }
  });
  paint();
}

// Editor de rotinas
function editRoutine(id) {
  const s = S();
  const orig = s.routines.find((r) => r.id === id);
  const r = orig ? JSON.parse(JSON.stringify(orig)) : { id: uid(), name: '', exercises: [] };
  const pg = page(`
    <header class="page-head">
      <button class="icon-btn" data-back aria-label="Voltar">${icon.close}</button>
      <h3 class="grow">${orig ? 'Editar rotina' : 'Nova rotina'}</h3>
      <button class="btn primary sm" data-save>Guardar</button>
    </header>
    <div class="page-body" style="padding-top:8px">
      <input class="field big-field" data-name value="${esc(r.name)}" placeholder="Nome (ex.: Superiores)">
      <div data-list></div>
      <button class="btn block" style="margin-top:14px;color:var(--accent)" data-add>${icon.plus} Adicionar exercício</button>
      ${orig ? '<button class="btn danger block" style="margin-top:10px" data-del>Apagar rotina</button>' : ''}
    </div>`);
  const paint = () => {
    $('[data-list]', pg.el).innerHTML = r.exercises.map((e, i) => `
      <div class="card r-row">
        ${thumb(e.exId)}
        <div class="grow"><b class="ellipsis" style="display:block">${esc(getEx(e.exId).name)}</b>
          <div class="stepper"><button data-dec="${i}">−</button><span class="num">${e.sets} séries</span><button data-inc="${i}">+</button></div></div>
        <div class="r-actions">
          <button class="icon-btn sm" data-up="${i}" ${i === 0 ? 'disabled' : ''}>↑</button>
          <button class="icon-btn sm" data-swap="${i}" aria-label="Trocar">${icon.swap}</button>
          <button class="icon-btn sm" data-rm="${i}" aria-label="Remover">${icon.trash}</button>
        </div>
      </div>`).join('') || '<div class="empty">Sem exercícios ainda</div>';
  };
  pg.el.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;
    if (d.inc) r.exercises[+d.inc].sets = Math.min(10, r.exercises[+d.inc].sets + 1);
    else if (d.dec) r.exercises[+d.dec].sets = Math.max(1, r.exercises[+d.dec].sets - 1);
    else if (d.up) { const i = +d.up; [r.exercises[i - 1], r.exercises[i]] = [r.exercises[i], r.exercises[i - 1]]; }
    else if (d.rm) r.exercises.splice(+d.rm, 1);
    else if (d.swap) return openPicker({ title: 'Trocar exercício', single: true, onPick: ([id]) => { r.exercises[+d.swap].exId = id; paint(); } });
    else if (t.matches('[data-add]')) return openPicker({ onPick: (ids) => { ids.forEach((x) => r.exercises.push({ exId: x, sets: 3 })); paint(); } });
    else if (t.matches('[data-del]')) {
      if (!confirm(`Apagar a rotina "${r.name}"?`)) return;
      s.routines = s.routines.filter((x) => x.id !== r.id); save(); pg.close(); render(); return;
    } else if (t.matches('[data-save]')) {
      r.name = $('[data-name]', pg.el).value.trim() || 'Rotina';
      if (!r.exercises.length) return toast('Adiciona pelo menos 1 exercício');
      const i = s.routines.findIndex((x) => x.id === r.id);
      if (i >= 0) s.routines[i] = r; else s.routines.push(r);
      save(); pg.close(); render(); toast('Rotina guardada ✓');
      return;
    } else return;
    haptic(); paint();
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
  const regs = Object.entries(regionsFor(id)).filter(([, v]) => v >= 1).map(([r]) => r);
  sheet(`
    <div class="head"><h3 class="ellipsis">${esc(ex.name)}</h3><button class="icon-btn" data-close>${icon.close}</button></div>
    <div class="body">
      <div class="demo"><span class="live">● DEMO</span><img src="${img(id, 0)}" alt="Posição inicial"><img src="${img(id, 1)}" alt="Posição final"></div>
      <div class="detail-muscles">
        <div class="mini-wrap">${miniBody(Object.fromEntries(regs.map((r) => [r, 1])))}</div>
        <div class="grow">
          <div class="muted small">Trabalha</div>
          <div class="chips wrap" style="margin-top:6px">${regs.map((r) => `<span class="chip on">${esc(REGIONS[r].name)}</span>`).join('')}<span class="chip">${esc(EQUIPMENT[ex.equipment] || ex.equipment)}</span></div>
        </div>
      </div>
      ${series.length ? `
        <div class="kv"><div><b class="num">${dec(b.w)}</b><span>kg máximo</span></div><div><b class="num">${Math.round(b.e)}</b><span>1RM est.</span></div><div><b class="num">${series.length}</b><span>sessões</span></div></div>
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
      <button class="btn block" data-m="swap">Trocar exercício</button>
      ${ei > 0 ? '<button class="btn block" data-m="up">Mover para cima</button>' : ''}
      ${ei < a.exercises.length - 1 ? '<button class="btn block" data-m="down">Mover para baixo</button>' : ''}
      <button class="btn danger block" data-m="remove">Remover exercício</button>
    </div>`);
  sh.el.addEventListener('click', (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m;
    if (!m) return;
    sh.close();
    if (m === 'demo') return exerciseDetail(entry.exId);
    if (m === 'swap') return openPicker({ title: 'Trocar exercício', single: true, onPick: ([id]) => { a.exercises[ei] = newEntry(id, entry.sets.length); save(); renderWorkout(); } });
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
      <div class="chips wrap">${[60, 90, 120, 150, 180, 240].map((v) => `<button class="chip ${st.rest === v ? 'on' : ''}" data-rest-v="${v}">${clock(v * 1000)}</button>`).join('')}</div>
      <label class="lbl">Incremento de carga (barra/máquina)</label>
      <div class="chips wrap">${[1.25, 2.5, 5].map((v) => `<button class="chip ${st.increment === v ? 'on' : ''}" data-inc-v="${v}">${dec(v)} kg</button>`).join('')}</div>
      <label class="lbl">Chave da API Anthropic (coach com AI)</label>
      <input class="field" type="password" data-key placeholder="sk-ant-..." value="${esc(st.apiKey)}" autocomplete="off">
      <p class="muted small">Fica guardada só neste iPhone e é enviada apenas para api.anthropic.com. Cria uma chave em console.anthropic.com com um limite de gastos baixo.</p>
      <label class="lbl">Dados</label>
      <div class="row"><button class="btn grow" data-act="export">Exportar backup</button><label class="btn grow">Importar<input type="file" accept="application/json" data-import hidden></label></div>
      <button class="btn block" style="margin-top:10px" data-act="restore-split">Repor o meu split</button>
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

function seedSplit(force = false) {
  const s = S();
  if (s.seeded && !force) return;
  for (const r of MY_SPLIT) {
    if (s.routines.some((x) => x.name === r.name)) continue;
    s.routines.push({ id: uid(), name: r.name, exercises: r.exercises.map(([exId, sets]) => ({ exId, sets })) });
  }
  s.seeded = true;
  save();
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
  'edit-routine': (d) => editRoutine(d.id),
  'new-routine': () => editRoutine(null),
  'workout-detail': (d) => workoutDetail(d.id),
  'repeat-workout': (d) => startWorkout(null, S().workouts.find((w) => w.id === d.id)),
  'delete-workout': (d) => {
    if (!confirm('Apagar este treino?')) return;
    S().workouts = S().workouts.filter((w) => w.id !== d.id); save(); render();
  },
  'progress-ex': (d) => { progressEx = d.id; haptic(); render(); },
  'body-mode': (d) => { bodyMode = d.mode; haptic(); render(); },
  region: (d) => regionSheet(d.r),
  profile: () => openProfile(),
  'log-weight': () => logWeight(),
  'log-measures': () => logMeasures(),
  'ex-detail': (d) => exerciseDetail(d.id),
  settings: () => openSettings(),
  quick: (d) => sendChat(d.q),
  'clear-chat': () => { if (confirm('Limpar a conversa?')) { S().chat = []; save(); render(); } },
  minimize: () => closeWorkout(),
  finish: () => finishWorkout(),
  discard: () => { if (confirm('Cancelar e apagar este treino?')) { S().active = null; save(); stopRest(); closeWorkout(); } },
  'add-ex': () => openPicker({ title: 'Adicionar exercícios', onPick: addToWorkout }),
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
  'restore-split': () => { seedSplit(true); render(); toast('Split reposto ✓'); },
  export: () => exportData(),
  wipe: () => { if (confirm('Apagar TODOS os treinos, rotinas e definições? Isto não se desfaz.')) { resetAll(); location.reload(); } },
};

document.addEventListener('click', (e) => {
  const region = e.target.closest('[data-region]');
  if (region && region.closest('.bodymap')) { haptic(); regionSheet(region.dataset.region); return; }
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = actions[el.dataset.act];
  if (!fn) return;
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
setInterval(() => {
  const a = S().active;
  if (a) document.querySelectorAll('[data-elapsed]').forEach((el) => (el.textContent = clock(Date.now() - a.start)));
  if (rest) paintRest();
}, 500);

// ============ Arranque ============
(async function boot() {
  app.innerHTML = '<div class="empty" style="padding-top:40vh">A carregar…</div>';
  try { await loadExercises(); } catch { toast('Erro a carregar exercícios'); }
  seedSplit();
  render();
  if (S().active) openWorkout();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
