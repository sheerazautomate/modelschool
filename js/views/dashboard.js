/* Overview — the one screen the principal reads first. */

import { SCHOOL, PILLARS, ITEMS } from '../data.js';
import { el, round, avg, fmtDate, fmtDateLong, plural } from '../util.js';
import { icon, iconEl } from '../icons.js';
import {
  viewHead, card, kpi, scoreChip, gradeBadge, trendPill, avatar, letterhead, emptyState,
} from '../components.js';
import { lineChart, pillarBars, donut, dayColumns, scatter, scoreColor, sparkline } from '../charts.js';
import { shortVerdict, weakestText } from '../narrative.js';

const COURSE = [
  { grade: 'A+', range: '90–100 Outstanding', tone: 'excellent', label: 'Outstanding' },
  { grade: 'A', range: '80–89 Very good', tone: 'verygood', label: 'Very good' },
  { grade: 'B', range: '70–79 Good', tone: 'good', label: 'Good' },
  { grade: 'C', range: '60–69 Needs improvement', tone: 'fair', label: 'Needs improvement' },
  { grade: 'D', range: 'below 60 Unsatisfactory', tone: 'poor', label: 'Unsatisfactory' },
];

export function renderDashboard(app) {
  const { school, state } = app;
  const root = el('div');
  const atRisk = school.ranked.filter((r) => r.composite < 70);
  const critical = school.ranked.filter((r) => r.composite < 60);
  const unmonitored = school.records.filter((r) => !r.daysObserved);
  const openActions = (state.actions || []).filter((a) => !a.done);

  root.append(viewHead({
    title: 'Principal’s overview',
    subtitle: `${SCHOOL.principal} · school-wide position for ${state.period?.label || ''} · ${school.totalTeachers} incharges · ${school.enrollment.toLocaleString('en-GB')} students on roll`,
    actions: [
      el('button', { class: 'btn', onclick: () => app.navigate('reports') }, iconEl('print'), 'Generate report'),
      el('button', { class: 'btn btn-primary', onclick: () => app.navigate('entry') }, iconEl('checklist'), 'Enter today\u2019s checklist'),
    ],
  }));

  /* --- KPI strip ------------------------------------------------------ */
  const kpis = el('div', { class: 'grid g-kpi' },
    kpi({
      label: 'School composite',
      value: school.composite || '—',
      unit: '%',
      tone: school.composite >= 70 ? '' : 'red',
      iconName: 'scale',
      foot: `Grade <b>${school.grade.grade}</b> · ${school.grade.label} · benchmark 70%`,
    }),
    kpi({
      label: 'Teachers below benchmark',
      value: atRisk.length,
      unit: `/ ${school.totalTeachers}`,
      tone: 'red',
      iconName: 'alert',
      foot: `<b>${critical.length}</b> critical (below 60%) · <b>${school.ranked.length - atRisk.length}</b> clearing 70%`,
    }),
    kpi({
      label: 'Student attendance',
      value: school.withData ? Math.round(school.studentAttendance) || '—' : '—',
      unit: '%',
      tone: 'blue',
      iconName: 'users',
      foot: 'Averaged across monitored classes, from the attendance band scored daily',
    }),
    kpi({
      label: 'Open improvement actions',
      value: openActions.length,
      tone: 'gold',
      iconName: 'target',
      foot: `${(state.actions || []).filter((a) => a.done).length} closed · <a href="#actions">review plans</a>`,
    }),
  );
  root.append(kpis);

  /* --- charts --------------------------------------------------------- */
  const trendCard = card({
    title: 'School-wide performance through the month',
    sub: 'Average daily score across all monitored classes, against the 70% benchmark',
    body: [
      lineChart(school.dayAvg.filter((d) => d.pct !== null), { height: 210, width: 760, label: 'School' }),
      el('div', { class: 'chart-legend mt6' },
        el('span', { class: 'k' }, el('span', { class: 'sw', style: 'background:#0b5340' }), 'School average by day'),
        el('span', { class: 'k' }, el('span', { class: 'sw', style: 'background:#a52a2a;opacity:.55' }), '70% benchmark'),
      ),
    ],
  });

  const distCard = card({
    title: 'Grade distribution',
    sub: 'Where the 29 incharges sit after weighting',
    body: [
      donut(school.distribution),
      el('div', { class: 'note mt10' },
        `${atRisk.length} of ${school.ranked.length} teachers need attention. `,
        critical.length ? `${critical.length} are below the 60% floor and require a formal notice.` : 'None are below the 60% floor.'),
    ],
  });
  root.append(el('div', { class: 'grid g-2-1 mt14' }, trendCard, distCard));

  /* --- priority list + pillar breakdown -------------------------------- */
  const priority = el('div');
  if (atRisk.length) {
    atRisk.slice(0, 6).forEach((r) => {
      priority.append(el('div', {
        class: 'split', style: 'padding:9px 0;border-bottom:1px dashed var(--line-soft);cursor:pointer',
        onclick: () => app.openTeacher(r.id),
      },
        avatar(r.teacher.name),
        el('div', { style: 'min-width:0;flex:1' },
          el('div', { class: 'bold', style: 'font-size:13px' }, r.teacher.name),
          el('div', { class: 'tiny muted' }, `${r.teacher.cls} · ${weakestText(r.weakest[0])}`)),
        el('div', { style: 'text-align:right' },
          el('div', { class: 'bold', style: `color:${scoreColor(r.composite)};font-size:15px` }, `${r.composite}%`),
          el('div', { class: 'tiny muted' }, r.grade.grade)),
        el('span', { style: 'color:var(--ink-4)', html: icon('chevron') }),
      ));
    });
    if (atRisk.length > 6) {
      priority.append(el('div', { class: 'mt10' },
        el('button', { class: 'btn btn-sm', onclick: () => app.navigate('leaderboard', { filter: 'risk' }) },
          `See all ${atRisk.length} at risk`, el('span', { html: icon('arrowRight') }))));
    }
  } else {
    priority.append(emptyState('Nobody below benchmark', 'Every monitored teacher is clearing 70%.'));
  }

  const pillarsCard = card({
    title: 'The four pillars',
    sub: 'School average against each weighted pillar',
    body: [
      pillarBars(Object.fromEntries(Object.keys(PILLARS).map((k) => [k, {
        percent: school.pillarAvg[k],
        earned: round(avg(school.ranked.map((r) => r.pillars[k].earned)), 0),
        possible: round(avg(school.ranked.map((r) => r.pillars[k].possible)), 0),
      }]))),
      el('div', { class: 'note mt10' },
        'Attendance carries the most weight (35%) because it is the item the principal can verify on the spot.'),
    ],
  });

  root.append(el('div', { class: 'grid g-2 mt14' },
    card({ title: 'Priority list', sub: 'Lowest composites first — click to open the full case file', body: priority }),
    pillarsCard,
  ));

  /* --- weakest items across the school -------------------------------- */
  const weakestBody = el('div');
  school.weakestSchool.slice(0, 6).forEach((w) => {
    weakestBody.append(el('div', { class: 'evidence-line' },
      el('div', { style: 'min-width:0' },
        el('div', { class: 'lbl' }, w.item.en),
        el('div', { class: 'ur', style: 'direction:rtl' }, w.item.ur)),
      el('div', { class: 'val' },
        el('span', { style: `color:${scoreColor(w.percent)}` }, `${Math.round(w.percent)}%`),
        el('span', { class: 'tiny muted', style: 'margin-left:6px;font-weight:500' }, `${Math.round(w.lost)} pts lost`)),
    ));
  });

  const spotlight = school.ranked[0];
  const spotlightCard = card({
    title: 'Teacher of the month',
    sub: 'Highest weighted composite',
    body: spotlight ? el('div', {},
      el('div', { class: 'split' },
        gradeBadge(spotlight, { lg: true }),
        el('div', {},
          el('div', { style: 'font-size:16px;font-weight:600' }, spotlight.teacher.name),
          el('div', { class: 'small muted' }, `${spotlight.teacher.designation} · ${spotlight.teacher.cls} · ${plural(spotlight.teacher.enrollment, 'student', 'students')}`)),
      ),
      el('div', { class: 'mt14', html: '' }),
      el('div', { class: 'kv' },
        el('dt', {}, 'Composite'), el('dd', {}, `${spotlight.composite}% (Grade ${spotlight.grade.grade})`),
        el('dt', {}, 'Student attendance'), el('dd', {}, `${Math.round(spotlight.studentAttendance)}%`),
        el('dt', {}, 'Days monitored'), el('dd', {}, `${spotlight.daysObserved} of ${app.days.length}`),
        el('dt', {}, 'Strongest'), el('dd', {}, `${spotlight.strongest[0]?.item.en || '—'} (${Math.round(spotlight.strongest[0]?.percent || 0)}%)`),
      ),
      el('div', { class: 'mt14' },
        el('button', { class: 'btn btn-sm', onclick: () => app.openTeacher(spotlight.id) }, 'Open case file', el('span', { html: icon('arrowRight') }))),
    ) : emptyState('No data', 'Enter monitoring data to see a leader.'),
  });

  root.append(el('div', { class: 'grid g-2 mt14' },
    card({
      title: 'What the school is losing points on',
      sub: 'Ranked by percentage of available points actually earned',
      body: weakestBody,
    }),
    spotlightCard,
  ));

  /* --- how to read the score ------------------------------------------ */
  root.append(el('div', { class: 'card mt14' },
    el('div', { class: 'card-pad' },
      el('div', { class: 'split wrap', style: 'gap:18px' },
        el('div', { style: 'min-width:190px' },
          el('h4', { style: 'margin:0 0 3px' }, 'How the score is built'),
          el('div', { class: 'tiny muted' }, 'Fifteen items from the printed checklist, weighted by pillar.')),
        el('div', { class: 'chart-legend', style: 'gap:10px' },
          ...COURSE.map((c) => el('span', { class: 'k', title: c.label },
            el('span', { class: `chip ${c.tone}`, style: 'font-size:11px' }, c.grade),
            el('span', { class: 'small' }, c.range))),
        ),
        el('div', { class: 'tiny muted', style: 'flex:1;min-width:200px;text-align:right' },
          'Benchmark 70% · floor 60% · ',
          el('b', {}, 'monthly items'), ' (leave, donation, classroom features) are counted once, not daily.'),
      ),
    ),
  ));

  /* --- day coverage + note -------------------------------------------- */
  root.append(el('div', { class: 'grid g-2-1 mt14' },
    card({
      title: 'Daily monitoring coverage',
      sub: 'Average score per working day — bars show how many classes were marked',
      body: [dayColumns(school.dayAvg, { width: 720, height: 160 })],
    }),
    card({
      title: 'Principal\u2019s note',
      sub: 'Saved with the file and printed on the school report',
      body: [
        el('textarea', {
          class: 'textarea',
          id: 'principal-note',
          placeholder: 'Write the overall observation for this month, e.g. “Attendance improved in the secondary section but lesson planning remains the weakest area across the school…”',
          oninput: (e) => { app.state.notes = app.state.notes || {}; app.state.notes.principal = e.target.value; },
        }, app.state.notes?.principal || ''),
        el('div', { class: 'split mt10' },
          el('button', {
            class: 'btn btn-primary btn-sm',
            onclick: () => { app.commit({ quiet: false }); },
          }, 'Save note'),
          el('span', { class: 'tiny muted' }, 'Last saved ' + fmtDate(new Date().toISOString().slice(0, 10))),
        ),
      ],
    }),
  ));

  if (unmonitored.length) {
    root.append(el('div', { class: 'card mt14', style: 'border-color:#ecd9ae;background:var(--amber-bg)' },
      el('div', { class: 'card-pad split' },
        el('span', { style: 'color:var(--amber)', html: icon('alert') }),
        el('div', { class: 'small' },
          el('b', {}, `${plural(unmonitored.length, 'class has', 'classes have')} no monitoring entry yet. `),
          `${unmonitored.map((r) => r.teacher.name).join(', ')}.`,
        ),
        el('div', { class: 'spacer', style: 'flex:1' }),
        el('button', { class: 'btn btn-sm', onclick: () => app.navigate('entry') }, 'Start entering'),
      ),
    ));
  }

  return root;
}
