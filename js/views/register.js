/* Attendance Register — mirrors page 2 and page 3 of the inspection file. */

import { ASSEMBLY_REGISTER, WEEKS, WORKING_DAYS, SCHOOL } from '../data.js';
import { el, round, avg, fmtDate, weekday, plural, fmtDateLong } from '../util.js';
import { icon, iconEl } from '../icons.js';
import { viewHead, card, scoreChip, emptyState } from '../components.js';
import { heatGrid, heatColor, lineChart, scoreColor } from '../charts.js';
import { weeklyAttendance, bandToPct } from '../scoring.js';

const BAND_LABEL = { 0: 'Below 80%', 1: '80–89%', 2: '90%+' };

export function renderRegister(app) {
  const { state, school } = app;
  const root = el('div');
  let tab = 'register';

  root.append(viewHead({
    title: 'Attendance register',
    subtitle: `Daily assembly and class attendance, ${SCHOOL.monitorPeriod} · the four weekly blocks printed on the inspection sheet`,
    actions: [
      el('button', { class: 'btn', onclick: () => window.print() }, iconEl('print'), 'Print register'),
    ],
  }));

  const tabsHost = el('div', { class: 'tabs-inline mb14' });
  const bodyHost = el('div');

  const drawTabs = () => {
    tabsHost.innerHTML = '';
    [['register', 'Weekly register', 'This is the page 2 format: assembly and class percentage for each of the four weeks.'],
      ['heat', 'Daily grid', 'Every working day for every class — the fastest way to spot a class that only dips on certain days.'],
      ['roster', 'Assembly roster', 'As printed on page 3, with team names and class teachers.'],
    ].forEach(([k, lbl]) => tabsHost.append(el('button', {
      class: `pill-tab ${tab === k ? 'on' : ''}`,
      onclick: () => { tab = k; drawTabs(); drawBody(); },
    }, lbl)));
  };

  const drawBody = () => {
    bodyHost.innerHTML = '';
    if (tab === 'register') bodyHost.append(weeklyRegister(app));
    else if (tab === 'heat') bodyHost.append(dailyHeat(app));
    else bodyHost.append(assemblyRoster(app));
  };

  drawTabs();
  drawBody();
  root.append(tabsHost, bodyHost);
  return root;
}

/* Copy of the printed page-2 sheet, with percentages filled from the checklist */
function weeklyRegister(app) {
  const { school, state } = app;

  const table = el('table', { class: 'data' });
  const head = el('tr', {},
    el('th', { class: 'num' }, 'Sr.'),
    el('th', {}, 'Name of incharge'),
    el('th', {}, 'Class'),
    el('th', { class: 'num' }, 'Enrolment'),
  );
  WEEKS.forEach((w) => {
    head.append(el('th', { class: 'num' }, `${w.label} asm`));
    head.append(el('th', { class: 'num' }, `${w.label} cls`));
  });
  head.append(el('th', { class: 'num' }, 'Month'));
  table.append(el('thead', {}, head));

  const tbody = el('tbody');
  let totalEnrol = 0;
  const monthVals = [];

  app.state.teachers.forEach((t) => {
    totalEnrol += t.enrollment;
    const rec = app.records[t.id];
    const weeks = weeklyAttendance(t, state);
    const tr = el('tr', { class: 'clickable', onclick: () => app.openTeacher(t.id) },
      el('td', { class: 'num' }, String(t.sr)),
      el('td', {}, t.name),
      el('td', {}, t.cls),
      el('td', { class: 'num' }, String(t.enrollment)),
    );
    weeks.forEach((w) => {
      // assembly % — same band as the daily attendance item
      const v = w.pct;
      if (v !== null) monthVals.push(v);
      tr.append(el('td', { class: 'num', style: v === null ? 'color:var(--ink-4)' : `color:${scoreColor(v)};font-weight:600` },
        v === null ? '—' : `${Math.round(v)}%`));
      tr.append(el('td', { class: 'num', style: 'color:var(--ink-3)' }, w.days ? `${w.days} d` : '—'));
    });
    const pct = rec.daysObserved ? rec.studentAttendance : null;
    tr.append(el('td', { class: 'num' }, pct === null
      ? el('span', { class: 'muted' }, '—')
      : el('b', { style: `color:${scoreColor(pct)}` }, `${Math.round(pct)}%`)));
    tbody.append(tr);
  });
  table.append(tbody);
  table.append(el('tfoot', {}, el('tr', {},
    el('td', { colspan: 3 }, 'Total on roll'),
    el('td', { class: 'num' }, totalEnrol.toLocaleString('en-GB')),
    el('td', { colspan: 8 }),
    el('td', { class: 'num' }, monthVals.length ? `${Math.round(avg(monthVals))}%` : '—'),
  )));

  const note = el('div', { class: 'note', style: 'padding:10px 16px 14px;border-top:1px solid var(--line-soft)' },
    el('b', {}, 'Column note: '),
    'the checklist scores attendance in bands (below 80%, 80%+ and 90%+). “asm” shows the band midpoint that the daily marking implies — '
    + 'below 80% is reported as 72%, 80%+ as 84% and 90%+ as 92%. “cls” shows how many days of that week were actually marked, so an empty week is visible rather than hidden.',
  );

  /* Weekly line chart */
  const weeklyAvg = WEEKS.map((w) => {
    const vals = state.teachers.map((t) => weeklyAttendance(t, state).find((x) => x.key === w.key)?.pct).filter((v) => v !== null && v !== undefined);
    return { day: w.label, pct: vals.length ? round(avg(vals), 1) : null, rawPct: vals.length ? avg(vals) : 0 };
  });

  return el('div', {},
    card({
      title: 'Weekly attendance register',
      sub: 'Assembly and class attendance by week, as per the inspection sheet',
      pad: false,
      body: [table, note],
    }),
    el('div', { class: 'grid g-2 mt14' },
      card({
        title: 'Four-week trend',
        sub: 'Average across all classes',
        body: lineChart(weeklyAvg.filter((w) => w.pct !== null), { width: 460, height: 190, benchmark: 80 }),
      }),
      card({
        title: 'Classes needing attendance follow-up',
        sub: 'Lowest average attendance in the month',
        body: el('div', {},
          ...app.school.ranked.slice().sort((a, b) => a.studentAttendance - b.studentAttendance).slice(0, 6).map((r) =>
            el('div', { class: 'evidence-line', style: 'cursor:pointer', onclick: () => app.openTeacher(r.id) },
              el('div', {}, el('div', { class: 'lbl' }, r.teacher.name), el('div', { class: 'ur' }, r.teacher.cls)),
              el('div', { class: 'val', style: `color:${scoreColor(r.studentAttendance)}` }, `${Math.round(r.studentAttendance)}%`),
            ))),
      }),
    ),
  );
}

/* Daily heatmap across all teachers */
function dailyHeat(app) {
  const { state } = app;
  const tooltip = el('div', { class: 'note mb10' },
    'Each square is one class on one working day. Green is a 90%+ band, amber an 80%+ band, red below 80%. Hatched squares were never marked.');

  const grid = heatGrid(
    state.teachers,
    WORKING_DAYS,
    (t, d) => {
      const v = state.entries?.[t.id]?.[d]?.attendance;
      return v === undefined || v === null ? null : bandToPct(Number(v));
    },
    { labelW: 150 },
  );

  const scale = el('div', { class: 'heat-scale mt10' },
    el('span', {}, 'Low'),
    el('span', { class: 'swatches' },
      ...[50, 62, 72, 84, 92, 96].map((v) => el('i', { style: `background:${heatColor(v)}` }))),
    el('span', {}, 'High'),
    el('span', { class: 'muted', style: 'margin-left:12px' },
      el('span', { style: 'display:inline-block;width:10px;height:10px;border:1px dashed var(--line);background:repeating-linear-gradient(45deg,#f4f2ec,#f4f2ec 3px,#e7e4da 3px,#e7e4da 6px);margin-right:4px' }),
      'not marked'),
  );

  return card({
    title: 'Daily attendance grid',
    sub: `${plural(WORKING_DAYS.length, 'working day', 'working days')} × ${plural(state.teachers.length, 'class', 'classes')} — hover any square for the exact band`,
    body: [tooltip, el('div', { style: 'overflow-x:auto;padding-bottom:6px' }, grid), scale],
  });
}

/* Page 3 roster verbatim */
function assemblyRoster(app) {
  const table = el('table', { class: 'data' });
  table.append(el('thead', {}, el('tr', {},
    el('th', { class: 'num' }, 'Sr.'),
    el('th', {}, 'Class'),
    el('th', {}, 'Team'),
    el('th', {}, 'Class teacher'),
    el('th', { class: 'num' }, 'Total on roll'),
    el('th', { class: 'num' }, 'Days marked'),
    el('th', {}, 'Attendance index'),
  )));

  const tbody = el('tbody');
  let total = 0;
  ASSEMBLY_REGISTER.forEach((r, i) => {
    total += r.enrollment;
    const matched = app.state.teachers.find((t) => t.name.toLowerCase().includes((r.teacher.split(' ').slice(-1)[0] || '').toLowerCase())
      && t.cls.toLowerCase().replace(/\s/g, '').startsWith(r.cls.toLowerCase().replace(/\s/g, '').slice(0, 5)));
    const rec = matched ? app.records[matched.id] : null;
    tbody.append(el('tr', {},
      el('td', { class: 'num' }, String(i + 1)),
      el('td', {}, el('div', { class: 'bold' }, r.cls), el('div', { class: 'tiny muted', style: 'direction:rtl' }, r.ur)),
      el('td', {}, r.team),
      el('td', {}, r.teacher),
      el('td', { class: 'num' }, String(r.enrollment)),
      el('td', { class: 'num' }, rec?.daysObserved ? `${rec.daysObserved} d` : el('span', { class: 'muted' }, '—')),
      el('td', {}, rec?.daysObserved
        ? el('span', { class: 'chip', style: `background:${scoreColor(rec.studentAttendance)}1f;color:${scoreColor(rec.studentAttendance)};border-color:${scoreColor(rec.studentAttendance)}44` },
          `attendance ${Math.round(rec.studentAttendance)}%`)
        : el('span', { class: 'chip muted' }, 'not linked')),
    ));
  });
  table.append(tbody);
  table.append(el('tfoot', {}, el('tr', {},
    el('td', { colspan: 4 }, 'Total'),
    el('td', { class: 'num' }, String(total)),
    el('td', { colspan: 2 }),
  )));

  return el('div', {},
    card({
      title: 'Assembly register — page 3 of the inspection file',
      sub: `EMIS ${SCHOOL.emis} · ${fmtDateLong('2026-10-30')}`,
      pad: false,
      body: table,
    }),
    el('div', { class: 'note mt10' },
      'Note: the printed register lists thirty entries including the ECCE and Kachi groups under a single care giver. '
      + 'The “Monitored” column links each row back to the teacher roster so the principal can see whether that class is being checked.'),
  );
}
