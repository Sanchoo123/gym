// Componentes de interface reutilizáveis: ícones, sheets, toasts, confetti, haptics, gráficos.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const fmt = (n) => (n == null || n === '' ? '' : String(Math.round(+n * 100) / 100));

const svg = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
export const icon = {
  home: svg('<path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>'),
  history: svg('<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l3 2"/>'),
  chart: svg('<path d="M3 3v18h18"/><path d="m7 15 4-4 3 3 6-6"/>'),
  coach: svg('<path d="M12 3l1.9 4.6L18.5 9l-4.6 1.9L12 15.5l-1.9-4.6L5.5 9l4.6-1.4z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>'),
  plus: svg('<path d="M12 5v14M5 12h14"/>'),
  check: svg('<path d="m5 12 5 5L20 7"/>', 'stroke-width="3"'),
  close: svg('<path d="M18 6 6 18M6 6l12 12"/>'),
  down: svg('<path d="m6 9 6 6 6-6"/>'),
  arrow: svg('<path d="M5 12h14M13 6l6 6-6 6"/>', 'stroke-width="2.5"'),
  gear: svg('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  send: svg('<path d="M12 19V5M5 12l7-7 7 7"/>', 'stroke-width="2.5"'),
  dots: svg('<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>', 'stroke-width="3"'),
  trash: svg('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>'),
  body: svg('<circle cx="12" cy="4" r="2"/><path d="M8 22l1.5-8M16 22l-1.5-8M6 9c2 1 4 1.5 6 1.5S16 10 18 9M9.5 14h5l.5-4.5"/>'),
  user: svg('<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>'),
  edit: svg('<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M14 6l4 4"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>'),
  camera: svg('<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>'),
  swap: svg('<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>'),
};

// ---------- Haptics ----------
const hapticLabel = () => document.getElementById('haptic-label');
export function haptic(ms = 10) {
  if (navigator.vibrate) navigator.vibrate(ms);
  else hapticLabel()?.click();
}

// ---------- Sheets ----------
export function sheet(html, { onClose, className = '' } = {}) {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  const el = document.createElement('div');
  el.className = `sheet ${className}`;
  el.innerHTML = `<div class="grab"></div>${html}`;
  document.body.append(overlay, el);
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    overlay.classList.add('closing');
    el.classList.add('closing');
    setTimeout(() => { overlay.remove(); el.remove(); onClose?.(); }, 250);
  };
  overlay.addEventListener('click', close);
  el.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });

  // Arrastar para baixo para fechar
  let y0 = null, dy = 0;
  const grab = el.querySelector('.grab');
  const head = el.querySelector('.head');
  [grab, head].forEach((h) => h?.addEventListener('touchstart', (e) => { y0 = e.touches[0].clientY; el.style.transition = 'none'; }, { passive: true }));
  el.addEventListener('touchmove', (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    el.style.transform = `translateY(${dy}px)`;
  }, { passive: true });
  el.addEventListener('touchend', () => {
    if (y0 == null) return;
    el.style.transition = 'transform 0.3s var(--ease)';
    if (dy > 120) close(); else el.style.transform = '';
    y0 = null; dy = 0;
  });
  return { el, close };
}

// ---------- Toast ----------
export function toast(text, kind = '') {
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  t.textContent = text;
  document.body.append(t);
  setTimeout(() => t.remove(), 2700);
}

// ---------- Confetti ----------
export function confetti(n = 140) {
  const c = document.createElement('canvas');
  c.id = 'confetti';
  const dpr = window.devicePixelRatio || 1;
  c.width = innerWidth * dpr; c.height = innerHeight * dpr;
  document.body.append(c);
  const ctx = c.getContext('2d');
  ctx.scale(dpr, dpr);
  const colors = ['#c6ff3d', '#ffd43b', '#ffffff', '#4ade80', '#9bd61f'];
  const parts = Array.from({ length: n }, () => ({
    x: innerWidth / 2 + (Math.random() - 0.5) * 80, y: innerHeight * 0.35,
    vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 14 - 4,
    s: 5 + Math.random() * 6, r: Math.random() * 6, vr: (Math.random() - 0.5) * 0.4,
    c: colors[(Math.random() * colors.length) | 0],
  }));
  const t0 = performance.now();
  (function frame(t) {
    const k = (t - t0) / 2200;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    for (const p of parts) {
      p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
      ctx.save(); ctx.globalAlpha = Math.max(0, 1 - k);
      ctx.translate(p.x, p.y); ctx.rotate(p.r);
      ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      ctx.restore();
    }
    if (k < 1) requestAnimationFrame(frame); else c.remove();
  })(t0);
}

// ---------- Som de fim de descanso ----------
let audio;
export function unlockAudio() {
  try { audio ??= new (window.AudioContext || window.webkitAudioContext)(); audio.resume(); } catch {}
}
export function beep() {
  if (!audio) return;
  [0, 0.18, 0.36].forEach((d, i) => {
    const o = audio.createOscillator(), g = audio.createGain();
    o.frequency.value = i === 2 ? 1320 : 880;
    g.gain.setValueAtTime(0.0001, audio.currentTime + d);
    g.gain.exponentialRampToValueAtTime(0.3, audio.currentTime + d + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + d + 0.15);
    o.connect(g).connect(audio.destination);
    o.start(audio.currentTime + d); o.stop(audio.currentTime + d + 0.16);
  });
}

// ---------- Gráfico de linha (SVG animado) ----------
export function lineChart(points, { w = 340, h = 180, unit = 'kg' } = {}) {
  if (points.length < 2) return '<p class="muted small">Precisas de pelo menos 2 sessões para ver o gráfico.</p>';
  const pad = { l: 34, r: 10, t: 12, b: 22 };
  const ys = points.map((p) => p.y);
  let lo = Math.min(...ys), hi = Math.max(...ys);
  const span = hi - lo || hi * 0.1 || 1;
  lo -= span * 0.15; hi += span * 0.15;
  const X = (i) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const Y = (v) => pad.t + (1 - (v - lo) / (hi - lo)) * (h - pad.t - pad.b);
  const pts = points.map((p, i) => [X(i), Y(p.y)]);
  // curva suave (Catmull-Rom → Bézier)
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  len = Math.ceil(len * 1.2);
  const area = `${d} L${pts.at(-1)[0]},${h - pad.b} L${pts[0][0]},${h - pad.b} Z`;
  const ticks = [lo + (hi - lo) * 0.15, (lo + hi) / 2, hi - (hi - lo) * 0.15];
  const dateLbl = (t) => new Date(t).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
  return `<svg class="chart" viewBox="0 0 ${w} ${h}" style="--len:${len}">
    <defs><linearGradient id="ga" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6ff3d" stop-opacity=".35"/><stop offset="1" stop-color="#c6ff3d" stop-opacity="0"/></linearGradient></defs>
    ${ticks.map((t) => `<line class="grid" x1="${pad.l}" x2="${w - pad.r}" y1="${Y(t)}" y2="${Y(t)}"/><text x="0" y="${Y(t) + 4}">${hi - lo < 6 ? t.toFixed(1).replace('.', ',') : Math.round(t)}</text>`).join('')}
    <path class="area" d="${area}" fill="url(#ga)"/>
    <path class="line" d="${d}"/>
    ${pts.map((p, i) => `<circle class="dot" cx="${p[0]}" cy="${p[1]}" r="3.5" style="animation-delay:${0.3 + (i / pts.length) * 0.8}s"/>`).join('')}
    <text x="${pad.l}" y="${h - 4}">${dateLbl(points[0].t)}</text>
    <text x="${w - pad.r}" y="${h - 4}" text-anchor="end">${dateLbl(points.at(-1).t)}</text>
  </svg>`;
}

// ---------- Contador animado ----------
export function countUp(root = document) {
  root.querySelectorAll('[data-count]').forEach((el) => {
    const target = +el.dataset.count, dec = +(el.dataset.dec || 0), t0 = performance.now();
    const step = (t) => {
      const k = Math.min(1, (t - t0) / 900), e = 1 - Math.pow(1 - k, 3);
      el.textContent = (target * e).toLocaleString('pt-PT', { maximumFractionDigits: dec, minimumFractionDigits: dec });
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
