/* =========================================================================
   Printed documents. Everything here is letterhead-styled HTML that the
   browser turns into a PDF via Print → Save as PDF, or that the Sheets
   sync reproduces as a workbook.
   ========================================================================= */

import { SCHOOL, ITEMS, PILLARS, WORKING_DAYS, WEEKS } from './data.js';
import { el, fmtDate, fmtDateLong, round, avg, plural } from './util.js';
import { buildExplanation, weakestText } from './narrative.js';
import { gradeFor } from './scoring.js';
import { weeklyAttendance } from './scoring.js';

const rule = () => el('div', { class: 'gold-rule' });
const nf = new Intl.NumberFormat('en-GB');

function head(docTitle, meta = []) {
  return el('div', {},
    el('div', { class: 'rh' },
      el('div', { class: 'r1' }, SCHOOL.name),
      el('div', { class: 'r2' }, `${SCHOOL.district} · EMIS ${SCHOOL.emis} · ${SCHOOL.session}`),
      el('div', { class: 'r3' }, `Principal: ${SCHOOL.principal}`),
    ),
    rule(),
    el('div', { class: 'doc-title' }, docTitle),
    meta.length ? el('div', { class: 'report-meta' },
      ...meta.map((m) => el('div', { class: 'm' },
        el('div', { class: 'k' }, m.k), el('div', { class: 'v' }, m.v)))) : null,
  );
}

function signatureBlock({ extra = null } = {}) {
  return el('div', {},
    el('div', { class: 'sign-grid' },
      el('div', { class: 'sign' }, 'Prepared by — Monitoring In-charge'),
      el('div', { class: 'sign' }, `${SCHOOL.principal} — ${SCHOOL.principalTitle}`),
    ),
    extra ? el('div', { class: 'center tiny muted', style: 'margin-top:22px' }, extra) : null,
  );
}

/* --- 1. School monthly report ----------------------------------------- */
export function schoolReport(app) {
  const { school, state } = app;
  const doc = el('div', { class: 'report-sheet' });
  doc.append(head('Monthly Monitoring & Performance Report', [
    { k: 'Period', v: SCHOOL.monitorPeriod },
    { k: 'Working days', v: String(WORKING_DAYS.length) },
    { k: 'Teachers monitored', v: `${school.ranked.length} of ${school.totalTeachers}` },
    { k: 'School composite', v: `${school.composite}% (Grade ${school.grade.grade})` },
  ]));

  doc.append(el('h4', {}, '1. Summary of the position'));
  doc.append(el('p', {},
    `The school was monitored on ${WORKING_DAYS.length} working days during ${SCHOOL.monitorPeriod}. `
    + `${school.ranked.length} of ${school.totalTeachers} incharges have a monitoring record. `
    + `The weighted school composite is ${school.composite}%, placing the school in Grade ${school.grade.grade} (${school.grade.label}). `
    + `${school.ranked.filter((r) => r.composite >= 70).length} teachers clear the 70% benchmark, `
    + `${school.ranked.filter((r) => r.composite >= 60 && r.composite < 70).length} sit between 60% and 70%, and `
    + `${school.ranked.filter((r) => r.composite < 60).length} fall below the 60% floor. `
    + `Class attendance across the school averaged ${Math.round(school.studentAttendance)}%.`));

  doc.append(el('h4', {}, '2. Performance against the four pillars'));
  const pt = el('table');
  pt.append(el('tr', {}, ...['Pillar', 'Weight', 'Earned', 'Available', 'Percentage', 'Position'].map((h) => el('th', {}, h))));
  Object.keys(PILLARS).forEach((k) => {
    const v = school.pillarAvg[k];
    pt.append(el('tr', {},
      el('td', {}, PILLARS[k].name),
      el('td', {}, `${Math.round(PILLARS[k].weight * 100)}%`),
      el('td', {}, nf.format(round(avg(school.ranked.map((r) => r.pillars[k].earned)), 0))),
      el('td', {}, nf.format(round(avg(school.ranked.map((r) => r.pillars[k].possible)), 0))),
      el('td', {}, v === null ? '—' : `${Math.round(v)}%`),
      el('td', {}, v >= 85 ? 'Strong' : v >= 70 ? 'Adequate' : v >= 60 ? 'Marginal' : 'Weak'),
    ));
  });
  doc.append(pt);

  doc.append(el('h4', {}, '3. Weakest checklist items across the school'));
  doc.append(el('p', {}, 'The following items account for the largest share of points lost and are the priority for the coming month.'));
  const wt = el('table');
  wt.append(el('tr', {}, ...['Item', 'Pillar', 'Max per check', 'Earned', 'Available', 'Percentage'].map((h) => el('th', {}, h))));
  school.weakestSchool.slice(0, 6).forEach((w) => {
    wt.append(el('tr', {},
      el('td', {}, w.item.en),
      el('td', {}, PILLARS[w.item.pillar].short),
      el('td', {}, String(w.item.max)),
      el('td', {}, nf.format(w.earned)),
      el('td', {}, nf.format(w.possible)),
      el('td', {}, `${Math.round(w.percent)}%`)));
  });
  doc.append(wt);

  doc.append(el('h4', {}, '4. Teacher-wise result'));
  const tt = el('table');
  tt.append(el('tr', {}, ...['#', 'Teacher', 'Class', 'Roll', 'Composite', 'Grade', 'Attendance', 'Weakest item'].map((h) => el('th', {}, h))));
  school.ranked.forEach((r, i) => {
    tt.append(el('tr', {},
      el('td', {}, String(i + 1)),
      el('td', {}, r.teacher.name),
      el('td', {}, r.teacher.cls),
      el('td', {}, String(r.teacher.enrollment)),
      el('td', {}, `${r.composite}%`),
      el('td', {}, r.grade.grade),
      el('td', {}, `${Math.round(r.studentAttendance)}%`),
      el('td', {}, weakestText(r.weakest[0]))));
  });
  doc.append(tt);

  doc.append(el('h4', {}, '5. Cases requiring formal action'));
  const critical = school.ranked.filter((r) => r.composite < 60);
  if (critical.length) {
    doc.append(el('p', {}, `${plural(critical.length, 'teacher falls', 'teachers fall')} below the 60% floor and ${critical.length === 1 ? 'requires' : 'require'} a written explanation notice:`));
    const ct = el('table');
    ct.append(el('tr', {}, ...['Teacher', 'Class', 'Composite', 'Principal deficiency', 'Notice issued on'].map((h) => el('th', {}, h))));
    critical.forEach((r) => {
      ct.append(el('tr', {},
        el('td', {}, r.teacher.name),
        el('td', {}, r.teacher.cls),
        el('td', {}, `${r.composite}%`),
        el('td', {}, r.weakest.slice(0, 2).map((w) => w.item.en).join(', ')),
        el('td', {}, '___________')));
    });
    doc.append(ct);
  } else {
    doc.append(el('p', {}, 'No teacher falls below the 60% floor in this period. No formal notice is required.'));
  }

  doc.append(el('h4', {}, '6. Principal\u2019s overall observation'));
  const note = state.notes?.principal || '';
  doc.append(el('p', {}, note || '_______________________________________________________________________________________________'));
  if (!note) doc.append(el('p', {}, '_______________________________________________________________________________________________'));

  doc.append(signatureBlock({ extra: `Generated from the monitoring console on ${fmtDateLong(new Date().toISOString().slice(0, 10))}` }));
  return doc;
}

/* --- 2. Single teacher report ----------------------------------------- */
export function teacherReport(app, record) {
  const narrative = buildExplanation(record, app.school, app.state);
  const t = record.teacher;
  const doc = el('div', { class: 'report-sheet' });
  doc.append(el('div', { class: 'stamp' }, 'Confidential', el('br'), 'Service Record'));
  doc.append(head('Teacher Performance Finding', [
    { k: 'Name', v: t.name },
    { k: 'Designation', v: t.designation },
    { k: 'Class incharge', v: t.cls },
    { k: 'Result', v: `${record.composite}% — Grade ${record.grade.grade}` },
  ]));

  doc.append(el('div', { class: 'report-meta' },
    el('div', { class: 'm' }, el('div', { class: 'k' }, 'Period'), el('div', { class: 'v' }, SCHOOL.monitorPeriod)),
    el('div', { class: 'm' }, el('div', { class: 'k' }, 'Days monitored'), el('div', { class: 'v' }, `${record.daysObserved} of ${WORKING_DAYS.length}`)),
    el('div', { class: 'm' }, el('div', { class: 'k' }, 'Enrolment'), el('div', { class: 'v' }, String(t.enrollment))),
    el('div', { class: 'm' }, el('div', { class: 'k' }, 'Trend'), el('div', { class: 'v' }, record.trend.direction === 'up' ? `Improving (+${Math.abs(record.trend.delta)}%)` : record.trend.direction === 'down' ? `Declining (${record.trend.delta}%)` : 'Steady')),
  ));

  narrative.paragraphs.forEach((p) => {
    if (p.kind === 'verdict') {
      doc.append(el('h4', {}, 'Finding'));
      doc.append(el('p', {}, el('b', {}, `${p.title}. `), p.text));
      return;
    }
    doc.append(el('h4', {}, p.title));
    if (p.text) doc.append(el('p', {}, p.text));
    if (p.list) {
      const tb = el('table');
      if (p.kind === 'pillars') {
        tb.append(el('tr', {}, ...['Pillar', 'Weight', 'Earned', 'Available', '%'].map((h) => el('th', {}, h))));
        p.list.forEach((r) => tb.append(el('tr', {},
          el('td', {}, r.label), el('td', {}, `${Math.round(r.weight * 100)}%`),
          el('td', {}, nf.format(r.earned)), el('td', {}, nf.format(r.possible)),
          el('td', {}, r.percent === null ? '—' : `${Math.round(r.percent)}%`))));
      } else if (p.kind === 'evidence') {
        tb.append(el('tr', {}, ...['Item', 'Max', '%', 'Points lost', 'Detail'].map((h) => el('th', {}, h))));
        p.list.forEach((r) => tb.append(el('tr', {},
          el('td', {}, r.label), el('td', {}, String(r.max)), el('td', {}, `${r.percent}%`),
          el('td', {}, nf.format(r.lost)), el('td', {}, r.detail))));
      } else {
        tb.append(el('tr', {}, ...['Point', 'Discussion'].map((h) => el('th', {}, h))));
        p.list.forEach((r) => tb.append(el('tr', {},
          el('td', { style: 'width:32%' }, el('b', {}, r.label)), el('td', {}, r.text))));
      }
      doc.append(tb);
    }
  });

  doc.append(el('h4', {}, 'Improvement plan and undertakings'));
  const pt = el('table');
  pt.append(el('tr', {}, ...['#', 'Undertaking', 'Measure of success', 'Due', 'Owner'].map((h) => el('th', {}, h))));
  narrative.plan.forEach((p, i) => {
    pt.append(el('tr', {},
      el('td', {}, String(i + 1)),
      el('td', {}, el('b', {}, p.title), el('div', { class: 'tiny' }, p.action)),
      el('td', {}, p.metric),
      el('td', {}, p.by),
      el('td', {}, p.owner)));
  });
  doc.append(pt);

  doc.append(el('h4', {}, 'Follow-up schedule'));
  const ft = el('table');
  ft.append(el('tr', {}, ...['Date', 'Step', 'Purpose'].map((h) => el('th', {}, h))));
  narrative.followups.forEach((f) => ft.append(el('tr', {},
    el('td', {}, f.display), el('td', {}, f.title), el('td', {}, f.text))));
  doc.append(ft);

  doc.append(el('h4', {}, 'Principal\u2019s remark'));
  const remark = app.state.observations?.[record.id]?.remark;
  doc.append(el('p', {}, remark || '_______________________________________________________________________________________________'));
  if (!remark) doc.append(el('p', {}, '_______________________________________________________________________________________________'));

  doc.append(el('p', { style: 'margin-top:14px;font-size:11.5px' },
    el('b', {}, 'Teacher\u2019s acknowledgement: '),
    'I have read the above finding and the improvement plan. My reply, if any, is attached separately.'));

  doc.append(signatureBlock({
    extra: 'A copy of this finding is to be placed on the personal file of the teacher.',
  }));
  return doc;
}

/* --- 3. Batch of case files ------------------------------------------- */
export function batchReport(app, ids = null) {
  const recs = (ids ? ids.map((id) => app.record(id)) : app.school.ranked.filter((r) => r.composite < 70))
    .filter(Boolean);
  const frag = document.createDocumentFragment();
  recs.forEach((r, i) => {
    const page = teacherReport(app, r);
    if (i > 0) page.classList.add('page-break');
    frag.append(page);
  });
  if (!recs.length) {
    const doc = el('div', { class: 'report-sheet' });
    doc.append(head('Batch Case Files'));
    doc.append(el('p', {}, 'No teacher falls below the 70% benchmark in this period, so no case files are required.'));
    frag.append(doc);
  }
  return frag;
}

/* --- 4. Blank checklist form (page-1 reproduction) -------------------- */
export function blankForm(app, teacherId, day) {
  const teacher = teacherId ? app.teacher(teacherId) : null;
  const doc = el('div', { class: 'report-sheet' });
  doc.append(head('Daily Monitoring Checklist', [
    { k: 'Name of teacher', v: teacher ? teacher.name : '__________________' },
    { k: 'Class', v: teacher ? teacher.cls : '______' },
    { k: 'Date', v: day ? fmtDate(day, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '__.__.2026' },
    { k: 'Enrolment', v: teacher ? String(teacher.enrollment) : '____' },
  ]));

  const table = el('table');
  const hdr = el('tr', {},
    el('th', { style: 'width:18%' }, 'Item'),
    el('th', {}, 'Scoring options'),
    el('th', { style: 'width:9%' }, 'Max'),
    el('th', { style: 'width:9%' }, 'Awarded'),
    el('th', { style: 'width:24%' }, 'Remarks'));
  table.append(hdr);

  ITEMS.forEach((item) => {
    const marks = app.state.entries?.[teacherId]?.[day]?.[item.key];
    table.append(el('tr', {},
      el('td', {},
        el('div', {}, el('b', {}, item.en)),
        el('div', { style: 'direction:rtl;color:#64756d' }, item.ur)),
      el('td', { class: 'tiny' }, item.options.map((o) => `${o.label} = ${o.pts}`).join('  ·  ')),
      el('td', { class: 'center' }, String(item.max)),
      el('td', { class: 'center bold' }, marks === undefined || marks === null ? '' : String(marks)),
      el('td', {}, '')));
  });
  doc.append(table);

  doc.append(el('p', { style: 'font-size:11px;margin-top:6px' },
    'The checklist is scored out of 45 points per day across the fifteen items. Pillar weighting for the monthly composite: '
    + Object.keys(PILLARS).map((k) => `${PILLARS[k].name} ${Math.round(PILLARS[k].weight * 100)}%`).join(', ') + '.'));
  doc.append(signatureBlock());
  return doc;
}

/* --- 5. Attendance sheet ---------------------------------------------- */
export function attendanceSheet(app) {
  const doc = el('div', { class: 'report-sheet' });
  doc.append(head('Assembly & Class Attendance Register', [
    { k: 'EMIS', v: SCHOOL.emis },
    { k: 'Period', v: SCHOOL.monitorPeriod },
    { k: 'Classes', v: String(app.state.teachers.length) },
    { k: 'Total on roll', v: app.school.enrollment.toLocaleString('en-GB') },
  ]));

  const table = el('table');
  table.append(el('tr', {}, ...['Sr.', 'Class', 'Incharge', 'Roll', ...WEEKS.map((w) => w.label), 'Month'].map((h) => el('th', {}, h))));
  app.state.teachers.forEach((t) => {
    const weeks = weeklyAttendance(t, app.state);
    const rec = app.records[t.id];
    table.append(el('tr', {},
      el('td', {}, String(t.sr)),
      el('td', {}, t.cls),
      el('td', {}, t.name),
      el('td', {}, String(t.enrollment)),
      ...weeks.map((w) => el('td', {}, w.pct === null ? '—' : `${Math.round(w.pct)}%`)),
      el('td', {}, rec.daysObserved ? `${Math.round(rec.studentAttendance)}%` : '—')));
  });
  doc.append(table);
  doc.append(el('p', { style: 'font-size:10.5px' },
    'Percentages are derived from the attendance band recorded on the daily checklist (below 80% = 72, 80%+ = 84, 90%+ = 92). '
    + 'They are an index of compliance, not a substitute for the class register.'));
  doc.append(signatureBlock());
  return doc;
}

export function renderPrint(container, nodes) {
  container.innerHTML = '';
  if (nodes instanceof DocumentFragment) container.append(nodes);
  else container.append(nodes);
}
