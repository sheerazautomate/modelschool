/* =========================================================================
   Hand-rolled SVG charts. No dependencies, print-safe, keyboard-free.
   ========================================================================= */

import { el, round } from './util.js';
import { PILLARS } from './data.js';

const NS = 'http://www.w3.org/2000/svg';
const s = (tag, attrs = {}) => {
  const n = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) n.setAttribute(k, v);
  return n;
};
const txt = (x, y, content, attrs = {}) => {
  const t = s('text', { x, y, ...attrs });
  t.textContent = content;
  return t;
};
const tip = (node, content) => {
  const t = s('title', {});
  t.textContent = content;
  node.append(t);
  return node;
};

export function scoreColor(v) {
  if (v === null || v === undefined) return '#d9d3c4';
  if (v >= 90) return '#0a6b4f';
  if (v >= 80) return '#17856a';
  if (v >= 70) return '#4f9a7c';
  if (v >= 60) return '#c9962f';
  if (v >= 50) return '#c9793a';
  return '#a52a2a';
}

export function heatColor(v) {
  if (v === null || v === undefined) return null;
  // red → amber → green, driven by the item's own percentage
  const stops = [
    [0, [165, 42, 42]],
    [40, [196, 106, 60]],
    [62, [201, 150, 47]],
    [80, [79, 154, 124]],
    [100, [10, 107, 79]],
  ];
  let a = stops[0];
  let b = stops[stops.length - 1];
  for (let i = 0; i < stops.length - 1; i += 1) {
    if (v >= stops[i][0] && v <= stops[i + 1][0]) { a = stops[i]; b = stops[i + 1]; break; }
  }
  const t = a[0] === b[0] ? 0 : (v - a[0]) / (b[0] - a[0]);
  const c = a[1].map((ch, i) => Math.round(ch + (b[1][i] - ch) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

/* --- line chart: daily composite + school benchmark -------------------- */
export function lineChart(rows, { width = 720, height = 220, benchmark = 70, compare = null, label = 'Teacher', compareLabel = 'School average' } = {}) {
  const pad = { t: 14, r: 12, b: 26, l: 34 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', role: 'img' });
  if (!rows || !rows.length) {
    svg.append(txt(width / 2, height / 2, 'No entries yet for this period', { class: 'axis-label', 'text-anchor': 'middle' }));
    return svg;
  }
  const x = (i) => pad.l + (rows.length <= 1 ? w / 2 : (i / (rows.length - 1)) * w);
  const y = (v) => pad.t + h - (Math.max(0, Math.min(100, v)) / 100) * h;

  [0, 25, 50, 75, 100].forEach((v) => {
    svg.append(s('line', { x1: pad.l, x2: pad.l + w, y1: y(v), y2: y(v), class: 'grid-line' }));
    svg.append(txt(pad.l - 7, y(v) + 3.5, String(v), { class: 'axis-label', 'text-anchor': 'end' }));
  });

  if (benchmark !== null) {
    svg.append(s('line', { x1: pad.l, x2: pad.l + w, y1: y(benchmark), y2: y(benchmark), stroke: '#a52a2a', 'stroke-width': 1.2, 'stroke-dasharray': '5 4', opacity: .55 }));
    svg.append(txt(pad.l + w - 2, y(benchmark) - 5, `Benchmark ${benchmark}%`, { class: 'axis-label', 'text-anchor': 'end', fill: '#a52a2a' }));
  }

  if (compare && compare.length) {
    const cx = (i) => pad.l + (compare.length <= 1 ? w / 2 : (i / (compare.length - 1)) * w);
    const path = compare.map((r, i) => `${i ? 'L' : 'M'}${cx(i)},${y(r.pct ?? 0)}`).join(' ');
    svg.append(s('path', { d: path, fill: 'none', stroke: '#93a29b', 'stroke-width': 1.6, 'stroke-dasharray': '4 3' }));
  }

  const val = (r) => (r.rawPct !== undefined ? r.rawPct : r.pct ?? 0);
  const pts = rows.map((r, i) => [x(i), y(val(r))]);
  const area = `M${pts[0][0]},${y(0)} ` + pts.map((p) => `L${p[0]},${p[1]}`).join(' ') + ` L${pts[pts.length - 1][0]},${y(0)} Z`;
  svg.append(s('path', { d: area, fill: 'rgba(23,133,106,.11)' }));
  svg.append(s('path', {
    d: pts.map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' '),
    fill: 'none', stroke: '#0b5340', 'stroke-width': 2.2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round',
  }));

  rows.forEach((r, i) => {
    const c = s('circle', { cx: x(i), cy: y(val(r)), r: 3.4, fill: '#fff', stroke: '#0b5340', 'stroke-width': 2 });
    tip(c, `${r.day} — ${round(val(r), 1)}%`);
    svg.append(c);
  });

  const step = Math.ceil(rows.length / 8);
  rows.forEach((r, i) => {
    if (i % step && i !== rows.length - 1) return;
    svg.append(txt(x(i), height - 8, r.day.slice(8) + '/' + r.day.slice(5, 7), { class: 'axis-label', 'text-anchor': 'middle' }));
  });

  return svg;
}

/* --- horizontal bars: pillar table ------------------------------------ */
export function pillarBars(pillars, { compact = false } = {}) {
  const wrap = el('div');
  for (const key of Object.keys(PILLARS)) {
    const p = pillars[key];
    const v = p.percent;
    const row = el('div', { class: 'pillar-row' },
      el('div', { class: 'pl-name' },
        PILLARS[key].name,
        el('span', {}, `${Math.round(PILLARS[key].weight * 100)}% weight · ${p.earned}/${p.possible} pts`),
      ),
      el('div', { class: 'meter' },
        el('i', { style: `width:${v === null ? 0 : Math.max(2, v)}%;background:${scoreColor(v)}` }),
      ),
      el('div', { class: 'pl-val', style: `color:${scoreColor(v)}` }, v === null ? '—' : `${Math.round(v)}%`),
    );
    wrap.append(row);
  }
  return wrap;
}

/* --- donut: grade distribution ---------------------------------------- */
export function donut(distribution, { size = 168, thickness = 24 } = {}) {
  const total = distribution.reduce((a, d) => a + d.count, 0);
  const r = size / 2 - thickness / 2;
  const c = size / 2;
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, width: size, height: size, class: 'chart' });
  const colors = { 'A+': '#0a6b4f', A: '#2f8f70', B: '#c9962f', C: '#c9793a', D: '#a52a2a' };
  const circ = 2 * Math.PI * r;
  let offset = 0;

  if (!total) {
    svg.append(s('circle', { cx: c, cy: c, r, fill: 'none', stroke: '#eceae2', 'stroke-width': thickness }));
  }
  distribution.forEach((d) => {
    if (!d.count) return;
    const frac = d.count / total;
    const arc = s('circle', {
      cx: c, cy: c, r, fill: 'none', stroke: colors[d.grade] || '#ccc',
      'stroke-width': thickness,
      'stroke-dasharray': `${frac * circ} ${circ}`,
      'stroke-dashoffset': -offset,
      transform: `rotate(-90 ${c} ${c})`,
      'stroke-linecap': 'butt',
    });
    tip(arc, `${d.grade} — ${d.count} teacher${d.count === 1 ? '' : 's'}`);
    svg.append(arc);
    offset += frac * circ;
  });
  svg.append(txt(c, c - 2, String(total), { 'text-anchor': 'middle', 'font-family': 'var(--serif)', 'font-size': 27, 'font-weight': 600, fill: '#15221d' }));
  svg.append(txt(c, c + 16, 'teachers', { 'text-anchor': 'middle', class: 'axis-label' }));

  const foot = el('div', { class: 'donut-foot' });
  distribution.forEach((d) => {
    foot.append(el('div', { class: 'row' },
      el('span', { class: 'sw', style: `background:${colors[d.grade]}` }),
      el('span', {}, `${d.grade} · ${d.label}`),
      el('b', {}, String(d.count)),
    ));
  });
  return el('div', { class: 'donut-wrap' }, svg, foot);
}

/* --- column chart: school average per day ----------------------------- */
export function dayColumns(dayAvg, { width = 720, height = 150 } = {}) {
  const pad = { t: 10, r: 8, b: 20, l: 28 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart' });
  const bw = Math.max(3, w / dayAvg.length - 4);
  const y = (v) => pad.t + h - (v / 100) * h;
  [0, 50, 100].forEach((v) => {
    svg.append(s('line', { x1: pad.l, x2: pad.l + w, y1: y(v), y2: y(v), class: 'grid-line' }));
    svg.append(txt(pad.l - 5, y(v) + 3, String(v), { class: 'axis-label', 'text-anchor': 'end' }));
  });
  svg.append(s('line', { x1: pad.l, x2: pad.l + w, y1: y(70), y2: y(70), stroke: '#a52a2a', 'stroke-width': 1, 'stroke-dasharray': '4 3', opacity: .5 }));
  dayAvg.forEach((d, i) => {
    const cx = pad.l + (i / dayAvg.length) * w + 2;
    const bh = d.pct === null ? 0 : (d.pct / 100) * h;
    const rect = s('rect', {
      x: cx, y: pad.t + h - bh, width: bw, height: Math.max(bh, 1), rx: 2,
      fill: d.pct === null ? '#e7e4da' : scoreColor(d.pct),
    });
    tip(rect, `${d.day}: ${d.pct === null ? 'no data' : d.pct + '%'} (${d.filled} classes marked)`);
    svg.append(rect);
  });
  return svg;
}

/* --- scatter: attendance vs composite --------------------------------- */
export function scatter(records, { width = 460, height = 300 } = {}) {
  const pad = { t: 16, r: 16, b: 34, l: 38 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart' });
  const pts = records.filter((r) => r.daysObserved > 0);
  const xMin = 60;
  const xMax = 100;
  const x = (v) => pad.l + ((Math.max(xMin, Math.min(xMax, v)) - xMin) / (xMax - xMin)) * w;
  const y = (v) => pad.t + h - (Math.max(0, Math.min(100, v)) / 100) * h;

  [0, 25, 50, 75, 100].forEach((v) => {
    svg.append(s('line', { x1: pad.l, x2: pad.l + w, y1: y(v), y2: y(v), class: 'grid-line' }));
    svg.append(txt(pad.l - 6, y(v) + 3.5, String(v), { class: 'axis-label', 'text-anchor': 'end' }));
  });
  [60, 70, 80, 90, 100].forEach((v) => {
    svg.append(txt(x(v), height - 16, `${v}%`, { class: 'axis-label', 'text-anchor': 'middle' }));
  });
  svg.append(txt(pad.l + w / 2, height - 2, 'Student attendance %', { class: 'axis-label', 'text-anchor': 'middle' }));

  pts.forEach((r) => {
    const c = s('circle', {
      cx: x(r.studentAttendance), cy: y(r.composite), r: 6,
      fill: scoreColor(r.composite), 'fill-opacity': .78, stroke: '#fff', 'stroke-width': 1.4,
    });
    tip(c, `${r.teacher.name} (${r.teacher.cls}) — attendance ${Math.round(r.studentAttendance)}%, composite ${r.composite}%`);
    svg.append(c);
  });
  return svg;
}

/* --- radar: teacher vs school ----------------------------------------- */
export function radar(pillars, schoolPillars, { size = 250 } = {}) {
  const keys = Object.keys(PILLARS);
  const c = size / 2;
  const R = size / 2 - 40;
  const svg = s('svg', { viewBox: `0 0 ${size} ${size}`, class: 'chart', width: size, height: size });
  const ang = (i) => (Math.PI * 2 * i) / keys.length - Math.PI / 2;
  const pt = (i, v) => [c + Math.cos(ang(i)) * R * (v / 100), c + Math.sin(ang(i)) * R * (v / 100)];

  [25, 50, 75, 100].forEach((ring) => {
    const d = keys.map((_, i) => pt(i, ring)).map((p, i) => `${i ? 'L' : 'M'}${p[0]},${p[1]}`).join(' ') + 'Z';
    svg.append(s('path', { d, fill: 'none', stroke: '#e9e4d8', 'stroke-width': 1 }));
  });
  keys.forEach((k, i) => {
    const p = pt(i, 100);
    svg.append(s('line', { x1: c, y1: c, x2: p[0], y2: p[1], stroke: '#e9e4d8', 'stroke-width': 1 }));
    const lp = pt(i, 118);
    svg.append(txt(lp[0], lp[1], PILLARS[k].short, { class: 'axis-label', 'text-anchor': 'middle', 'dominant-baseline': 'middle' }));
  });

  const poly = (vals, stroke, fill, dash) => {
    const d = keys.map((k, i) => {
      const v = vals[k] === null || vals[k] === undefined ? 0 : vals[k];
      const p = pt(i, v);
      return `${i ? 'L' : 'M'}${p[0]},${p[1]}`;
    }).join(' ') + 'Z';
    return s('path', { d, fill, stroke, 'stroke-width': 2, 'stroke-dasharray': dash || 'none', 'fill-opacity': .18 });
  };
  if (schoolPillars) svg.append(poly(schoolPillars, '#93a29b', '#93a29b', '4 3'));
  svg.append(poly(Object.fromEntries(keys.map((k) => [k, pillars[k].percent])), '#0b5340', '#17856a'));
  return svg;
}

/* --- sparkline -------------------------------------------------------- */
export function sparkline(values, { width = 68, height = 20, color = '#17856a' } = {}) {
  const svg = s('svg', { viewBox: `0 0 ${width} ${height}`, class: 'chart', width, height });
  if (values.length < 2) return svg;
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 100);
  const x = (i) => (i / (values.length - 1)) * width;
  const y = (v) => height - ((v - min) / (max - min || 1)) * height;
  svg.append(s('path', {
    d: values.map((v, i) => `${i ? 'L' : 'M'}${x(i)},${y(v)}`).join(' '),
    fill: 'none', stroke: color, 'stroke-width': 1.6, 'stroke-linecap': 'round',
  }));
  return svg;
}

/* --- heatmap grid for the register tab -------------------------------- */
export function heatGrid(teachers, days, valueFn, { labelW = 132 } = {}) {
  const grid = el('div', { class: 'heat-grid', style: `grid-template-columns:${labelW}px repeat(${days.length}, minmax(13px, 1fr))` });
  grid.append(el('div'));
  days.forEach((d) => grid.append(el('div', { class: 'heat-day', title: d }, d.slice(8))));
  teachers.forEach((t) => {
    grid.append(el('div', { class: 'hl', title: `${t.name} — ${t.cls}` }, `${t.cls}`));
    days.forEach((d) => {
      const v = valueFn(t, d);
      const bg = heatColor(v);
      const cell = el('div', {
        class: `heat-cell${v === null ? ' na' : ''}`,
        style: bg ? `background:${bg};border-color:${bg}` : '',
        title: `${t.name} · ${d} · ${v === null ? 'not marked' : Math.round(v) + '%'}`,
      });
      grid.append(cell);
    });
  });
  return grid;
}

export { s as svgEl, txt as svgText };
