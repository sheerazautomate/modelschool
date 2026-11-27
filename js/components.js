/* Reusable UI pieces shared by views. */

import { el, fmtDateLong, initials, round, sum, appendAll } from './util.js';
import { icon, iconEl } from './icons.js';
import { scoreColor, sparkline } from './charts.js';
import { gradeFor } from './scoring.js';
import { weakestText } from './narrative.js';
import { SCHOOL } from './data.js';

export function viewHead({ title, subtitle, actions = [] }) {
  return el('div', { class: 'view-head' },
    el('div', { class: 'titles' }, el('h1', {}, title), subtitle ? el('p', {}, subtitle) : null),
    el('div', { class: 'spacer' }),
    el('div', { class: 'toolbar' }, ...actions),
  );
}

export function card({ title, sub, actions, body, cls = '', pad = true }) {
  const c = el('section', { class: `card ${cls}` });
  if (title || actions) {
    const head = el('div', { class: 'card-head' },
      el('div', {}, el('h3', {}, title), sub ? el('div', { class: 'sub' }, sub) : null),
      el('div', { class: 'spacer' }),
      actions ? el('div', { class: 'toolbar' }, ...actions) : null,
    );
    c.append(head);
  }
  if (pad) {
    c.append(el('div', { class: 'card-pad' }, body));
  } else if (body && body.nodeType) {
    c.append(body);
  } else {
    appendAll(c, body);
  }
  return c;
}

export function kpi({ label, value, unit, foot, tone = '', iconName = null }) {
  return el('div', { class: `card kpi ${tone}` },
    el('div', { class: 'split' },
      el('div', { class: 'label' }, label),
      iconName ? el('span', { class: 'muted', style: 'margin-left:auto;opacity:.5', html: icon(iconName) }) : null,
    ),
    el('div', { class: 'value' }, String(value), unit ? el('small', {}, ` ${unit}`) : null),
    foot ? el('div', { class: 'foot', html: foot }) : null,
  );
}

export function gradeBadge(record, { lg = false } = {}) {
  const g = record.daysObserved ? record.grade : { grade: '—', tone: 'muted' };
  return el('div', { class: `grade-badge ${g.tone}`, style: lg ? 'width:52px;height:52px;font-size:22px' : '', title: g.label || '' }, g.grade);
}

export function scoreChip(v) {
  if (v === null || v === undefined) return el('span', { class: 'chip muted' }, 'No data');
  const g = gradeFor(v);
  return el('span', { class: 'chip', style: `background:${scoreColor(v)}1f;color:${scoreColor(v)};border-color:${scoreColor(v)}44` }, `${Math.round(v)}%`);
}

export function trendPill(trend) {
  const map = {
    up: { cls: 'excellent', icon: 'arrowUp', txt: `+${Math.abs(trend.delta)}%` },
    down: { cls: 'poor', icon: 'arrowDown', txt: `${trend.delta}%` },
    flat: { cls: 'muted', icon: 'minus', txt: 'steady' },
  };
  const m = map[trend.direction] || map.flat;
  return el('span', { class: `chip ${m.cls}`, title: `Change between the first and second half of the month` },
    el('span', { style: 'display:inline-flex;width:12px', html: icon(m.icon) }), m.txt);
}

export function avatar(name, lg = false) {
  return el('div', { class: `avatar${lg ? ' lg' : ''}` }, initials(name));
}

export function teacherRow(record, app, { showTrend = true } = {}) {
  const t = record.teacher;
  const tr = el('tr', { class: 'clickable', onclick: () => app.openTeacher(t.id) },
    el('td', { style: 'width:34px' }, String(t.sr ?? '')),
    el('td', {}, el('div', { class: 'tname' },
      avatar(t.name),
      el('div', {},
        el('div', { class: 'nm' }, t.name),
        el('div', { class: 'meta' }, `${t.designation} · ${t.cls}`)),
    )),
    el('td', { class: 'num' }, String(t.enrollment)),
    el('td', { class: 'num', style: `font-weight:700;color:${scoreColor(record.composite)}` },
      record.daysObserved ? `${record.composite}%` : '—'),
    el('td', {}, gradeBadge(record)),
    el('td', { class: 'nowrap' }, record.daysObserved ? `${Math.round(record.studentAttendance)}%` : '—'),
    showTrend ? el('td', {}, record.daysObserved ? trendPill(record.trend) : el('span', { class: 'muted' }, '—')) : null,
    el('td', { class: 'wrap', style: 'min-width:220px' },
      record.daysObserved
        ? el('div', { class: 'small' }, record.weakest[0]
          ? `Weakest: ${weakestText(record.weakest[0])}`
          : 'Balanced across items')
        : el('span', { class: 'muted small' }, 'No monitoring entered')),
    el('td', { style: 'width:26px;text-align:right;color:var(--ink-4)' }, el('span', { html: icon('chevron') })),
  );
  return tr;
}

export function letterhead({ compact = false } = {}) {
  return el('div', { class: 'rh' },
    el('div', { class: 'r1' }, SCHOOL.name),
    el('div', { class: 'r2' }, `${SCHOOL.district} · EMIS ${SCHOOL.emis}`),
    compact ? null : el('div', { class: 'r3' }, `${SCHOOL.session} · Monitoring period ${SCHOOL.monitorPeriod}`),
  );
}

export function emptyState(title, note, action) {
  return el('div', { class: 'empty' },
    el('div', { class: 'big' }, title),
    el('div', { class: 'note' }, note),
    action ? el('div', { class: 'mt14' }, action) : null,
  );
}

export function totalRow(records) {
  const withData = records.filter((r) => r.daysObserved);
  const comp = withData.length ? round(withData.reduce((a, r) => a + r.composite, 0) / withData.length, 1) : null;
  return { comp, count: withData.length };
}

export { sparkline, sum, fmtDateLong };
