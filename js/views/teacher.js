/* Teacher case file — opens from anywhere as a drawer. */

import { ITEMS, PILLARS, WORKING_DAYS, SCHOOL } from '../data.js';
import { el, round, fmtDate, fmtDateLong, weekday, initials, plural } from '../util.js';
import { icon, iconEl } from '../icons.js';
import { avatar, scoreChip, trendPill, gradeBadge } from '../components.js';
import { lineChart, pillarBars, radar, scoreColor, sparkline } from '../charts.js';
import { dayStrip, rubricPanel } from '../components-scoring.js';
import { buildExplanation, headlineFor, shortVerdict } from '../narrative.js';
import { getMark, dayFilledCount } from '../scoring.js';
import { setObservation, addAction } from '../store.js';
import { toast } from '../util.js';

let current = { app: null, id: null, tab: 'overview', day: WORKING_DAYS[WORKING_DAYS.length - 1] };

export function openTeacherDrawer(app, id, tab = 'overview') {
  current = { app, id, tab, day: WORKING_DAYS[WORKING_DAYS.length - 1] };
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawer-backdrop').classList.add('open');
  document.body.style.overflow = 'hidden';
  renderDrawer();
}

export function closeTeacherDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawer-backdrop').classList.remove('open');
  document.body.style.overflow = '';
  current.app = null;
}

function renderDrawer() {
  const { app, id } = current;
  if (!app) return;
  const host = document.getElementById('drawer');
  const teacher = app.teacher(id);
  if (!teacher) return;
  const rec = app.record(id);
  const school = app.school;

  host.innerHTML = '';

  const head = el('div', { class: 'drawer-head' },
    el('div', { class: 'avatar lg', style: 'background:rgba(255,255,255,.14);color:#fff;border-color:rgba(255,255,255,.28)' }, initials(teacher.name)),
    el('div', { style: 'min-width:0' },
      el('div', { class: 'nm' }, teacher.name),
      el('div', { class: 'meta' }, `${teacher.designation} · class ${teacher.cls} · ${plural(teacher.enrollment, 'student', 'students')} on roll`),
      el('div', { class: 'meta mt6', style: 'display:flex;gap:8px;align-items:center;flex-wrap:wrap' },
        el('span', { class: 'chip', style: 'background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff' },
          rec.daysObserved ? `${rec.composite}% composite` : 'no data'),
        el('span', { class: 'chip', style: 'background:rgba(255,255,255,.14);border-color:rgba(255,255,255,.25);color:#fff' },
          rec.daysObserved ? `Grade ${rec.grade.grade} — ${rec.grade.label}` : 'awaiting first entry'),
      ),
    ),
    el('div', { style: 'flex:1' }),
    el('button', { class: 'btn btn-sm close', onclick: closeTeacherDrawer }, el('span', { html: icon('close') }), 'Close'),
  );

  const tabs = el('div', { class: 'drawer-tabs' });
  [['overview', 'Position'], ['explain', 'Explanation'], ['evidence', 'Evidence'], ['days', 'Day by day'], ['plan', 'Action plan']]
    .forEach(([k, lbl]) => tabs.append(el('button', {
      class: current.tab === k ? 'on' : '',
      onclick: () => { current.tab = k; renderDrawer(); document.querySelector('.drawer-body').scrollTop = 0; },
    }, lbl)));

  const body = el('div', { class: 'drawer-body' });
  body.append(tabs);

  if (current.tab === 'overview') body.append(tabOverview(app, rec, teacher));
  else if (current.tab === 'explain') body.append(tabExplain(app, rec, teacher));
  else if (current.tab === 'evidence') body.append(tabEvidence(app, rec, teacher));
  else if (current.tab === 'days') body.append(tabDays(app, rec, teacher));
  else body.append(tabPlan(app, rec, teacher));

  body.append(el('div', { class: 'toolbar mt20', style: 'border-top:1px solid var(--line);padding-top:14px' },
    el('button', { class: 'btn btn-primary', onclick: () => { closeTeacherDrawer(); app.navigate('reports', { teacherId: id }); } },
      iconEl('print'), 'Print this teacher\u2019s report'),
    el('button', { class: 'btn', onclick: () => { closeTeacherDrawer(); app.navigate('entry', { teacherId: id }); } },
      iconEl('checklist'), 'Mark a day for this class'),
    el('span', { class: 'spacer', style: 'flex:1' }),
    el('span', { class: 'tiny muted' }, `Source: ${SCHOOL.principal}, ${SCHOOL.monitorPeriod}`),
  ));

  host.append(head, body);
}

/* ------------------------------------------------------------------ */
function tabOverview(app, rec, teacher) {
  const school = app.school;
  const wrap = el('div');

  const rank = school.ranked.findIndex((r) => r.id === rec.id) + 1;

  wrap.append(el('div', { class: 'grid', style: 'grid-template-columns:1fr 1fr 1fr;gap:12px;margin-bottom:14px' },
    el('div', { class: 'card card-pad' },
      el('div', { class: 'kpi-label label', style: 'font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);font-weight:700' }, 'Weighted composite'),
      el('div', { style: `font-family:var(--serif);font-size:30px;font-weight:600;color:${scoreColor(rec.composite)}` },
        rec.daysObserved ? `${rec.composite}%` : '—'),
      el('div', { class: 'tiny muted' }, rank ? `Rank ${rank} of ${school.ranked.length}` : 'No rank')),
    el('div', { class: 'card card-pad' },
      el('div', { class: 'label', style: 'font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);font-weight:700' }, 'Student attendance'),
      el('div', { style: `font-family:var(--serif);font-size:30px;font-weight:600;color:${scoreColor(rec.studentAttendance)}` },
        rec.daysObserved ? `${Math.round(rec.studentAttendance)}%` : '—'),
      el('div', { class: 'tiny muted' }, `School average ${Math.round(school.studentAttendance)}%`)),
    el('div', { class: 'card card-pad' },
      el('div', { class: 'label', style: 'font-size:10.5px;text-transform:uppercase;letter-spacing:.08em;color:var(--ink-3);font-weight:700' }, 'Monitoring coverage'),
      el('div', { style: 'font-family:var(--serif);font-size:30px;font-weight:600' }, rec.daysObserved ? `${Math.round(rec.coverage)}%` : '—'),
      el('div', { class: 'tiny muted' }, `${rec.daysObserved}/${WORKING_DAYS.length} days · ${rec.daysComplete} complete`)),
  ));

  wrap.append(el('div', { class: 'card card-pad mb14' },
    el('div', { class: 'split' },
      el('div', { style: `width:48px;height:48px;border-radius:10px;display:grid;place-items:center;font-family:var(--serif);font-size:23px;font-weight:700;background:${scoreColor(rec.composite)}1f;color:${scoreColor(rec.composite)}` },
        rec.daysObserved ? rec.grade.grade : '—'),
      el('div', { style: 'flex:1' },
        el('div', { class: 'bold' }, headlineFor(rec)),
        el('div', { class: 'small muted' }, rec.daysObserved ? rec.grade.head : 'Complete the checklist to produce a finding.')),
      rec.daysObserved ? trendPill(rec.trend) : null,
    ),
  ));

  wrap.append(el('div', { class: 'grid', style: 'grid-template-columns:1fr 250px;gap:14px;margin-bottom:14px' },
    el('div', { class: 'card' },
      el('div', { class: 'card-head' }, el('h3', {}, 'Daily score through the month')),
      el('div', { class: 'card-pad' }, rec.rows.length
        ? lineChart(rec.rows, { width: 520, height: 190, benchmark: 70, compare: school.dayAvg })
        : el('div', { class: 'note' }, 'No entries yet.'))),
    el('div', { class: 'card' },
      el('div', { class: 'card-head' }, el('h3', {}, 'Against the school')),
      el('div', { class: 'card-pad', style: 'display:grid;place-items:center' },
        radar(rec.pillars, school.pillarAvg, { size: 210 }),
        el('div', { class: 'chart-legend mt6', style: 'font-size:10.5px' },
          el('span', { class: 'k' }, el('span', { class: 'sw', style: 'background:#17856a' }), 'This teacher'),
          el('span', { class: 'k' }, el('span', { class: 'sw', style: 'background:#93a29b' }), 'School avg')))),
  ));

  wrap.append(el('div', { class: 'card' },
    el('div', { class: 'card-head' }, el('h3', {}, 'Pillar breakdown'),
      el('div', { class: 'spacer' }), el('span', { class: 'tiny muted' }, '35 / 30 / 20 / 15 weighting')),
    el('div', { class: 'card-pad' }, pillarBars(rec.pillars))));

  return wrap;
}

/* ------------------------------------------------------------------ */
function tabExplain(app, rec, teacher) {
  const wrap = el('div');
  const narrative = buildExplanation(rec, app.school, app.state);

  wrap.append(el('div', { class: 'card card-pad mb14', style: 'background:var(--green-100);border-color:#c9ddd2' },
    el('div', { class: 'split' },
      el('span', { style: 'color:var(--green-700)' }, el('span', { html: icon('info') })),
      el('div', { class: 'small' },
        el('b', {}, 'This is the written finding the principal can sign. '),
        'Every sentence is generated from the marks entered for this teacher, so it changes automatically as the record changes. '
        + 'Edit the official remark at the bottom before printing.'),
    ),
  ));

  narrative.paragraphs.forEach((p) => {
    const block = el('div', { class: `para-block ${p.kind === 'verdict' ? 'verdict' : ''}` });
    block.append(el('h4', {}, p.title));
    if (p.kind === 'verdict') {
      block.append(el('div', { style: 'font-family:var(--serif);font-size:16px;font-weight:600;margin-bottom:6px' }, p.title),
        el('p', { style: 'margin:0' }, p.text));
    } else {
      if (p.text) block.append(el('p', {}, p.text));
      if (p.list) {
        const ul = el('div');
        p.list.forEach((row) => {
          if (row.weight !== undefined) {
            ul.append(el('div', { class: 'evidence-line' },
              el('div', {}, el('div', { class: 'lbl' }, row.label), el('div', { class: 'ur' }, `${Math.round(row.weight * 100)}% weight`)),
              el('div', { class: 'val', style: `color:${scoreColor(row.percent)}` },
                row.percent === null ? '—' : `${Math.round(row.percent)}%`),
            ));
          } else if (row.text) {
            ul.append(el('div', { class: 'evidence-line', style: 'align-items:flex-start' },
              el('div', { style: 'flex:1' },
                el('div', { class: 'lbl' }, row.label),
                el('div', { class: 'small muted', style: 'line-height:1.5' }, row.text))));
          } else {
            ul.append(el('div', { class: 'evidence-line' },
              el('div', {},
                el('div', { class: 'lbl' }, row.label),
                el('div', { class: 'ur', style: 'direction:rtl' }, row.urdu || ''),
                row.detail ? el('div', { class: 'tiny muted', style: 'margin-top:1px' }, row.detail) : null),
              el('div', { class: 'val', style: `color:${scoreColor(row.percent)}` },
                `${row.percent}%`)));
          }
        });
        block.append(ul);
      }
    }
    wrap.append(block);
  });

  /* Official remark */
  const obs = app.state.observations?.[rec.id] || {};
  wrap.append(el('div', { class: 'card card-pad mt14' },
    el('h4', { style: 'margin-top:0' }, 'Principal\u2019s official remark'),
    el('textarea', {
      class: 'textarea', id: 'remark-box',
      placeholder: 'Write the remark that will appear on the printed report…',
      oninput: (e) => { obs.remark = e.target.value; },
    }, obs.remark || ''),
    el('div', { class: 'split mt10' },
      el('button', {
        class: 'btn btn-primary btn-sm',
        onclick: () => {
          const val = document.getElementById('remark-box').value;
          app.setRemark(rec.id, val);
          renderDrawer();
        },
      }, 'Save remark'),
      obs.notedOn ? el('span', { class: 'tiny muted' }, `Last noted ${fmtDate(obs.notedOn, { day: '2-digit', month: 'short', year: 'numeric' })} by ${obs.by || SCHOOL.principal}`) : null,
      el('span', { class: 'spacer', style: 'flex:1' }),
      el('button', {
        class: 'btn btn-sm',
        onclick: () => {
          const weak = rec.weakest[0];
          document.getElementById('remark-box').value = weak
            ? `Class ${teacher.cls} was monitored on ${rec.daysObserved} working days. ${weak.item.en} is the principal weakness at ${Math.round(weak.percent)}% of available points. The teacher is directed to comply within one week and report compliance in writing.`
            : `Class ${teacher.cls} was monitored on ${rec.daysObserved} working days with a composite of ${rec.composite}%. No adverse remark is called for.`;
        },
      }, 'Suggest a remark'),
    ),
  ));

  return wrap;
}

/* ------------------------------------------------------------------ */
function tabEvidence(app, rec, teacher) {
  const wrap = el('div');
  wrap.append(el('div', { class: 'card' },
    el('div', { class: 'card-head' }, el('h3', {}, 'Every item, scored across the month'),
      el('div', { class: 'spacer' }),
      el('span', { class: 'tiny muted' }, 'Points earned ÷ points available')),
  ));

  const table = el('table', { class: 'data' });
  table.append(el('thead', {}, el('tr', {},
    el('th', {}, 'Checklist item'),
    el('th', {}, 'Pillar'),
    el('th', { class: 'num' }, 'Max'),
    el('th', { class: 'num' }, 'Earned'),
    el('th', { class: 'num' }, 'Lost'),
    el('th', { class: 'num' }, '%'),
    el('th', { class: 'num' }, 'Zeros'),
    el('th', { style: 'min-width:180px' }, ''),
  )));
  const tb = el('tbody');
  ITEMS.forEach((item) => {
    const st = rec.itemStats[item.key];
    const p = st.possible ? (st.earned / st.possible) * 100 : null;
    tb.append(el('tr', {},
      el('td', {},
        el('div', { class: 'bold' }, item.en),
        el('div', { class: 'tiny muted', style: 'direction:rtl' }, item.ur),
        item.monthly ? el('div', { class: 'tiny', style: 'color:var(--gold-600);font-weight:600' }, 'Assessed once for the month') : null),
      el('td', { class: 'tiny muted' }, PILLARS[item.pillar].short),
      el('td', { class: 'num' }, String(item.max)),
      el('td', { class: 'num' }, item.monthly && st.days ? String(round(st.earned / st.days, 1)) : String(st.earned)),
      el('td', { class: 'num', style: 'color:var(--red)' }, item.monthly && st.days ? String(round((st.possible - st.earned) / st.days, 1)) : String(st.possible - st.earned)),
      el('td', { class: 'num', style: `font-weight:700;color:${scoreColor(p)}` }, p === null ? '—' : `${Math.round(p)}%`),
      el('td', { class: 'num' }, String(st.zeros)),
      el('td', {}, el('div', { class: 'meter thin' }, el('i', { style: `width:${p || 0}%;background:${scoreColor(p)}` }))),
    ));
  });
  table.append(tb);
  table.append(el('tfoot', {}, el('tr', {},
    el('td', { colspan: 2 }, 'Total'),
    el('td', { class: 'num' }, String(ITEMS.reduce((a, i) => a + (i.monthly ? i.max : i.max * rec.daysObserved), 0))),
    el('td', { class: 'num' }, String(rec.earnedTotal)),
    el('td', { class: 'num' }, String(rec.possibleTotal - rec.earnedTotal)),
    el('td', { class: 'num' }, `${rec.rawPct}%`),
    el('td', {}, ''),
    el('td', {}, ''),
  )));

  wrap.append(el('div', { class: 'card-pad', style: 'padding:0' }, el('div', { class: 'table-wrap' }, table)));

  /* Weakest / strongest callouts */
  wrap.append(el('div', { class: 'grid g-2 mt14' },
    el('div', { class: 'card card-pad' },
      el('h4', { style: 'margin-top:0;color:var(--red)' }, 'Weakest items'),
      ...rec.weakest.map((w) => el('div', { class: 'evidence-line' },
        el('div', {}, el('div', { class: 'lbl' }, w.item.en),
          el('div', { class: 'tiny muted' }, `${Math.round(w.percent)}% over ${w.days} checks · ${w.zeros} zeros`)),
        el('div', { class: 'val', style: 'color:var(--red)' }, `−${w.lost} pts`)))),
    el('div', { class: 'card card-pad' },
      el('h4', { style: 'margin-top:0;color:var(--green-700)' }, 'Strengths to record'),
      ...rec.strongest.map((s) => el('div', { class: 'evidence-line' },
        el('div', {}, el('div', { class: 'lbl' }, s.item.en), el('div', { class: 'tiny muted' }, `${s.days} checks`)),
        el('div', { class: 'val', style: 'color:var(--green-700)' }, `${Math.round(s.percent)}%`)))),
  ));

  /* Flags */
  wrap.append(el('div', { class: 'card card-pad mt14' },
    el('h4', { style: 'margin-top:0' }, 'Risk indicators'),
    ...rec.risk.map((f) => el('div', { class: `flag ${f.level}`, style: 'margin-bottom:6px' },
      el('span', { class: 'dot' }), el('span', {}, f.text)))));

  return wrap;
}

/* ------------------------------------------------------------------ */
function tabDays(app, rec, teacher) {
  const wrap = el('div');
  const host = el('div');
  const draw = () => {
    host.innerHTML = '';
    host.append(el('div', { class: 'mb14' },
      dayStrip(app, rec.id, current.day, (d) => { current.day = d; draw(); })));
    host.append(el('div', { class: 'card card-pad' },
      rubricPanel(app, rec.id, current.day, {
        onChange: () => draw(),
        compact: true,
      })));
  };
  draw();
  wrap.append(host);
  return wrap;
}

/* ------------------------------------------------------------------ */
function tabPlan(app, rec, teacher) {
  const wrap = el('div');
  const narrative = buildExplanation(rec, app.school, app.state);

  wrap.append(el('div', { class: 'card card-pad mb14', style: 'background:var(--gold-100);border-color:var(--gold-300)' },
    el('div', { class: 'small' },
      el('b', {}, 'Proposed improvement plan. '),
      'Push any line into the school action register with one click, and it will appear on the principal\u2019s follow-up list with a due date.')));

  const list = el('div');
  narrative.plan.forEach((p) => {
    list.append(el('div', { class: 'card card-pad', style: 'margin-bottom:10px' },
      el('div', { class: 'split', style: 'align-items:flex-start' },
        el('div', { style: 'flex:1' },
          el('div', { class: 'split' },
            el('span', { class: 'chip verygood' }, p.by),
            el('span', { class: 'tiny muted' }, `Owner: ${p.owner}`)),
          el('div', { style: 'font-weight:700;font-size:14px;margin:6px 0 3px' }, p.title),
          el('div', { class: 'small', style: 'color:var(--ink-2)' }, p.action),
          el('div', { class: 'tiny muted mt6' },
            el('b', {}, 'Success measure: '), p.metric,
            el('span', { style: 'margin:0 6px' }, '·'),
            el('b', {}, 'Evidence: '), p.verify)),
        el('button', {
          class: 'btn btn-sm btn-primary',
          onclick: (e) => {
            addAction(app.state, {
              title: `${teacher.name} — ${p.title}`,
              detail: p.action,
              teacherId: rec.id,
              teacherName: teacher.name,
              due: p.by,
              metric: p.metric,
              done: false,
            });
            app.commit();
            e.target.closest('button').textContent = 'Added ✓';
            e.target.closest('button').disabled = true;
            toast('Added to the improvement register.');
          },
        }, 'Add to register')),
    ));
  });
  wrap.append(list);

  wrap.append(el('div', { class: 'card card-pad mt14' },
    el('h4', { style: 'margin-top:0' }, 'Follow-up schedule'),
    el('div', { class: 'note mb10' }, 'Dates are counted from the end of the monitoring period.'),
    ...narrative.followups.map((f) => el('div', { class: 'evidence-line' },
      el('div', { style: 'flex:1' },
        el('div', { class: 'lbl' }, f.title),
        el('div', { class: 'ur' }, f.text)),
      el('div', { class: 'val', style: 'font-weight:600' }, f.display)))));

  return wrap;
}
