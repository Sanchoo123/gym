// Plano de nutrição e análise do peso corporal.
export const ACTIVITY = [
  { v: 1.375, label: 'Leve', hint: '1–3 treinos/semana, trabalho sentado' },
  { v: 1.55, label: 'Moderado', hint: '3–5 treinos/semana' },
  { v: 1.725, label: 'Alto', hint: '6+ treinos ou trabalho físico' },
];
export const GOALS = [
  { v: 'bulk', label: 'Ganhar massa' },
  { v: 'recomp', label: 'Recomposição' },
  { v: 'cut', label: 'Definir' },
];

const r = (x, s = 1) => Math.round(x / s) * s;

export function plan(profile, w) {
  const { sex = 'm', age, height, activity = 1.55, goal = 'bulk' } = profile || {};
  if (!w || !height || !age) return null;
  const bmr = 10 * w + 6.25 * height - 5 * age + (sex === 'f' ? -161 : 5);
  const tdee = bmr * activity;
  const adj = goal === 'bulk' ? 300 : goal === 'cut' ? -450 : 0;
  const kcal = r(tdee + adj, 10);
  const protein = r(w * (goal === 'cut' ? 2.2 : 2.0));
  const fat = r(w * 0.9);
  const carbs = Math.max(0, r((kcal - protein * 4 - fat * 9) / 4));
  // Ritmo ideal em kg/semana
  const rate = goal === 'bulk' ? [w * 0.0025, w * 0.005] : goal === 'cut' ? [-w * 0.01, -w * 0.005] : [-0.1, 0.1];
  return { bmr: r(bmr), tdee: r(tdee, 10), kcal, protein, fat, carbs, rate, goal };
}

// Regressão linear dos últimos N dias → kg por semana
export function weightTrend(entries, days = 28, now = Date.now()) {
  const pts = entries.filter((e) => e.t >= now - days * 864e5);
  if (pts.length < 3 || pts.at(-1).t - pts[0].t < 7 * 864e5) return null;
  const xs = pts.map((p) => (p.t - pts[0].t) / (7 * 864e5)), ys = pts.map((p) => p.kg);
  const mx = xs.reduce((a, b) => a + b) / xs.length, my = ys.reduce((a, b) => a + b) / ys.length;
  let num = 0, den = 0;
  xs.forEach((x, i) => { num += (x - mx) * (ys[i] - my); den += (x - mx) ** 2; });
  return { rate: den ? num / den : 0, n: pts.length };
}

export function weightAdvice(p, trend) {
  if (!p) return null;
  const f = (x) => (Math.round(x * 100) / 100).toString().replace('.', ',');
  if (!trend) {
    return { tone: 'info', title: 'Pesa-te 3–4× por semana', text: 'De manhã, em jejum, depois da casa de banho. Com 1 semana de dados o coach diz-te se estás a ganhar ao ritmo certo.' };
  }
  const [lo, hi] = p.rate;
  const rate = trend.rate;
  if (p.goal === 'bulk') {
    if (rate < lo * 0.6) return { tone: 'warn', title: `A ganhar pouco: ${f(rate)} kg/semana`, text: `Para construir músculo o ideal é ${f(lo)}–${f(hi)} kg/semana. Sobe 150–200 kcal por dia (ex.: +1 banana e 30 g de aveia) e reavalia daqui a 2 semanas.` };
    if (rate > hi * 1.4) return { tone: 'warn', title: `A ganhar rápido demais: ${f(rate)} kg/semana`, text: `Acima de ${f(hi)} kg/semana o excesso vai sobretudo para gordura. Baixa 150 kcal por dia.` };
    return { tone: 'good', title: `No ponto: +${f(rate)} kg/semana`, text: 'Ritmo ideal de ganho de massa magra. Mantém as calorias e continua a subir cargas.' };
  }
  if (p.goal === 'cut') {
    if (rate > hi * 0.5) return { tone: 'warn', title: `A perder pouco: ${f(rate)} kg/semana`, text: `O ideal é ${f(-hi)}–${f(-lo)} kg/semana. Tira 150–200 kcal por dia ou junta 2–3k passos.` };
    if (rate < lo * 1.3) return { tone: 'warn', title: `A perder rápido demais: ${f(rate)} kg/semana`, text: 'Risco de perder músculo. Come mais 150 kcal por dia e mantém a proteína alta.' };
    return { tone: 'good', title: `No ponto: ${f(rate)} kg/semana`, text: 'Bom ritmo para definir mantendo massa muscular.' };
  }
  return Math.abs(rate) < 0.15
    ? { tone: 'good', title: 'Peso estável', text: 'Perfeito para recomposição: mantém proteína alta e progressão nas cargas.' }
    : { tone: 'info', title: `Peso a variar ${f(rate)} kg/semana`, text: 'Para recomposição o peso deve ficar estável. Ajusta ±150 kcal.' };
}

// Índice de Adónis (ombros ÷ cintura). Ideal estético ≈ 1,618.
export function adonis(m) {
  if (!m?.shoulders || !m?.waist) return null;
  return m.shoulders / m.waist;
}

// ---- Registo de refeições ----
export const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

export function dayTotals(meals, t = Date.now()) {
  const k = dayKey(t);
  const list = meals.filter((m) => dayKey(m.t) === k);
  const sum = (f) => list.reduce((a, m) => a + (+m[f] || 0), 0);
  return { list, kcal: sum('kcal'), protein: sum('protein'), carbs: sum('carbs'), fat: sum('fat') };
}

// Metas diárias: do plano completo, ou só proteína se houver peso mas não perfil
export function targets(p, weight) {
  if (p) return { kcal: p.kcal, protein: p.protein, carbs: p.carbs, fat: p.fat };
  if (weight) return { kcal: null, protein: Math.round(weight * 2), carbs: null, fat: null };
  return { kcal: null, protein: 150, carbs: null, fat: null };
}

export const PRESETS = [
  { name: 'Batido de whey (1 scoop)', kcal: 120, protein: 24, carbs: 3, fat: 2 },
  { name: '3 ovos mexidos', kcal: 215, protein: 19, carbs: 1, fat: 15 },
  { name: 'Peito de frango 150 g', kcal: 250, protein: 46, carbs: 0, fat: 6 },
  { name: 'Skyr / iogurte proteico', kcal: 95, protein: 16, carbs: 6, fat: 0 },
  { name: 'Lata de atum (escorrido)', kcal: 95, protein: 21, carbs: 0, fat: 1 },
  { name: 'Arroz cozido 200 g', kcal: 260, protein: 5, carbs: 56, fat: 1 },
  { name: 'Aveia 60 g + leite', kcal: 350, protein: 17, carbs: 50, fat: 9 },
  { name: 'Banana', kcal: 105, protein: 1, carbs: 27, fat: 0 },
];

// Reduz a foto no iPhone antes de enviar (mais rápido e barato)
export async function shrinkImage(file, max = 1280, quality = 0.82) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const draw = (m, q) => {
      const k = Math.min(1, m / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    };
    return { full: draw(max, quality), thumb: draw(220, 0.7) };
  } finally {
    URL.revokeObjectURL(url);
  }
}
