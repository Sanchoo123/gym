// Motor do coach: progressão automática, recordes, estagnação e equilíbrio muscular.
// Funciona 100% offline; o chat com o Claude é opcional (ver askClaude).
import { getEx, incrementFor, muscleName, GROUP } from './data.js';

export const e1rm = (w, r) => (r <= 0 || w <= 0 ? 0 : r === 1 ? w : w * (1 + r / 30));
export const round = (x, step = 0.5) => Math.round(x / step) * step;
const fmt = (n) => String(Math.round(n * 100) / 100);
const doneSets = (ex) => ex.sets.filter((s) => s.done && s.r > 0);

// Sessões anteriores de um exercício, da mais recente para a mais antiga
export function history(workouts, exId) {
  const out = [];
  for (let i = workouts.length - 1; i >= 0; i--) {
    const w = workouts[i];
    for (const ex of w.exercises) {
      if (ex.exId !== exId) continue;
      const sets = doneSets(ex);
      if (sets.length) out.push({ date: w.start, sets });
    }
  }
  return out;
}

const topWeight = (sets) => Math.max(...sets.map((s) => s.w));
const atTop = (sets) => sets.filter((s) => s.w === topWeight(sets));
const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

// Sugestão para a próxima sessão (dupla progressão + RPE + deteção de estagnação)
export function suggest(workouts, exId, baseInc = 2.5) {
  const h = history(workouts, exId);
  if (!h.length) return null;
  const ex = getEx(exId);
  const inc = incrementFor(ex, baseInc);
  const last = h[0];
  const W = topWeight(last.sets);
  const top = atTop(last.sets);
  const minR = Math.min(...top.map((s) => s.r));
  const rpes = top.map((s) => s.rpe).filter(Boolean);
  const rpe = rpes.length ? avg(rpes) : null;

  if (W === 0) {
    return { w: 0, r: minR + 1, kind: 'up', why: `Peso corporal: tenta +1 rep por série (${minR + 1}).` };
  }

  // Estagnação: 3 sessões seguidas com o mesmo peso de topo sem ganhar repetições
  const same = h.slice(0, 3).filter((s) => topWeight(s.sets) === W);
  if (same.length === 3) {
    const totals = same.map((s) => atTop(s.sets).reduce((a, b) => a + b.r, 0));
    if (totals[0] <= totals[2]) {
      return {
        w: round(W * 0.9, inc), r: minR + 2, kind: 'deload',
        why: `Estagnado em ${fmt(W)} kg há 3 sessões. Deload: ${fmt(round(W * 0.9, inc))} kg com mais reps, e voltas a subir.`,
      };
    }
  }

  if (minR >= 12 || (rpe !== null && rpe <= 7)) {
    const r = minR >= 12 ? Math.max(6, minR - 4) : minR;
    return {
      w: W + inc, r, kind: 'up',
      why: rpe !== null && rpe <= 7 && minR < 12
        ? `RPE ${fmt(rpe)} na última: ficou fácil. Sobe para ${fmt(W + inc)} kg.`
        : `Chegaste a ${minR}+ reps em todas as séries. Sobe para ${fmt(W + inc)} kg.`,
    };
  }
  if (rpe !== null && rpe >= 9.5) {
    return { w: W, r: minR, kind: 'hold', why: `Última sessão ao limite (RPE ${fmt(rpe)}). Mantém ${fmt(W)} × ${minR} e consolida.` };
  }
  return { w: W, r: minR + 1, kind: 'reps', why: `Mantém ${fmt(W)} kg e tenta ${minR + 1} reps (+1).` };
}

// Melhores marcas antes de uma data (para detetar recordes em tempo real)
export function bests(workouts, exId, excludeId) {
  let w = 0, e = 0;
  for (const wk of workouts) {
    if (wk.id === excludeId) continue;
    for (const ex of wk.exercises) {
      if (ex.exId !== exId) continue;
      for (const s of doneSets(ex)) {
        w = Math.max(w, s.w);
        e = Math.max(e, e1rm(s.w, s.r));
      }
    }
  }
  return { w, e };
}

export const volume = (wk) => wk.exercises.reduce((t, ex) => t + doneSets(ex).reduce((a, s) => a + s.w * s.r, 0), 0);
export const setCount = (wk) => wk.exercises.reduce((t, ex) => t + doneSets(ex).length, 0);

// Séries por músculo nos últimos N dias (primário = 1, secundário = 0.5)
export function muscleSets(workouts, days = 7, now = Date.now()) {
  const from = now - days * 864e5;
  const out = {};
  for (const wk of workouts) {
    if (wk.start < from) continue;
    for (const ex of wk.exercises) {
      const n = doneSets(ex).length;
      if (!n) continue;
      const info = getEx(ex.exId);
      info.primary.forEach((m) => (out[m] = (out[m] || 0) + n));
      info.secondary.forEach((m) => (out[m] = (out[m] || 0) + n * 0.5));
    }
  }
  return out;
}

// Série temporal para gráficos: melhor e1RM por sessão
export function progressSeries(workouts, exId) {
  return history(workouts, exId)
    .map((s) => ({
      date: s.date,
      e1rm: Math.max(...s.sets.map((x) => e1rm(x.w, x.r))),
      top: topWeight(s.sets),
      best: s.sets.reduce((b, x) => (e1rm(x.w, x.r) > e1rm(b.w, b.r) ? x : b)),
    }))
    .reverse();
}

// Cartões de insight para o ecrã do Coach
export function insights(workouts, now = Date.now()) {
  const out = [];
  if (!workouts.length) return out;

  const ids = [...new Set(workouts.slice(-20).flatMap((w) => w.exercises.map((e) => e.exId)))];
  for (const id of ids) {
    const s = suggest(workouts, id);
    if (s?.kind === 'deload') out.push({ icon: '🧱', title: `Plateau: ${getEx(id).name}`, text: s.why, tone: 'warn' });
  }

  const ms = muscleSets(workouts, 14, now);
  const g = { push: 0, pull: 0, legs: 0, core: 0 };
  for (const [m, n] of Object.entries(ms)) g[GROUP[m] || 'core'] += n;
  if (g.push > 0 && g.pull > 0 && g.push / g.pull > 1.5) {
    out.push({ icon: '⚖️', title: 'Mais empurrar do que puxar', text: `Últimas 2 semanas: ${Math.round(g.push)} séries de empurrar vs ${Math.round(g.pull)} de puxar. Junta remadas ou face pulls para proteger os ombros.`, tone: 'warn' });
  }
  if ((g.push + g.pull) > 20 && g.legs < (g.push + g.pull) / 4) {
    out.push({ icon: '🦵', title: 'Pernas esquecidas', text: `Só ${Math.round(g.legs)} séries de pernas em 2 semanas.`, tone: 'warn' });
  }

  const week = muscleSets(workouts, 7, now);
  const low = Object.entries(week).filter(([m, n]) => n > 0 && n < 6 && ['chest', 'lats', 'quadriceps', 'shoulders', 'hamstrings'].includes(m));
  if (low.length) {
    out.push({ icon: '📉', title: 'Volume baixo esta semana', text: low.map(([m, n]) => `${muscleName(m)}: ${fmt(n)} série${n === 1 ? '' : 's'}`).join(' · ') + '. Para crescer, 10–20 séries semanais por músculo é uma boa referência.', tone: 'info' });
  }

  const recent = workouts.filter((w) => w.start > now - 7 * 864e5).length;
  out.push({ icon: recent >= 3 ? '🔥' : '📅', title: `${recent} treino${recent === 1 ? '' : 's'} nos últimos 7 dias`, text: recent >= 3 ? 'Consistência top. É isto que dá resultados.' : 'Tenta chegar a 3 por semana para progredir de forma estável.', tone: recent >= 3 ? 'good' : 'info' });
  return out;
}

// Resumo compacto do histórico para dar contexto ao Claude
export function historyDigest(workouts, max = 30) {
  const lines = workouts.slice(-max).map((w) => {
    const d = new Date(w.start).toISOString().slice(0, 10);
    const ex = w.exercises
      .filter((e) => doneSets(e).length)
      .map((e) => `${getEx(e.exId).en || getEx(e.exId).name}: ${doneSets(e).map((s) => `${fmt(s.w)}x${s.r}${s.rpe ? '@' + s.rpe : ''}`).join(', ')}`)
      .join(' | ');
    return `${d} ${w.name || 'Treino'} — ${ex}`;
  });
  return lines.join('\n') || '(sem treinos registados ainda)';
}

// ---- Chat com o Claude (opcional, precisa de chave da API) ----
let sdk = null;
async function loadSdk() {
  sdk ??= (await import('https://cdn.jsdelivr.net/npm/@anthropic-ai/sdk@0.132.1/+esm')).default;
  return sdk;
}

const SYSTEM = `És o coach de ginásio pessoal do utilizador, dentro da app de registo de treinos dele.
Responde em português de Portugal, de forma direta e prática, como um treinador experiente.
Baseia-te no histórico real abaixo (formato: peso_kg x reps @RPE). Cita números concretos quando ajudar.
Quando sugerires cargas, dá peso e reps exatos para a próxima sessão. Sê breve: frases curtas, listas curtas.
O objetivo principal do utilizador é ganhar massa muscular com foco em estética (V-taper, ombros largos, peito superior, braços).
Não dês conselhos médicos; se houver dor ou lesão, recomenda falar com um profissional.`;

export async function askClaude({ apiKey, workouts, chat, context = '', onText }) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const stream = client.beta.messages.stream({
    model: 'claude-opus-5-5',
    max_tokens: 64000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'medium' },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: [
      { type: 'text', text: SYSTEM },
      { type: 'text', text: `Data de hoje: ${new Date().toISOString().slice(0, 10)}\n${context}\nHistórico de treinos:\n${historyDigest(workouts)}`, cache_control: { type: 'ephemeral' } },
    ],
    messages: chat.map((m) => ({ role: m.role, content: m.content })),
  });
  stream.on('text', onText);
  const msg = await stream.finalMessage();
  if (msg.stop_reason === 'refusal') throw new Error('O pedido foi recusado pelo modelo. Tenta reformular.');
  return msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
}

// ---- Estimativa de refeição por foto ----
const MEAL_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['name', 'items', 'confidence', 'tip'],
  properties: {
    name: { type: 'string', description: 'Nome curto da refeição em português (ex.: "Frango com arroz e salada")' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'grams', 'kcal', 'protein', 'carbs', 'fat'],
        properties: {
          name: { type: 'string' },
          grams: { type: 'number' },
          kcal: { type: 'number' },
          protein: { type: 'number' },
          carbs: { type: 'number' },
          fat: { type: 'number' },
        },
      },
    },
    confidence: { type: 'string', enum: ['alta', 'média', 'baixa'] },
    tip: { type: 'string', description: 'Uma frase curta e prática ligada ao objetivo de proteína do dia' },
  },
};

const MEAL_PROMPT = `És um nutricionista desportivo. Analisa a foto da refeição e estima cada alimento visível:
peso aproximado em gramas (já cozinhado, como está no prato), calorias e macros (proteína, hidratos, gordura em gramas).
Usa referências visuais (prato ~26 cm, talheres, mão) para estimar porções. Inclui óleos/molhos prováveis.
Se não for comida, devolve items vazio e confiança baixa. Responde em português de Portugal.`;

export async function estimateMeal({ apiKey, image, mediaType = 'image/jpeg', note = '', remaining = null }) {
  const Anthropic = await loadSdk();
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });
  const extra = [
    note && `Informação do utilizador: ${note}`,
    remaining != null && `Ainda lhe faltam ${Math.round(remaining)} g de proteína hoje (objetivo: ganhar massa muscular).`,
  ].filter(Boolean).join('\n');
  const msg = await client.beta.messages.create({
    model: 'claude-opus-5-5',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    output_config: { effort: 'low', format: { type: 'json_schema', schema: MEAL_SCHEMA } },
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    system: MEAL_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'image', source: { type: 'base64', media_type: mediaType, data: image } },
        { type: 'text', text: extra || 'Estima esta refeição.' },
      ],
    }],
  });
  if (msg.stop_reason === 'refusal') throw new Error('O modelo recusou analisar esta imagem.');
  if (msg.stop_reason === 'max_tokens') throw new Error('Resposta incompleta. Tenta outra vez.');
  const text = msg.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('Não consegui ler a resposta. Tenta outra vez.'); }
  const sum = (k) => Math.round(data.items.reduce((t, i) => t + (+i[k] || 0), 0));
  return { ...data, kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
}

export async function claudeErrorMessage(err) {
  const A = sdk;
  if (A && err instanceof A.AuthenticationError) return 'Chave da API inválida. Verifica-a nas Definições.';
  if (A && err instanceof A.RateLimitError) return 'Muitos pedidos seguidos. Espera um pouco e tenta outra vez.';
  if (A && err instanceof A.APIConnectionError) return 'Sem ligação à internet. O coach offline continua a funcionar.';
  if (A && err instanceof A.APIError) return `Erro da API (${err.status ?? '?'}): ${err.message}`;
  return err?.message || 'Erro desconhecido.';
}
